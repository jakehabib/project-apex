import { MAP_POOL } from '../../src/core/match/maps';
import { buildNav } from '../../src/core/match/maps/nav';
for (const map of MAP_POOL) {
  const nav = buildNav(map);
  const start = map.nodes.find((n) => n.tags.includes('attacker_spawn'))!.id;
  const seen = new Set([start]);
  const st = [start];
  while (st.length) for (const { to } of nav.adjacency.get(st.pop()!)!) if (!seen.has(to)) { seen.add(to); st.push(to); }
  console.log(map.id, map.nodes.filter((n) => !seen.has(n.id)).map((n) => `${n.id}@${Math.floor(n.pos.x / 20)},${Math.floor(n.pos.y / 20)}`).join(' '));
}
