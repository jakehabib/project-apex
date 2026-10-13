// Map audit: which attacker staging/control spots are visible from defender holding positions.
import { MAP_POOL } from '../../src/core/match/maps';
import { buildNav, node } from '../../src/core/match/maps/nav';
import { hasLineOfSight } from '../../src/core/match/maps/grid';
for (const m of MAP_POOL) {
  const nav = buildNav(m);
  const s = m.strategy;
  const ctSpots = [...new Set([...s.sites.A.ctAnchors, ...s.sites.B.ctAnchors, ...s.midHolds, ...s.ctInfo, ...s.sites.A.retakeStage, ...s.sites.B.retakeStage])];
  const tSpots = [...new Set([...s.sites.A.routes.map((r) => r.stage), ...s.sites.B.routes.map((r) => r.stage), ...(s.controls ?? []).flatMap((c) => c.spots), ...s.lurks])];
  console.log(`== ${m.id}`);
  for (const t of tSpots) {
    const tp = node(nav, t).pos;
    const seenBy = ctSpots.filter((c) => { const cp = node(nav, c).pos; return Math.hypot(cp.x - tp.x, cp.y - tp.y) < 2200 && hasLineOfSight(nav.grid, cp, tp); });
    console.log(`${t.padEnd(14)} ${seenBy.length ? 'EXPOSED to ' + seenBy.join(', ') : 'safe'}`);
  }
}
