/** Task assignment helpers shared by the attack and defense planners. */
import { findPath, node } from '../maps/nav';
import { dist, type Vec2 } from '../maps/types';
import { setPath } from './movement';
import type { Agent, RoundCtx, Task } from './state';

const SAFE_REASONS = new Set(['setup', 'rotate', 'rotate in', 'stage', 'retake stage', 'lurk', 'post-plant']);

export const pos = (ctx: RoundCtx, id: string): Vec2 => node(ctx.m.nav, id).pos;

export function atNode(ctx: RoundCtx, a: Agent, id: string, radius = 12): boolean {
  return !a.motion && dist(a.pos, pos(ctx, id)) <= radius;
}

/** Assigns a task and plans its path immediately. */
export function assign(ctx: RoundCtx, a: Agent, task: Task): void {
  a.task = task;
  a.taskSince = ctx.t;
  if (task.kind === 'goto') {
    a.walking = !!task.walk;
    // Positioning moves avoid the enemy's half of the map; commitments (entries, info, retakes) do not.
    const positioning = SAFE_REASONS.has(task.reason) || task.reason.startsWith('control') || task.reason === 'fake stage';
    const safe: boolean | 'cover' = positioning ? (a.side === 'attacker' ? 'cover' : true) : false;
    if (task.via && !atNode(ctx, a, task.via)) {
      // Force the route through `via` (an entry choke), then on to the goal.
      if (setPath(ctx, a, task.via, safe)) {
        const onward = findPath(ctx.m.nav, task.via, task.node);
        if (onward) a.path = a.path.concat(onward.slice(1));
      }
    } else setPath(ctx, a, task.node, safe);
  } else if (task.kind === 'plant' || task.kind === 'save') {
    a.walking = false;
    setPath(ctx, a, task.node, task.kind === 'save');
  } else if (task.kind === 'defuse') {
    a.walking = false;
    if (ctx.bomb.planted) setPath(ctx, a, ctx.bomb.planted.node);
  } else if (task.kind === 'pickup') {
    a.walking = false;
    if (ctx.bomb.dropped) setPath(ctx, a, ctx.bomb.dropped.node);
  } else {
    a.path = [];
  }
}

export interface GotoOpts {
  walk?: boolean;
  via?: string;
  notBefore?: number;
  watch?: Vec2;
  quietNear?: Vec2;
  follow?: { id: string; gap: number };
  checks?: readonly Vec2[];
  squad?: string;
  role?: string;
}

export function gotoTask(nodeId: string, reason: string, opts: GotoOpts = {}): Task {
  return {
    kind: 'goto',
    node: nodeId,
    reason,
    ...(opts.walk ? { walk: true } : {}),
    ...(opts.via ? { via: opts.via } : {}),
    ...(opts.notBefore !== undefined ? { notBefore: opts.notBefore } : {}),
    ...(opts.watch ? { watch: opts.watch } : {}),
    ...(opts.quietNear ? { quietNear: opts.quietNear } : {}),
    ...(opts.follow ? { follow: opts.follow } : {}),
    ...(opts.checks && opts.checks.length ? { checks: opts.checks } : {}),
    ...(opts.squad ? { squad: opts.squad } : {}),
    ...(opts.role ? { role: opts.role } : {}),
  } as Task;
}

/** Greedy unique assignment of agents to nodes by shortest straight distance (deterministic). */
export function assignNearest(ctx: RoundCtx, agents: Agent[], nodes: readonly string[]): Map<string, string> {
  const out = new Map<string, string>();
  const free = [...nodes];
  const pairs: { a: Agent; n: string; d: number }[] = [];
  for (const a of agents) for (const n of free) pairs.push({ a, n, d: dist(a.pos, pos(ctx, n)) });
  pairs.sort((x, y) => x.d - y.d || (x.a.id < y.a.id ? -1 : x.a.id > y.a.id ? 1 : x.n < y.n ? -1 : 1));
  const usedNodes = new Set<string>();
  for (const p of pairs) {
    if (out.has(p.a.id) || usedNodes.has(p.n)) continue;
    out.set(p.a.id, p.n);
    usedNodes.add(p.n);
  }
  // More agents than nodes: reuse nodes in order.
  let i = 0;
  for (const a of agents) if (!out.has(a.id)) out.set(a.id, nodes[i++ % nodes.length]!);
  return out;
}
