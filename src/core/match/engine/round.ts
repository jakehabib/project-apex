/** One live round: fixed-step loop over perception, planning, combat, objective and movement. */
import type { RoundOutcome } from '../events';
import { siteAt } from '../maps/grid';
import { node } from '../maps/nav';
import { dist } from '../maps/types';
import { updateAttack } from './attack';
import { fireAt, reactionMs } from './combat';
import { updateDefense } from './defense';
import { considerSave } from './save';
import { grantMoney } from './economy';
import { anchorNode, interp, stepMovement, stopAgent } from './movement';
import { freshIntel, perceive } from './perception';
import { emit, type Agent, type RoundCtx } from './state';
import { assign, atNode, gotoTask } from './tasks';
import { PERCEPTION_EVERY_TICKS, PLANT_RADIUS, TICK_MS } from './types';
import { burn, processUtility } from './utility';
import { hypot } from '../maps/types';

export interface RoundResult {
  readonly winnerTeam: number;
  readonly reason: RoundOutcome;
  readonly planted: boolean;
  readonly endMs: number;
}

function visibleEnemies(a: Agent): Agent[] {
  return a.seeing.filter((e) => e.alive);
}

function face(a: Agent, x: number, y: number): void {
  const dx = x - a.pos.x;
  const dy = y - a.pos.y;
  const d = hypot(dx, dy);
  if (d > 0.01) a.facing = { x: dx / d, y: dy / d };
}

