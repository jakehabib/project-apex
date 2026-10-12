import { describe, expect, it } from 'vitest';
import { Cell, buildGrid, castRay, cellAt, hasLineOfSight, hasLineOfSightExact, isWalkable, isWalkableSegment, siteAt } from '../../src/core/match/maps/grid';
import { HARBOR } from '../../src/core/match/maps/harbor';
import { MAP_POOL } from '../../src/core/match/maps';
import { buildNav, findPath, nodesWithTag, pathLength } from '../../src/core/match/maps/nav';

const MAPS = [...MAP_POOL];

describe.each(MAPS)('map $name topology', (map) => {
  const nav = buildNav(map);
  const grid = nav.grid;

  it('every nav node stands on walkable floor', () => {
    const bad = map.nodes.filter((n) => !isWalkable(grid, n.pos)).map((n) => n.id);
    expect(bad).toEqual([]);
  });

  it('every nav edge is a legal straight walk (no clipping through walls or cover)', () => {
    const bad = map.edges
      .filter((e) => !isWalkableSegment(grid, nav.nodes.get(e.a)!.pos, nav.nodes.get(e.b)!.pos))
      .map((e) => `${e.a}-${e.b}`);
    expect(bad).toEqual([]);
  });

  it('graph is fully connected', () => {
    const start = map.nodes[0]!.id;
    const seen = new Set([start]);
    const stack = [start];
    while (stack.length) {
      for (const { to } of nav.adjacency.get(stack.pop()!)!) {
        if (!seen.has(to)) {
          seen.add(to);
          stack.push(to);
        }
      }
    }
    expect(seen.size).toBe(map.nodes.length);
  });

  it('has 5 spawn points per side, plant points on both sites inside site cells', () => {
    expect(nodesWithTag(nav, 'attacker_spawn')).toHaveLength(5);
    expect(nodesWithTag(nav, 'defender_spawn')).toHaveLength(5);
    for (const site of ['A', 'B'] as const) {
      const plants = nodesWithTag(nav, 'plant').filter((n) => n.site === site);
      expect(plants.length).toBeGreaterThan(0);
      for (const p of plants) expect(siteAt(grid, p.pos)).toBe(site);
    }
  });

  it('attackers reach each site by at least two distinct first routes', () => {
    const spawn = nodesWithTag(nav, 'attacker_spawn')[0]!.id;
    for (const site of ['A', 'B'] as const) {
      const plant = nodesWithTag(nav, 'plant').find((n) => n.site === site)!.id;
      const direct = findPath(nav, spawn, plant)!;
      expect(direct).not.toBeNull();
      // Block the interior of the direct route: an alternative must still exist.
      const blocked = new Set(direct.slice(2, -1));
      const alt = findPath(nav, spawn, plant, (id) => (blocked.has(id) ? 1e6 : 0))!;
      expect(alt.slice(2, -1).some((id) => blocked.has(id))).toBe(false);
    }
  });

  it('spawn-to-site run times are in a believable 10-30 s window at 5 m/s', () => {
    for (const spawnTag of ['attacker_spawn', 'defender_spawn'] as const) {
      const spawn = nodesWithTag(nav, spawnTag)[0]!.id;
      for (const site of ['A', 'B'] as const) {
        const plant = nodesWithTag(nav, 'plant').find((n) => n.site === site)!.id;
        const seconds = pathLength(nav, findPath(nav, spawn, plant)!) / 50;
        expect(seconds, `${spawnTag} -> ${site}`).toBeGreaterThan(spawnTag === 'defender_spawn' ? 4 : 10);
        expect(seconds, `${spawnTag} -> ${site}`).toBeLessThan(30);
      }
    }
  });

  it('spawns cannot see each other (no spawn-to-spawn sightline)', () => {
    for (const a of nodesWithTag(nav, 'attacker_spawn'))
      for (const d of nodesWithTag(nav, 'defender_spawn')) expect(hasLineOfSight(grid, a.pos, d.pos)).toBe(false);
  });

  it('tactical data references real nodes in the right places', () => {
    const ids = new Set(map.nodes.map((n) => n.id));
    const strat = map.strategy;
    const all = [...strat.midHolds, ...strat.tControl, ...strat.lurks, ...strat.ctInfo];
    for (const site of ['A', 'B'] as const) {
      const s = strat.sites[site];
      expect(s.routes.length).toBeGreaterThanOrEqual(2);
      for (const r of s.routes) {
        all.push(r.stage, r.entry, ...r.clear);
        for (const c of r.clear) expect(map.nodes.find((n) => n.id === c)!.site, `${r.id} clears ${c}`).toBe(site);
        // Stage must not be on the site itself.
        expect(map.nodes.find((n) => n.id === r.stage)!.site).toBeUndefined();
        expect(findPath(nav, r.stage, r.entry)).not.toBeNull();
      }
      for (const a of s.ctAnchors) expect(map.nodes.find((n) => n.id === a)!.site).toBe(site);
      all.push(...s.postPlant, ...s.ctAnchors, ...s.retakeStage);
      for (const u of [...s.execSmokes, ...s.execFlashes, ...s.ctDelay]) {
        expect(isWalkable(grid, u.target) || cellAt(grid, u.target) === Cell.Low, `${site} utility ${JSON.stringify(u.target)}`).toBe(true);
        expect(s.routes.some((r) => r.id === u.route)).toBe(true);
      }
    }
    for (const id of all) expect(ids.has(id), id).toBe(true);
  });

  it('no sightline between any points of the two spawn areas', () => {
    const sample = (zone: string) =>
      map.areas.filter((a) => a.zone === zone).flatMap((a) => {
        const xs = a.polygon.map((p) => p.x);
        const ys = a.polygon.map((p) => p.y);
        const pts = [];
        for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) pts.push({ x: Math.min(...xs) + ((Math.max(...xs) - Math.min(...xs)) * i) / 12, y: Math.min(...ys) + ((Math.max(...ys) - Math.min(...ys)) * j) / 12 });
        return pts.filter((p) => isWalkable(grid, p));
      });
    const t = sample('attacker_spawn');
    const c = sample('defender_spawn');
    const leaks = t.flatMap((a) => c.filter((b) => hasLineOfSight(grid, a, b)).map((b) => `${JSON.stringify(a)}->${JSON.stringify(b)}`));
    expect(leaks.slice(0, 3)).toEqual([]);
  });

  it('attacker staging spots are out of sight of defender holds (map-design rule)', () => {
    const P = (id: string) => nav.nodes.get(id)!.pos;
    const s = map.strategy;
    const holds = [...s.sites.A.ctAnchors, ...s.sites.B.ctAnchors, ...s.midHolds];
    const leaks: string[] = [];
    for (const site of ['A', 'B'] as const)
      for (const r of s.sites[site].routes) for (const h of holds) if (hasLineOfSight(grid, P(r.stage), P(h))) leaks.push(`${r.stage}->${h}`);
    expect(leaks).toEqual([]);
  });

  it('defenders win the race to every site (map-design rule)', () => {
    const t = nodesWithTag(nav, 'attacker_spawn')[0]!.id;
    const c = nodesWithTag(nav, 'defender_spawn')[0]!.id;
    for (const site of ['A', 'B'] as const) {
      const st = map.strategy.sites[site];
      const ct = pathLength(nav, findPath(nav, c, st.ctAnchors[0]!)!);
      const tt = Math.min(...st.routes.map((r) => pathLength(nav, findPath(nav, t, r.entry)!)));
      expect(ct, `${site}: CT ${ct.toFixed(0)} vs T ${tt.toFixed(0)}`).toBeLessThan(tt * 0.8);
    }
  });

  it('A and B sites are not mutually visible', () => {
    for (const a of map.nodes.filter((n) => n.site === 'A'))
      for (const b of map.nodes.filter((n) => n.site === 'B')) expect(hasLineOfSight(grid, a.pos, b.pos)).toBe(false);
  });
});

