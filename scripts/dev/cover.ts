import { MAP_POOL } from '../../src/core/match/maps';
import { Cell, buildGrid, cellAt } from '../../src/core/match/maps/grid';
for (const map of MAP_POOL) {
  const g = buildGrid(map);
  const P = (id: string) => map.nodes.find((n) => n.id === id)!.pos;
  const rows: string[] = [];
  for (const site of ['A', 'B'] as const) {
    for (const a of map.strategy.sites[site].ctAnchors) {
      const p = P(a);
      let low = false;
      for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 8) for (const k of [14, 26]) if (cellAt(g, { x: p.x + Math.cos(ang) * k, y: p.y + Math.sin(ang) * k }) === Cell.Low) low = true;
      rows.push(`${site}:${a}${low ? '(cover)' : ''}`);
    }
  }
  console.log(map.id, rows.join(' '));
}
