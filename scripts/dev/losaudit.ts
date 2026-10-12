import { MAP_POOL } from '../../src/core/match/maps';
import { buildGrid, hasLineOfSight } from '../../src/core/match/maps/grid';
for (const map of MAP_POOL) {
  const g = buildGrid(map);
  const P = (id: string) => map.nodes.find((n) => n.id === id)!.pos;
  const s = map.strategy;
  const out: string[] = [];
  for (const site of ['A', 'B'] as const) {
    for (const r of s.sites[site].routes) for (const a of [...s.sites.A.ctAnchors, ...s.sites.B.ctAnchors, ...s.midHolds]) if (hasLineOfSight(g, P(r.stage), P(a))) out.push(`stage ${r.stage} sees CT ${a}`);
  }
  for (const t of [...s.tControl, ...s.lurks]) for (const a of [...s.sites.A.ctAnchors, ...s.sites.B.ctAnchors, ...s.midHolds]) if (hasLineOfSight(g, P(t), P(a))) out.push(`T control ${t} sees CT ${a}`);
  console.log(map.id, out);
}
