/**
 * Shot-by-shot combat resolution. A duel is never pre-decided: each shot rolls
 * hit/headshot from the shooter's skill, weapon, range, movement, blindness,
 * the target's cover and spray control, and damage applies armor rules.
 */
import { Cell, cellAt } from '../maps/grid';
import { dist, type Vec2 } from '../maps/types';
import { weaponById, type WeaponDef } from '../rules/arsenal';
import { grantMoney } from './economy';
import { anchorNode } from './movement';
import { clearSight } from './perception';
import { emit, type Agent, type RoundCtx } from './state';
import { hypot } from '../maps/types';

const SETTLE_MS = 260;
/** Extra reaction per degree the target sits off the crosshair (beyond 8°). */
const FLICK_MS_PER_DEG = 2.4;
const CATEGORY_ACC: Record<WeaponDef['category'], number> = { rifle: 0.72, smg: 0.62, pistol: 0.55, heavy: 0.85, sniper: 0.9 };

export function activeWeapon(a: Agent): WeaponDef {
  return weaponById(a.primary ?? a.secondary);
}

export function aimSkill(a: Agent, w: WeaponDef): number {
  const raw = w.category === 'sniper' ? a.attrs.awp : a.attrs.rifling;
  // Calling load: an IGL splits attention; strong callers manage it better.
  const load = a.isIgl ? 0.96 + 0.03 * (a.attrs.calling / 100) : 1;
  return Math.max(1, Math.min(100, raw * a.formFactor * load));
}

/** True if the target stands next to low cover facing the shooter (body partially hidden). */
function behindLowCover(ctx: RoundCtx, shooter: Vec2, target: Vec2): boolean {
  const dx = shooter.x - target.x;
  const dy = shooter.y - target.y;
  const d = hypot(dx, dy) || 1;
  for (const k of [14, 26]) {
    if (cellAt(ctx.m.grid, { x: target.x + (dx / d) * k, y: target.y + (dy / d) * k }) === Cell.Low) return true;
  }
  return false;
}

/** Number of living teammates vs. enemies, from the agent's side. */
function numbers(ctx: RoundCtx, a: Agent): { mine: number; theirs: number } {
  let mine = 0;
  let theirs = 0;
  for (const x of ctx.agents) {
    if (!x.alive) continue;
    if (x.team === a.team) mine++;
    else theirs++;
  }
  return { mine, theirs };
}

/**
 * Reaction delay when `a` acquires `target`. Better aim and positioning react faster;
 * holding a still, pre-aimed angle is faster than swinging while moving.
 */
export function reactionMs(ctx: RoundCtx, a: Agent, target: Agent): number {
  const w = activeWeapon(a);
  const skill = aimSkill(a, w);
  let ms = 285 - 1.6 * skill;
  const moving = a.motion !== null;
  // Flick cost: the further the target is from where the agent is aiming, the longer it takes to aim.
  {
    const fx = target.pos.x - a.pos.x;
    const fy = target.pos.y - a.pos.y;
    const fd = hypot(fx, fy) || 1;
    const offDeg = (Math.acos(Math.max(-1, Math.min(1, (fx * a.facing.x + fy * a.facing.y) / fd))) * 180) / Math.PI;
    ms += Math.max(0, offDeg - 8) * FLICK_MS_PER_DEG * (1.3 - a.attrs.rifling / 200);
  }
  if (moving) ms += 75;
  else {
    // Holding an angle: the target walks into a pre-aimed crosshair.
    const dx = target.pos.x - a.pos.x;
    const dy = target.pos.y - a.pos.y;
    const d = hypot(dx, dy) || 1;
    const cos = (dx * a.facing.x + dy * a.facing.y) / d;
    const holding = a.task.kind === 'hold';
    if (cos > 0.9) ms -= (holding ? 45 : 20) + 0.6 * a.attrs.positioning * a.formFactor;
  }
  // Refrag: a target who just killed a teammate is pre-aimed by the trader.
  const killedMate = ctx.recentKills.some((k) => k.killerId === target.id && ctx.t - k.t < 3000 && ctx.byId.get(k.victimId)!.team === a.team);
  if (killedMate) ms -= 20 + (a.attrs.teamwork - 50) * 1.3;
  if (target.motion !== null && !a.motion) ms -= 10; // movement makes targets easier to notice
  const { mine, theirs } = numbers(ctx, a);
  if (mine === 1 && theirs >= 2) ms -= (a.attrs.clutch - 50) * 0.7;
  ms += ctx.rng.normal(0, 32);
  return Math.max(85, ms);
}