function tickAgent(ctx: RoundCtx, a: Agent): void {
  const rules = ctx.m.rules;
  const enemies = visibleEnemies(a);
  let engaged = false;

  if (enemies.length > 0) {
    const close = enemies.some((e) => dist(e.pos, a.pos) < 600);
    if (!a.saving || close) {
      let target = enemies.find((e) => e.id === a.target);
      if (!target) {
        target = enemies.sort((x, y) => dist(x.pos, a.pos) - dist(y.pos, a.pos) || (x.id < y.id ? -1 : 1))[0]!;
        a.target = target.id;
        a.readyAt = ctx.t + reactionMs(ctx, a, target);
        a.burst = 0;
        stopAgent(ctx, a);
      }
      face(a, target.pos.x, target.pos.y);
      // Planting/defusing under fire: abort unless finishing is the only way to win.
      if (a.planting) {
        a.planting = null;
        emit(ctx.m, { type: 'plant_abort', tMs: ctx.t, playerId: a.id });
      }
      if (a.defusing) {
        const remainingDefuse = a.defusing.until - ctx.t;
        const bombLeft = ctx.bomb.planted!.at + rules.timing.bombTimerMs - ctx.t;
        if (remainingDefuse > 1200 || remainingDefuse > bombLeft) {
          a.defusing = null;
          emit(ctx.m, { type: 'defuse_abort', tMs: ctx.t, playerId: a.id });
        }
      }
      if (!a.defusing) fireAt(ctx, a, target);
      a.lastEngageAt = ctx.t;
      engaged = true;
    }
  } else if (a.target && ctx.t - a.lastEngageAt > 900) {
    a.target = null;
    a.burst = 0;
  }

  // Objective progress.
  if (a.planting && ctx.t >= a.planting.until) {
    const site = siteAt(ctx.m.grid, a.pos)!;
    a.planting = null;
    a.bomb = false;
    ctx.bomb.carrierId = null;
    ctx.bomb.planted = { site, pos: a.pos, node: anchorNode(ctx, a.pos, [a.node, a.edgeTo]), at: ctx.t };
    emit(ctx.m, { type: 'plant', tMs: ctx.t, playerId: a.id, site, pos: a.pos });
    ctx.m.trace?.('plant', { t: ctx.t, site });
    grantMoney(ctx.m, rules, a, rules.economy.plantReward, 'plant', ctx.t);
  }
  if (a.defusing && ctx.t >= a.defusing.until) {
    a.defusing = null;
    ctx.bomb.defused = true;
    emit(ctx.m, { type: 'defuse', tMs: ctx.t, playerId: a.id });
    grantMoney(ctx.m, rules, a, rules.economy.defuseReward, 'defuse', ctx.t);
    return;
  }

  const task = a.task;
  let mayMove = !engaged && !a.target && !a.planting && !a.defusing;
  switch (task.kind) {
    case 'goto':
      if (task.notBefore !== undefined && ctx.t < task.notBefore) mayMove = false;
      if (!a.motion && a.path.length === 0) {
        if (atNode(ctx, a, task.node, 20)) {
          if (task.watch) assign(ctx, a, { kind: 'hold', node: task.node, watch: task.watch, reason: task.reason });
          else assign(ctx, a, { kind: 'idle' });
        } else if (ctx.t - a.taskSince > 500) assign(ctx, a, task); // re-plan after an interruption
      }
      break;
    case 'hold':
      // Re-aim only on perception ticks (that is when new information arrives).
      if (!engaged && !a.target && ctx.t % (TICK_MS * PERCEPTION_EVERY_TICKS) === 0) {
        // Pre-aim the freshest nearby threat the team knows about, else the assigned angle.
        const threat = freshIntel(ctx, a.team, 2500)
          .filter((e) => dist(e.pos, a.pos) < 1100)
          .sort((x, y) => y.t - x.t || dist(x.pos, a.pos) - dist(y.pos, a.pos))[0];
        if (threat) face(a, threat.pos.x, threat.pos.y);
        else face(a, task.watch.x, task.watch.y);
      }
      break;
    case 'plant': {
      if (!a.bomb) {
        assign(ctx, a, { kind: 'idle' });
        break;
      }
      const spot = node(ctx.m.nav, task.node).pos;
      if (!a.motion && dist(a.pos, spot) <= PLANT_RADIUS && !a.planting && !engaged && siteAt(ctx.m.grid, a.pos)) {
        a.planting = { until: ctx.t + rules.timing.plantTimeMs };
        emit(ctx.m, { type: 'plant_start', tMs: ctx.t, playerId: a.id, site: siteAt(ctx.m.grid, a.pos)! });
        mayMove = false;
      } else if (!a.motion && a.path.length === 0 && !a.planting) assign(ctx, a, task);
      break;
    }
    case 'defuse': {
      const b = ctx.bomb.planted;
      if (!b) break;
      if (!a.motion && dist(a.pos, b.pos) <= PLANT_RADIUS && !a.defusing && !engaged) {
        const need = a.kit ? rules.timing.defuseKitTimeMs : rules.timing.defuseTimeMs;
        const left = b.at + rules.timing.bombTimerMs - ctx.t;
        if (need <= left) {
          a.defusing = { until: ctx.t + need, kit: a.kit };
          emit(ctx.m, { type: 'defuse_start', tMs: ctx.t, playerId: a.id, withKit: a.kit });
        }
        mayMove = false;
      } else if (!a.motion && a.path.length === 0 && !a.defusing) {
        // At the node but not on the bomb: step onto it.
        if (dist(a.pos, b.pos) > PLANT_RADIUS) moveDirect(ctx, a, b.pos, b.node);
      }
      break;
    }
    case 'pickup': {
      const drop = ctx.bomb.dropped;
      if (!drop) {
        assign(ctx, a, { kind: 'idle' });
        break;
      }
      if (!a.motion && dist(a.pos, drop.pos) <= PLANT_RADIUS) {
        a.bomb = true;
        ctx.bomb.carrierId = a.id;
        ctx.bomb.dropped = null;
        emit(ctx.m, { type: 'bomb_pickup', tMs: ctx.t, playerId: a.id });
        const plan = ctx.plan!;
        const r = ctx.m.map.strategy.sites[plan.site].routes.find((x) => x.id === plan.routeOf.get(a.id)) ?? ctx.m.map.strategy.sites[plan.site].routes[0]!;
        assign(ctx, a, gotoTask(r.clear[0]!, 'carry bomb', { via: r.entry }));
      } else if (!a.motion && a.path.length === 0 && mayMove) moveDirect(ctx, a, drop.pos, drop.node);
      break;
    }
    case 'save':
      if (!a.motion && a.path.length === 0 && !atNode(ctx, a, task.node, 20)) assign(ctx, a, task);
      break;
    case 'idle':
      break;
  }

  stepMovement(ctx, a, mayMove, ctx.t > ctx.m.rules.timing.roundTimeMs - 15000 || !!ctx.bomb.planted);

  // Moving players check the angle their team knows is dangerous instead of staring down the path.
  if (a.motion && !engaged && ctx.t % (TICK_MS * PERCEPTION_EVERY_TICKS) === 0) {
    const threat = freshIntel(ctx, a.team, 2000)
      .filter((e) => dist(e.pos, a.pos) < 1000)
      .sort((x, y) => dist(x.pos, a.pos) - dist(y.pos, a.pos) || (x.id < y.id ? -1 : 1))[0];
    if (threat) face(a, threat.pos.x, threat.pos.y);
    else face(a, a.motion.to.x, a.motion.to.y);
  }
}

