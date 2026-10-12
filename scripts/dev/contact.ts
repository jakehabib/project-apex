import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { buildGrid, calloutAt } from '../../src/core/match/maps/grid';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const map = MAP_POOL.find((m) => m.id === (process.argv[2] ?? 'harbor'))!;
const grid = buildGrid(map);
const r = simulateMap({ matchId: 'd', mapIndex: 0, seed: 'contact', map, ruleset: MR12_STANDARD, teams: [syntheticTeam('ta', 60, 'a'), syntheticTeam('tb', 60, 'b')], firstAttacker: 0 });
const counts: Record<string, number> = {};
let seenRound = -1;
for (const e of r.events) {
  if (e.type === 'spotted' && e.roundIndex !== seenRound && e.tMs < 8000) {
    seenRound = e.roundIndex;
    const k = `${calloutAt(map, grid, e.observerPos)} -> ${calloutAt(map, grid, e.targetPos)}`;
    counts[k] = (counts[k] ?? 0) + 1;
  }
}
console.log(counts);
