/**
 * Path following on the nav graph. Positions are always computed with the same
 * linear formula the replay layer uses, so the viewer reproduces them exactly.
 */
import { findPath, node, pathLength } from '../maps/nav';
import { isWalkableSegment } from '../maps/grid';
import { dist, type Vec2 } from '../maps/types';
import { activeWeapon } from './combat';
import { emit, type Agent, type Fire, type RoundCtx } from './state';
import { RUN_SPEED, WALK_FACTOR } from './types';

export function speedOf(a: Agent): number {
  return RUN_SPEED * activeWeapon(a).mobility * (a.walking ? WALK_FACTOR : 1);
}

export function interp(from: Vec2, to: Vec2, t0: number, dur: number, t: number): Vec2 {
  const k = dur <= 0 ? 1 : Math.min(1, Math.max(0, (t - t0) / dur));
  return { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k };
}

/** Halts the agent where it stands; the interrupted edge is kept so it can resume. */
export function stopAgent(ctx: RoundCtx, a: Agent): void {
  if (!a.motion) return;
  a.pos = interp(a.motion.from, a.motion.to, a.motion.t0, a.motion.dur, ctx.t);
  a.edgeTo = a.motion.toNode;
  a.path.unshift(a.motion.toNode);
  a.motion = null;
  emit(ctx.m, { type: 'stop', tMs: ctx.t, playerId: a.id, pos: a.pos });
}

/** Plans a path to `goal` from the agent's current (possibly mid-edge) position. */
export function setPath(ctx: RoundCtx, a: Agent, goal: string, safe = false): boolean {
  const nav = ctx.m.nav;
  const safeFor = safe ? a.side : undefined;
  if (a.motion) {
    // Finish the current edge first, then path onward.
    const p = findPath(nav, a.motion.toNode, goal, undefined, safeFor);
    if (!p) return false;
    a.path = p.slice(1);
    return true;
  }
  const starts = [a.node];
  if (a.edgeTo && a.edgeTo !== a.node && dist(a.pos, node(nav, a.node).pos) > 0.5) starts.push(a.edgeTo);
  let best: string[] | null = null;
  let bestLen = Infinity;
  for (const s of starts) {
    const p = findPath(nav, s, goal, undefined, safeFor);
    if (!p) continue;
    const len = dist(a.pos, node(nav, s).pos) + pathLength(nav, p);
    if (len < bestLen) {
      bestLen = len;
      best = p;
    }
  }
  if (!best) return false;
  // If standing exactly on the first node, skip it.
  a.path = smooth(ctx, a.pos, dist(a.pos, node(nav, best[0]!).pos) < 0.5 ? best.slice(1) : best);
  return true;
}

/**
 * String-pulling: skip intermediate lattice nodes whenever the straight walk to a
 * later node is legal, so movement follows natural lines instead of a 45° grid.
 */
export function smooth(ctx: RoundCtx, from: Vec2, path: readonly string[]): string[] {
  const out: string[] = [];
  let cur = from;
  let i = 0;
  while (i < path.length) {
    let j = Math.min(path.length - 1, i + 8);
    while (j > i && !isWalkableSegment(ctx.m.grid, cur, node(ctx.m.nav, path[j]!).pos)) j--;
    out.push(path[j]!);
    cur = node(ctx.m.nav, path[j]!).pos;
    i = j + 1;
  }
  return out;
}

export function segmentHitsFire(f: Fire, a: Vec2, b: Vec2, t: number): boolean {
  if (t < f.from || t >= f.until) return false;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  let k = len2 === 0 ? 0 : ((f.pos.x - a.x) * dx + (f.pos.y - a.y) * dy) / len2;
  k = Math.max(0, Math.min(1, k));
  const px = a.x + dx * k - f.pos.x;
  const py = a.y + dy * k - f.pos.y;
  return px * px + py * py <= f.radius * f.radius;
}

/**
 * Advances movement for one agent. Starts the next segment if idle and allowed.
 * `mayMove` false keeps the agent in place (engaged, planting, waiting).
 */
export function stepMovement(ctx: RoundCtx, a: Agent, mayMove: boolean, urgent: boolean): void {
  if (a.motion) {
    const m = a.motion;
    if (ctx.t >= m.t0 + m.dur) {
      a.pos = m.to;
      a.node = m.toNode;
      a.edgeTo = null;
      a.motion = null;
    } else {
      a.pos = interp(m.from, m.to, m.t0, m.dur, ctx.t);
      return;
    }
  }
  if (!mayMove || a.path.length === 0) return;
  const nextId = a.path[0]!;
  const to = node(ctx.m.nav, nextId).pos;
  // Respect active fire unless the clock forces the issue.
  if (!urgent && ctx.fires.some((f) => f.until > ctx.t + 400 && segmentHitsFire(f, a.pos, to, ctx.t))) return;
  a.path.shift();
  const d = dist(a.pos, to);
  const dur = Math.max(1, Math.round((d / speedOf(a)) * 1000));
  a.motion = { from: a.pos, to, toNode: nextId, t0: ctx.t, dur };
  if (d > 0) {
    const fx = (to.x - a.pos.x) / d;
    const fy = (to.y - a.pos.y) / d;
    a.facing = { x: fx, y: fy };
  }
  emit(ctx.m, { type: 'move', tMs: ctx.t, playerId: a.id, from: a.pos, to, toNode: nextId, durationMs: dur, walking: a.walking });
}

/** Path travel time (ms) from the agent's position to a node at run speed. */
export function travelMs(ctx: RoundCtx, a: Agent, goal: string): number {
  const from = a.motion ? a.motion.toNode : a.node;
  const p = findPath(ctx.m.nav, from, goal);
  if (!p) return Infinity;
  const extra = a.motion ? dist(a.pos, a.motion.to) : dist(a.pos, node(ctx.m.nav, from).pos);
  return ((pathLength(ctx.m.nav, p) + extra) / (RUN_SPEED * activeWeapon(a).mobility)) * 1000;
}
