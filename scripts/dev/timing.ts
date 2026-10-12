import { MAP_POOL } from '../../src/core/match/maps';
import { buildNav, findPath, nodesWithTag, pathLength } from '../../src/core/match/maps/nav';
for (const map of MAP_POOL) {
  const nav = buildNav(map);
  const t = nodesWithTag(nav, 'attacker_spawn')[0]!.id;
  const c = nodesWithTag(nav, 'defender_spawn')[0]!.id;
  const sec = (a: string, b: string) => (pathLength(nav, findPath(nav, a, b)!) / 43).toFixed(1);
  for (const site of ['A', 'B'] as const) {
    const st = map.strategy.sites[site];
    console.log(map.id, site, 'CT->anchors', st.ctAnchors.map((a) => sec(c, a)).join('/'), '| T->entries', st.routes.map((r) => `${r.id}:${sec(t, r.entry)}`).join(' '));
  }
  console.log(map.id, 'CT->mid', map.strategy.midHolds.map((m) => sec(c, m)).join('/'), '| A<->B CT rotate', sec(map.strategy.sites.A.ctAnchors[0]!, map.strategy.sites.B.ctAnchors[0]!));
}
