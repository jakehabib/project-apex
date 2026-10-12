import { MAP_POOL } from '../../src/core/match/maps';
import { buildGrid, hasLineOfSight } from '../../src/core/match/maps/grid';
const map = MAP_POOL.find((m) => m.id === (process.argv[2] ?? 'switchyard'))!;
const g = buildGrid(map);
for (const a of map.nodes.filter((n) => n.site === 'A')) for (const b of map.nodes.filter((n) => n.site === 'B')) if (hasLineOfSight(g, a.pos, b.pos)) console.log(a.id, b.id);
