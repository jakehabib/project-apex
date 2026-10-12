/** Utility: throws, detonations and lingering effects. */
import { hasLineOfSight } from '../maps/grid';
import { dist, type Vec2 } from '../maps/types';
import { UTILITY } from '../rules/arsenal';
import type { UtilityKind } from '../events';
import { dealDamage } from './combat';
import { clearSight } from './perception';
import { emit, type Agent, type RoundCtx } from './state';

const FUSE_MS: Record<UtilityKind, number> = { smoke: 1600, flash: 1300, frag: 1600, fire: 1500 };

export function utilityKind(id: string): UtilityKind {
  const u = UTILITY.find((x) => x.id === id);
  if (!u) throw new Error(`Unknown utility ${id}`);
  return u.kind;
}

export function hasUtility(a: Agent, kind: UtilityKind): string | null {
  return a.utility.find((id) => utilityKind(id) === kind) ?? null;
}

/** Throws a grenade the agent owns. Placement scatter shrinks with the Utility attribute. */
export function throwUtility(ctx: RoundCtx, a: Agent, utilityId: string, aim: Vec2): boolean {
  const idx = a.utility.indexOf(utilityId);
  if (idx < 0 || !a.alive) return false;
  a.utility.splice(idx, 1);
  const kind = utilityKind(utilityId);
  const def = UTILITY.find((x) => x.id === utilityId)!;
  const skill = (a.attrs.utility * a.formFactor) / 100;
  const scatter = (1 - skill) * 45;
  let target = { x: aim.x + ctx.rng.normal(0, scatter), y: aim.y + ctx.rng.normal(0, scatter) };
  // Grenades land on the map, never inside walls: fall back to the aim point.
  if (!hasLineOfSight(ctx.m.grid, aim, target)) target = aim;
  const flight = Math.round(FUSE_MS[kind] + dist(a.pos, target) * 0.4);
  emit(ctx.m, { type: 'utility', tMs: ctx.t, playerId: a.id, utility: kind, from: a.pos, target, detonateMs: ctx.t + flight, durationMs: def.durationMs });
  ctx.pending.push({ kind, utilityId, ownerId: a.id, target, at: ctx.t + flight, quality: skill });
  return true;
}

export function processUtility(ctx: RoundCtx): void {
  const due = ctx.pending.filter((p) => p.at <= ctx.t);
  if (due.length === 0) return;
  ctx.pending = ctx.pending.filter((p) => p.at > ctx.t);
  for (const p of due) {
    const def = UTILITY.find((x) => x.id === p.utilityId)!;
    const owner = ctx.byId.get(p.ownerId)!;
    switch (p.kind) {
      case 'smoke': {
        ctx.smokes.push({ pos: p.target, from: ctx.t, until: ctx.t + def.durationMs, radius: def.radius });
        // Smoke extinguishes fire it lands in.
        for (const f of ctx.fires) if (f.until > ctx.t && dist(f.pos, p.target) < def.radius + f.radius) f.until = ctx.t;
        break;
      }
      case 'fire': {
        const smoked = ctx.smokes.some((s) => s.until > ctx.t && dist(s.pos, p.target) < s.radius + def.radius * 0.5);
        if (!smoked) ctx.fires.push({ pos: p.target, from: ctx.t, until: ctx.t + def.durationMs, radius: def.radius, ownerId: owner.id, utilityId: p.utilityId });
        break;
      }
      case 'flash': {
        for (const v of ctx.agents) {
          if (!v.alive) continue;
          const d = dist(v.pos, p.target);
          if (d > 800 || !clearSight(ctx, v.pos, p.target)) continue;
          const dx = (p.target.x - v.pos.x) / (d || 1);
          const dy = (p.target.y - v.pos.y) / (d || 1);
          const facing = dx * v.facing.x + dy * v.facing.y;
          let f = facing > 0.55 ? 1 : facing > 0 ? 0.55 : 0.15;
          // Hearing the throw, an enemy not mid-duel may turn away in time (Game Sense).
          if (v.team !== owner.team && !v.target && ctx.rng.chance(0.1 + 0.35 * (v.attrs.gameSense / 100))) f *= 0.3;
          // Teammates turn away on the call; a skilled thrower's pop flash barely touches them.
          if (v.team === owner.team) f *= 0.25 * (1 - 0.8 * p.quality);
          const ms = Math.round(2600 * f * (1 - d / 950) * (0.6 + 0.6 * p.quality));
          if (ms < 350) continue;
          v.blindUntil = Math.max(v.blindUntil, ctx.t + ms);
          emit(ctx.m, { type: 'flashed', tMs: ctx.t, playerId: v.id, byPlayerId: owner.id, durationMs: ms });
        }
        break;
      }
      case 'frag': {
        for (const v of ctx.agents) {
          if (!v.alive || v.team === owner.team) continue;
          const d = dist(v.pos, p.target);
          if (d > def.radius * 3.5 || !hasLineOfSight(ctx.m.grid, v.pos, p.target)) continue;
          const raw = 98 * Math.max(0, 1 - d / (def.radius * 3.5)) * (0.85 + 0.3 * p.quality);
          const health = v.armor > 0 ? raw * 0.58 : raw;
          const armorAfter = v.armor > 0 ? v.armor - (raw - health) / 2 : 0;
          if (health >= 1) dealDamage(ctx, owner, v, 'frag', Math.floor(health), false, Math.floor(armorAfter));
        }
        break;
      }
    }
  }
}

/** Fire burns enemies standing in it (every 250 ms). */
export function burn(ctx: RoundCtx): void {
  for (const f of ctx.fires) {
    if (ctx.t < f.from || ctx.t >= f.until) continue;
    const owner = ctx.byId.get(f.ownerId)!;
    for (const v of ctx.agents) {
      if (!v.alive || v.team === owner.team) continue;
      if (dist(v.pos, f.pos) <= f.radius) dealDamage(ctx, owner, v, f.utilityId, 9, false, v.armor);
    }
  }
}