/** Final short move from a node onto a point lying on an adjacent edge (bomb). */
function moveDirect(ctx: RoundCtx, a: Agent, to: { x: number; y: number }, label: string): void {
  if (dist(a.pos, node(ctx.m.nav, label).pos) > 1) {
    // Not standing on the reference node: path there first.
    assign(ctx, a, gotoTask(label, 'approach'));
    a.task = ctx.bomb.planted ? { kind: 'defuse' } : { kind: 'pickup' };
    return;
  }
  a.path = [];
  const d = dist(a.pos, to);
  const dur = Math.max(1, Math.round((d / 45) * 1000));
  a.motion = { from: a.pos, to, toNode: label, t0: ctx.t, dur };
  emit(ctx.m, { type: 'move', tMs: ctx.t, playerId: a.id, from: a.pos, to, toNode: label, durationMs: dur, walking: false });
}

function checkEnd(ctx: RoundCtx): RoundResult | null {
  const rules = ctx.m.rules;
  const att = ctx.attackerTeam;
  const def = 1 - att;
  const tAlive = ctx.agents.some((a) => a.alive && a.side === 'attacker');
  const ctAlive = ctx.agents.some((a) => a.alive && a.side === 'defender');
  const b = ctx.bomb.planted;
  if (b) {
    if (ctx.bomb.defused) return { winnerTeam: def, reason: 'bomb_defused', planted: true, endMs: ctx.t };
    if (ctx.t >= b.at + rules.timing.bombTimerMs) {
      emit(ctx.m, { type: 'detonate', tMs: ctx.t, site: b.site });
      return { winnerTeam: att, reason: 'bomb_detonated', planted: true, endMs: ctx.t };
    }
    if (!ctAlive) return { winnerTeam: att, reason: 'defenders_eliminated', planted: true, endMs: ctx.t };
    return null;
  }
  if (!ctAlive) return { winnerTeam: att, reason: 'defenders_eliminated', planted: false, endMs: ctx.t };
  if (!tAlive) return { winnerTeam: def, reason: 'attackers_eliminated', planted: false, endMs: ctx.t };
  if (ctx.t >= rules.timing.roundTimeMs) return { winnerTeam: def, reason: 'time_expired', planted: false, endMs: ctx.t };
  return null;
}

export function playRound(ctx: RoundCtx): RoundResult {
  const maxT = ctx.m.rules.timing.roundTimeMs + ctx.m.rules.timing.bombTimerMs + 5000;
  let tick = 0;
  for (ctx.t = 0; ctx.t <= maxT; ctx.t += TICK_MS, tick++) {
    // Everyone's position is brought to this instant before anything perceives or acts (replay parity).
    for (const a of ctx.agents) if (a.alive && a.motion) a.pos = interp(a.motion.from, a.motion.to, a.motion.t0, a.motion.dur, ctx.t);
    processUtility(ctx);
    if (tick % 5 === 0) burn(ctx);
    if (tick % PERCEPTION_EVERY_TICKS === 0) perceive(ctx);
    if (tick % 5 === 0) {
      updateAttack(ctx);
      updateDefense(ctx);
      considerSave(ctx);
    }
    // Randomised (seeded) processing order so neither side always shoots first.
    for (const a of ctx.rng.shuffle(ctx.agents)) if (a.alive) tickAgent(ctx, a);
    const end = checkEnd(ctx);
    if (end) return end;
  }
  throw new Error('Round exceeded maximum duration');
}