describe('grid line of sight', () => {
  const grid = buildGrid(HARBOR);
  it('high cover blocks sight but low cover does not', () => {
    // a_stack (high) spans x 220-290, y 220-330
    expect(hasLineOfSight(grid, { x: 200, y: 275 }, { x: 310, y: 275 })).toBe(false);
    // a_crates (low) spans x 300-350, y 360-400
    expect(cellAt(grid, { x: 325, y: 380 })).toBe(Cell.Low);
    expect(hasLineOfSight(grid, { x: 290, y: 380 }, { x: 370, y: 380 })).toBe(true);
    expect(isWalkableSegment(grid, { x: 290, y: 380 }, { x: 370, y: 380 })).toBe(false);
  });
  it('walls block sight', () => {
    // Between pier and A ramp is solid wall.
    expect(hasLineOfSight(grid, { x: 235, y: 600 }, { x: 430, y: 520 })).toBe(false);
  });
  it('is symmetric', () => {
    const pts = HARBOR.nodes.map((n) => n.pos);
    for (const a of pts) for (const b of pts) expect(hasLineOfSight(grid, a, b)).toBe(hasLineOfSight(grid, b, a));
  });
});

describe('castRay', () => {
  const grid = buildGrid(HARBOR);
  it('stops at walls and never reports distance through opaque cells', () => {
    // From A Dock looking west, the wall is ~100 units away (site x starts at 150).
    const d = castRay(grid, { x: 250, y: 180 }, Math.PI, 1000);
    expect(d).toBeGreaterThan(80);
    expect(d).toBeLessThan(110);
    for (let a = 0; a < Math.PI * 2; a += 0.2) {
      const from = { x: 805, y: 470 };
      const dist = castRay(grid, from, a, 600);
      const end = { x: from.x + Math.cos(a) * dist, y: from.y + Math.sin(a) * dist };
      expect(hasLineOfSightExact(grid, from, end)).toBe(true);
    }
  });
});
