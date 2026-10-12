import { hasLineOfSight } from '../maps/grid';
import { dist, type Vec2 } from '../maps/types';
import { CLOSE_AWARENESS, FOV_HALF_RAD, MAX_SIGHT } from './types';
import { emit, type Agent, type RoundCtx, type Smoke } from './state';
import { hypot } from '../maps/types';

/** Segment-circle intersection: does the sight line a->b pass through the smoke? */
export function smokeBlocks(s: Smoke, a: Vec2, b: Vec2, t: number): boolean {
  if (t < s.from || t >= s.until) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let k = len2 === 0 ? 0 : ((s.pos.x - a.x) * dx + (s.pos.y - a.y) * dy) / len2;
  k = Math.max(0, Math.min(1, k));
  const px = a.x + dx * k - s.pos.x;
  const py = a.y + dy * k - s.pos.y;
  return px * px + py * py <= s.radius * s.radius;
}

/** Ground-truth visibility used by the engine (and re-checkable by tests). */
export function clearSight(ctx: RoundCtx, a: Vec2, b: Vec2): boolean {
  for (const s of ctx.smokes) if (smokeBlocks(s, a, b, ctx.t)) return false;
  return hasLineOfSight(ctx.m.grid, a, b);
}

function inFov(obs: Agent, p: Vec2): boolean {
  const dx = p.x - obs.pos.x;
  const dy = p.y - obs.pos.y;
  const d = hypot(dx, dy) || 1;
  const cos = (dx * obs.facing.x + dy * obs.facing.y) / d;
  return cos >= Math.cos(FOV_HALF_RAD);
}

/** Can `obs` perceive `tgt` right now? Respects LOS, smokes, field of view and blindness. */
export function canSee(ctx: RoundCtx, obs: Agent, tgt: Agent): boolean {
  if (!obs.alive || !tgt.alive) return false;
  const d = dist(obs.pos, tgt.pos);
  if (d > MAX_SIGHT) return false;
  if (obs.blindUntil > ctx.t && d > 90) return false;
  // Peripheral/close awareness, a held angle on recent intel, or the field of view.
  const recent = (obs.lastSeen.get(tgt.id) ?? -1e9) > ctx.t - 1500;
  if (d > CLOSE_AWARENESS && !recent && !inFov(obs, tgt.pos)) return false;
  return clearSight(ctx, obs.pos, tgt.pos);
}

/** Runs one perception pass, updating per-agent sightings (`seeing`) and team intel. */
export function perceive(ctx: RoundCtx): void {
  for (const obs of ctx.agents) {
    obs.seeing = [];
    if (!obs.alive) continue;
    const team = ctx.teams[obs.team]!;
    for (const tgt of ctx.agents) {
      if (!tgt.alive || tgt.team === obs.team) continue;
      if (!canSee(ctx, obs, tgt)) continue;
      obs.seeing.push(tgt);
      const last = obs.lastSeen.get(tgt.id) ?? -1e9;
      if (ctx.t - last > 1500) {
        emit(ctx.m, { type: 'spotted', tMs: ctx.t, observerId: obs.id, targetId: tgt.id, observerPos: obs.pos, targetPos: tgt.pos });
      }
      obs.lastSeen.set(tgt.id, ctx.t);
      team.intel.set(tgt.id, { pos: tgt.pos, t: ctx.t, seen: true });
    }
  }
  // Footsteps: running agents are heard (approximate position) within 520 units.
  for (const src of ctx.agents) {
    if (!src.alive || !src.motion || src.walking) continue;
    for (const lis of ctx.agents) {
      if (!lis.alive || lis.team === src.team) continue;
      if (dist(lis.pos, src.pos) > 520) continue;
      const team = ctx.teams[lis.team]!;
      const known = team.intel.get(src.id);
      if (!known || ctx.t - known.t > 1000) team.intel.set(src.id, { pos: src.pos, t: ctx.t, seen: false });
    }
  }
}

/** Fresh intel entries (younger than maxAge ms) for a team. */
export function freshIntel(ctx: RoundCtx, team: number, maxAge: number): { id: string; pos: Vec2; t: number }[] {
  const out: { id: string; pos: Vec2; t: number }[] = [];
  for (const [id, e] of ctx.teams[team]!.intel) {
    const target = ctx.byId.get(id);
    if (!target) continue;
    // Deaths are public (kill feed): dead players drop out of intel.
    if (!target.alive) continue;
    if (ctx.t - e.t <= maxAge) out.push({ id, pos: e.pos, t: e.t });
  }
  return out;
}
