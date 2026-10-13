/**
 * Map tactical intelligence: semantic understanding of a map shared by both teams' AI.
 *
 * Navigation decides *how* a player moves; this module answers *where and why*:
 * - which area (A side, B side, middle) any position belongs to;
 * - which side of the map it leans to;
 * - the map-control objectives (authored per map, derived when missing);
 * - distinct holding slots around a position, so a group spreads over real cover instead of
 *   stacking on one point.
 */
import type { SiteId } from '../../events';
import { hasLineOfSight, isWalkableSegment } from '../../maps/grid';
import { node, nodesWithTag, type NavGraph } from '../../maps/nav';
import { dist, type ControlObjective, type MapDefinition, type Vec2 } from '../../maps/types';
import type { RoundCtx } from '../state';

export type Area = SiteId | 'mid';

export interface MapTactics {
  /** Area of every nav node: the nearer site by path distance when clearly nearer, else mid. */
  readonly areaOfNode: ReadonlyMap<string, Area>;
  /** Path-distance lean: > 0 means closer to the defender spawn. */
  readonly leanOfNode: ReadonlyMap<string, number>;
  readonly controls: readonly ControlObjective[];
  /** A plant node for each site (reference point for distances). */
  readonly siteNode: Readonly<Record<SiteId, string>>;
}

const cache = new Map<string, MapTactics>();