export function hitChance(ctx: RoundCtx, a: Agent, target: Agent): { p: number; cover: boolean } {
  const w = activeWeapon(a);
  const d = dist(a.pos, target.pos);
  const r = d / w.effectiveRange;
  let acc = CATEGORY_ACC[w.category] * w.accuracy * (r <= 1 ? 1 - 0.22 * r : 0.78 * Math.exp(-(r - 1) * 1.3));
  const skill = aimSkill(a, w);
  acc *= 0.2 + 0.0115 * skill;
  if (a.motion) acc *= w.category === 'sniper' ? 0.12 : 0.42;
  else {
    // Settling: shots fired right after stopping (counter-strafe, crosshair adjustment) are less accurate.
    const since = ctx.t - a.stoppedAt;
    if (since < SETTLE_MS) acc *= (w.category === 'sniper' ? 0.35 : 0.6) + (w.category === 'sniper' ? 0.65 : 0.4) * (since / SETTLE_MS);
  }
  if (a.blindUntil > ctx.t) acc *= 0.08;
  // Spray control: later bullets in a burst land less, mitigated by aim.
  if (w.category !== 'sniper' && w.category !== 'heavy') acc *= Math.max(0.5, 1 - a.burst * 0.055 * (1.35 - skill / 100));
  const cover = behindLowCover(ctx, a.pos, target.pos);
  if (cover) acc *= 0.72;
  const { mine, theirs } = numbers(ctx, a);
  if (mine === 1 && theirs >= 2) acc *= 1 + (a.attrs.clutch - 50) / 600;
  return { p: Math.max(0.02, Math.min(0.93, acc)), cover };
}

function applyDamage(ctx: RoundCtx, attacker: Agent, victim: Agent, w: WeaponDef, headshot: boolean, limb: number): void {
  const raw = headshot ? w.damage * w.headshotMultiplier : w.damage * limb;
  const legs = !headshot && limb < 1;
  let health = raw;
  let armorAfter = victim.armor;
  const armored = victim.armor > 0 && (headshot ? victim.helmet : !legs);
  if (armored) {
    health = raw * w.armorPenetration;
    const armorDmg = (raw - health) / 2;
    if (armorDmg > victim.armor) {
      health += (armorDmg - victim.armor) * 2;
      armorAfter = 0;
    } else armorAfter = victim.armor - armorDmg;
  }
  dealDamage(ctx, attacker, victim, w.id, Math.floor(health), headshot, Math.floor(armorAfter));
}

/** Applies health damage and handles the kill, rewards, trades and assists. */
export function dealDamage(ctx: RoundCtx, attacker: Agent, victim: Agent, weaponId: string, health: number, headshot: boolean, armorAfter: number): void {
  if (!victim.alive || health <= 0) return;
  const amount = Math.min(victim.hp, health);
  victim.hp -= amount;
  victim.armor = Math.max(0, armorAfter);
  if (victim.armor === 0) victim.helmet = false;
  emit(ctx.m, {
    type: 'damage', tMs: ctx.t, attackerId: attacker.id, victimId: victim.id, weaponId, amount,
    armorAfter: victim.armor, headshot, hpAfter: victim.hp, attackerPos: attacker.pos, victimPos: victim.pos,
  });
  if (attacker.team !== victim.team) {
    const log = ctx.damageLog.get(victim.id) ?? new Map<string, number>();
    log.set(attacker.id, (log.get(attacker.id) ?? 0) + amount);
    ctx.damageLog.set(victim.id, log);
  }
  // A victim who is shot learns the shooter's rough position.
  if (attacker.team !== victim.team) ctx.teams[victim.team]!.intel.set(attacker.id, { pos: attacker.pos, t: ctx.t, seen: false });
  if (victim.hp <= 0) killAgent(ctx, attacker, victim, weaponId, headshot);
}

const describe = (ctx: RoundCtx, a: Agent) => ({
  id: a.id, side: a.side, role: a.roles[0], task: a.task.kind === 'goto' || a.task.kind === 'hold' ? `${a.task.kind}:${a.task.reason}` : a.task.kind,
  moving: !!a.motion, hp: a.hp, weapon: a.primary ?? a.secondary, blind: a.blindUntil > ctx.t, readyAt: a.readyAt - ctx.t,
});

