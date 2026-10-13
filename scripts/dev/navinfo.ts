import { MAP_POOL } from '../../src/core/match/maps';
import { buildNav } from '../../src/core/match/maps/nav';
for (const m of MAP_POOL) {
  const nav = buildNav(m);
  const ids = nav.ids;
  const lattice = ids.filter((id) => /^n\d|^g/.test(id) || id.includes('_') === false);
  console.log(m.id, 'nodes', ids.length, 'edges', m.edges.length, 'sample', ids.slice(0, 5).join(','), ids.slice(-5).join(','));
  const n0 = nav.nodes.get(ids[0]!)!; console.log(JSON.stringify(n0));
}