export function tacticsFor(map: MapDefinition, nav: NavGraph): MapTactics {
  const key = `${map.id}@${map.version}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const n = nav.ids.length;
  const idx = (id: string) => nav.index.get(id)!;
  const d = (a: string, b: string) => nav.distance[idx(a) * n + idx(b)]!;
  const plants = nodesWithTag(nav, 'plant');
  const siteNode = {
    A: (plants.find((p) => p.site === 'A') ?? map.nodes.find((x) => x.site === 'A')!).id,
    B: (plants.find((p) => p.site === 'B') ?? map.nodes.find((x) => x.site === 'B')!).id,
  };
  const tSpawn = nodesWithTag(nav, 'attacker_spawn').map((x) => x.id);
  const cSpawn = nodesWithTag(nav, 'defender_spawn').map((x) => x.id);
  const areaOfNode = new Map<string, Area>();
  const leanOfNode = new Map<string, number>();
  for (const id of nav.ids) {
    const nd = nav.nodes.get(id)!;
    const dA = d(id, siteNode.A);
    const dB = d(id, siteNode.B);
    areaOfNode.set(id, nd.site ?? (dA < dB * 0.72 ? 'A' : dB < dA * 0.72 ? 'B' : 'mid'));
    const toT = Math.min(...tSpawn.map((s) => d(id, s)));
    const toC = Math.min(...cSpawn.map((s) => d(id, s)));
    leanOfNode.set(id, toT - toC);
  }
  const strat = map.strategy;
  // Without authored objectives, every attacker control spot is a one-spot objective.
  const controls: ControlObjective[] =
    strat.controls && strat.controls.length > 0
      ? [...strat.controls]
      : strat.tControl.map((s) => ({ id: s, name: nav.nodes.get(s)?.callout ?? s, spots: [s], contest: [], unlocks: [] }));
  const t: MapTactics = { areaOfNode, leanOfNode, controls, siteNode };
  cache.set(key, t);
  return t;
}

export const mapTactics = (ctx: RoundCtx): MapTactics => tacticsFor(ctx.m.map, ctx.m.nav);

const nearestCache = new Map<string, Map<number, string>>();

/** Nearest nav node to a point (memoised per 10-unit cell; deterministic). */
export function nearestNode(ctx: RoundCtx, p: Vec2): string {
  const key = `${ctx.m.map.id}@${ctx.m.map.version}`;
  let m = nearestCache.get(key);
  if (!m) nearestCache.set(key, (m = new Map()));
  const cell = Math.floor(p.x / 10) * 100_000 + Math.floor(p.y / 10);
  const hit = m.get(cell);
  if (hit) return hit;
  const q = { x: Math.floor(p.x / 10) * 10 + 5, y: Math.floor(p.y / 10) * 10 + 5 };
  const id = nearestExact(ctx, q);
  m.set(cell, id);
  return id;
}

function nearestExact(ctx: RoundCtx, p: Vec2): string {
  let best = '';
  let bd = Infinity;
  for (const n of ctx.m.nav.nodes.values()) {
    const dd = (n.pos.x - p.x) * (n.pos.x - p.x) + (n.pos.y - p.y) * (n.pos.y - p.y);
    if (dd < bd || (dd === bd && n.id < best)) {
      bd = dd;
      best = n.id;
    }
  }
  return best;
}

export function areaAt(ctx: RoundCtx, p: Vec2): Area {
  return mapTactics(ctx).areaOfNode.get(nearestNode(ctx, p)) ?? 'mid';
}

/**
 * Up to `count` distinct holding slots around `center`, each reachable in a straight line from it
 * (same room) and at least `spacing` apart. The first slot is the one nearest `front`, so the
 * squad's leader takes the forward spot. Deterministic.
 */
export function slotsAround(ctx: RoundCtx, center: string, count: number, front?: Vec2, spacing = 48, radius = 150): string[] {
  const nav = ctx.m.nav;
  const c = node(nav, center).pos;
  const pick = (r: number): string[] => {
    const cand = [...nav.nodes.values()]
      .filter((x) => x.id === center || (dist(x.pos, c) <= r && isWalkableSegment(ctx.m.grid, c, x.pos)))
      .sort((a, b) => dist(a.pos, c) - dist(b.pos, c) || (a.id < b.id ? -1 : 1));
    const out: string[] = [];
    for (const x of cand) {
      if (out.length >= count) break;
      if (out.every((o) => dist(node(nav, o).pos, x.pos) >= spacing)) out.push(x.id);
    }
    return out;
  };
  let slots = pick(radius);
  if (slots.length < count) slots = pick(radius * 1.7);
  while (slots.length < count) slots.push(center);
  if (front) {
    const lead = [...slots].sort((a, b) => dist(node(nav, a).pos, front) - dist(node(nav, b).pos, front) || (a < b ? -1 : 1))[0]!;
    slots = [lead, ...slots.filter((s) => s !== lead)];
  }
  return slots;
}

/** Path distance between two nodes (map units). */
export function pathDist(ctx: RoundCtx, a: string, b: string): number {
  const nav = ctx.m.nav;
  const n = nav.ids.length;
  return nav.distance[nav.index.get(a)! * n + nav.index.get(b)!]!;
}

const stageCache = new Map<string, string>();

/**
 * The staging point for a route, moved to the nearest covered spot when the authored one can be
 * seen from standard defender positions (map intelligence: never wait in an open sightline).
 */
export function safeStage(ctx: RoundCtx, stage: string, entry: string): string {
  const key = `${ctx.m.map.id}@${ctx.m.map.version}:${stage}`;
  const hit = stageCache.get(key);
  if (hit) return hit;
  const nav = ctx.m.nav;
  const exp = (id: string) => nav.exposure[nav.index.get(id)!]!;
  let best = stage;
  if (exp(stage) > 0) {
    let bestScore = Infinity;
    for (const id of nav.ids) {
      if (exp(id) > 0 || nav.nodes.get(id)!.site) continue;
      const d = pathDist(ctx, stage, id);
      if (d > 320) continue;
      // Close to the authored stage, and not further from the entry than it.
      const score = d + Math.max(0, pathDist(ctx, id, entry) - pathDist(ctx, stage, entry)) * 0.8;
      if (score < bestScore || (score === bestScore && id < best)) {
        bestScore = score;
        best = id;
      }
    }
  }
  stageCache.set(key, best);
  return best;
}

export interface HitUtility {
  readonly smokes: readonly Vec2[];
  readonly flashes: readonly Vec2[];
  readonly mollies: readonly Vec2[];
}

const hitCache = new Map<string, HitUtility>();

/**
 * Execute utility for a route, derived from geometry: every standard defender position that can
 * see the route's entry gets a smoke on the line between it and the entry (far angles) or a molotov
 * (close angles). Flashes go over the entry. Authored lineups come first.
 */
export function hitUtility(ctx: RoundCtx, site: SiteId, routeId: string): HitUtility {
  const key = `${ctx.m.map.id}@${ctx.m.map.version}:${site}:${routeId}`;
  const hit = hitCache.get(key);
  if (hit) return hit;
  const strat = ctx.m.map.strategy;
  const s = strat.sites[site];
  const route = s.routes.find((r) => r.id === routeId) ?? s.routes[0]!;
  const nav = ctx.m.nav;
  const entry = node(nav, route.entry).pos;
  const smokes: Vec2[] = s.execSmokes.filter((l) => l.route === route.id).map((l) => l.target);
  const flashes: Vec2[] = s.execFlashes.filter((l) => l.route === route.id).map((l) => l.target);
  const mollies: Vec2[] = [];
  const holds = [...new Set([...s.ctAnchors, ...strat.midHolds])].map((id) => node(nav, id).pos);
  for (const h of holds) {
    const d = dist(h, entry);
    if (d > 1600 || !hasLineOfSight(ctx.m.grid, h, entry)) continue;
    if (d < 520) {
      if (!mollies.some((m) => dist(m, h) < 120)) mollies.push(h);
      continue;
    }
    // A smoke a third of the way from the defender towards the entry blocks that sightline.
    const k = 0.35;
    const p = { x: h.x + (entry.x - h.x) * k, y: h.y + (entry.y - h.y) * k };
    if (!smokes.some((m) => dist(m, p) < 140)) smokes.push(p);
  }
  if (flashes.length === 0) flashes.push(entry);
  const out = { smokes, flashes, mollies };
  hitCache.set(key, out);
  return out;
}
