import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { buildTracks, positionAt } from '../../src/core/match/replay/positions';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const r = simulateMap({ matchId: 'p', mapIndex: 0, seed: 'parity-0', map: MAP_POOL[0]!, ruleset: MR12_STANDARD, teams: [syntheticTeam('a', 62, 'a'), syntheticTeam('b', 62, 'b')], firstAttacker: 0 });
for (const ri of new Set(r.events.map((e) => e.roundIndex))) {
  const tracks = buildTracks(r.events, ri);
  for (const e of r.events) {
    if (e.roundIndex !== ri || e.type !== 'spotted') continue;
    for (const [id, p] of [[e.observerId, e.observerPos], [e.targetId, e.targetPos]] as const) {
      const q = positionAt(tracks.get(id)!, e.tMs);
      if (Math.hypot(q.x - p.x, q.y - p.y) > 1e-6) {
        console.log('round', ri, 'mismatch', id, e.tMs, p, q);
        for (const x of r.events) if (x.roundIndex === ri && 'playerId' in x && (x as { playerId: string }).playerId === id && Math.abs(x.tMs - e.tMs) < 1500) console.log('  ', x.type, x.tMs, JSON.stringify(x).slice(0, 160));
        process.exit(0);
      }
    }
  }
}