export function killAgent(ctx: RoundCtx, attacker: Agent, victim: Agent, weaponId: string, headshot: boolean): void {
  if (ctx.m.trace) {
    const dx = attacker.pos.x - victim.pos.x;
    const dy = attacker.pos.y - victim.pos.y;
    const d = hypot(dx, dy) || 1;
    const victimAim = (dx * victim.facing.x + dy * victim.facing.y) / d;
    ctx.m.trace('kill', { t: ctx.t, attacker: describe(ctx, attacker), victim: describe(ctx, victim), victimTarget: victim.target, attackerTarget: attacker.target, victimAim, dist: d });
  }
  victim.alive = false;
  victim.hp = 0;
  const dropNode = anchorNode(ctx, victim.pos, [victim.node, victim.motion?.toNode, victim.edgeTo]);
  victim.motion = null;
  victim.path = [];
  victim.planting = null;
  victim.defusing = null;
  // Trade: the victim had killed one of the attacker's teammates within 4 s.
  const trade = ctx.recentKills.find((k) => k.killerId === victim.id && ctx.t - k.t <= 4000 && ctx.byId.get(k.victimId)!.team === attacker.team);
  const assisters = [...(ctx.damageLog.get(victim.id) ?? new Map<string, number>())]
    .filter(([id, dmg]) => id !== attacker.id && dmg >= 41 && ctx.byId.get(id)!.team === attacker.team)
    .map(([id]) => id)
    .sort();
  emit(ctx.m, {
    type: 'kill', tMs: ctx.t, attackerId: attacker.id, victimId: victim.id, weaponId, headshot,
    tradeOfPlayerId: trade ? trade.victimId : null, assisterIds: assisters, victimPos: victim.pos,
  });
  ctx.recentKills.push({ t: ctx.t, killerId: attacker.id, victimId: victim.id });
  if (attacker.team !== victim.team) {
    const reward = weaponId === 'frag' || weaponId === 'cinder' || weaponId === 'ember' ? 300 : weaponById(weaponId).killReward;
    grantMoney(ctx.m, ctx.m.rules, attacker, reward, 'kill', ctx.t);
  }
  // The victim's team knows where the killer was (callout before dying); nearby teammates swing to it.
  ctx.teams[victim.team]!.intel.set(attacker.id, { pos: attacker.pos, t: ctx.t, seen: true });
  for (const mate of ctx.agents) {
    if (!mate.alive || mate.team !== victim.team || mate.target) continue;
    if (hypot(mate.pos.x - victim.pos.x, mate.pos.y - victim.pos.y) > 700) continue;
    const dx = attacker.pos.x - mate.pos.x;
    const dy = attacker.pos.y - mate.pos.y;
    const d = hypot(dx, dy) || 1;
    mate.facing = { x: dx / d, y: dy / d };
    mate.lastSeen.set(attacker.id, ctx.t);
  }
  if (victim.bomb) {
    victim.bomb = false;
    ctx.bomb.carrierId = null;
    ctx.bomb.dropped = { pos: victim.pos, node: dropNode };
    emit(ctx.m, { type: 'bomb_drop', tMs: ctx.t, playerId: victim.id, pos: victim.pos });
  }
}

/**
 * Firing step for one agent with a chosen visible target. Respects reaction time
 * and weapon fire rate; one shot at most per call.
 */
export function fireAt(ctx: RoundCtx, a: Agent, target: Agent): void {
  if (ctx.t < a.readyAt || ctx.t < a.nextShotAt) return;
  // Perception runs every other tick; a shot needs a clear line at the instant it is fired.
  if (!clearSight(ctx, a.pos, target.pos)) return;
  const w = activeWeapon(a);
  const { p, cover } = hitChance(ctx, a, target);
  a.nextShotAt = ctx.t + Math.round(60000 / w.fireRate);
  a.burst++;
  ctx.m.trace?.('shot', { t: ctx.t, shooter: a.id, target: target.id, p, cover, dist: dist(a.pos, target.pos), weapon: w.id, moving: !!a.motion, blind: a.blindUntil > ctx.t, burst: a.burst });
  if (!ctx.rng.chance(p)) return;
  const skill = aimSkill(a, w) / 100;
  let hs = w.category === 'sniper' ? 0.1 : w.category === 'heavy' ? 0.12 : 0.14 + 0.32 * skill;
  if (cover) hs *= 1.5;
  const headshot = ctx.rng.chance(Math.min(0.75, hs));
  const roll = ctx.rng.next();
  const limb = cover ? 1 : roll < 0.6 ? 1 : roll < 0.8 ? 1.25 : 0.75;
  applyDamage(ctx, a, target, w, headshot, limb);
}
