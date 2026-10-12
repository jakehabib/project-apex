import { describe, expect, it } from 'vitest';
import { Cell, buildGrid, cellAt, hasLineOfSight, isWalkable, isWalkableSegment, siteAt } from '../../src/core/match/maps/grid';
import { HARBOR } from '../../src/core/match/maps/harbor';
import { buildNav, findPath, nodesWithTag, pathLength } from '../../src/core/match/maps/nav';

const MAPS = [HARBOR];

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
