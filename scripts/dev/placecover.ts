// Proposes low-cover crates in front of each CT anchor without breaking any nav edge.
import { MAP_POOL } from '../../src/core/match/maps';
import { buildGrid, isWalkableSegment, isWalkable } from '../../src/core/match/maps/grid';
import { rect, type MapDefinition } from '../../src/core/match/maps/types';
for (const map of MAP_POOL) {
  const P = (id: string) => map.nodes.find((n) => n.id === id)!.pos;
  let current: MapDefinition = map;
  const added: string[] = [];
  for (const site of ['A', 'B'] as const) {
    const st = map.strategy.sites[site];
    for (const a of st.ctAnchors) {
      const p = P(a);
      const entries = st.routes.map((r) => P(r.entry)).sort((x, y) => Math.hypot(x.x - p.x, x.y - p.y) - Math.hypot(y.x - p.x, y.y - p.y));
      const e = entries[0]!;
      const base = Math.atan2(e.y - p.y, e.x - p.x);
      let placed = false;
      for (const dAng of [0, 0.35, -0.35, 0.7, -0.7]) {
        for (const dist of [22, 26]) {
          const cx = p.x + Math.cos(base + dAng) * dist;
          const cy = p.y + Math.sin(base + dAng) * dist;
          const ob = { id: `cover_${a}`, kind: 'low' as const, polygon: rect(Math.round(cx - 12), Math.round(cy - 12), 24, 24) };
          const trial: MapDefinition = { ...current, id: `${map.id}-trial-${a}-${dAng}-${dist}`, obstacles: [...current.obstacles, ob] };
          const g = buildGrid(trial);
          const ok = trial.nodes.every((n) => isWalkable(g, n.pos)) && trial.edges.every((ed) => isWalkableSegment(g, P(ed.a), P(ed.b)));
          if (ok) {
            current = trial;
            added.push(`    { id: 'cover_${a}', kind: 'low', polygon: rect(${Math.round(cx - 12)}, ${Math.round(cy - 12)}, 24, 24) },`);
            placed = true;
            break;
          }
        }
        if (placed) break;
      }
      if (!placed) added.push(`    // no legal cover for ${a}`);
    }
  }
  console.log(`// ${map.id}\n${added.join('\n')}`);
}
