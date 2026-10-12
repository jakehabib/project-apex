import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { buildGrid, calloutAt } from '../../src/core/match/maps/grid';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const map = MAP_POOL[0]!;
const grid = buildGrid(map);
let shown = 0;
simulateMap({
  matchId: 'd', mapIndex: 0, seed: 'fight', map, ruleset: MR12_STANDARD, teams: [syntheticTeam('ta', 60, 'a'), syntheticTeam('tb', 60, 'b')], firstAttacker: 0,
  trace: (kind, d) => {
    if (kind !== 'kill' || shown > 8) return;
    const v = d.victim as Record<string, unknown>;
    const a = d.attacker as Record<string, unknown>;
    shown++;
    console.log(`t=${d.t} ${a.id}[${a.side},${a.role},${a.task},w=${a.weapon},moving=${a.moving},ready=${a.readyAt}] -> ${v.id}[${v.side},${v.role},${v.task},w=${v.weapon},moving=${v.moving},blind=${v.blind},target=${d.victimTarget},ready=${v.readyAt}]`);
  },
}).events.filter((e) => e.type === 'kill').slice(0, 9).forEach((e) => e.type === 'kill' && console.log('  at', calloutAt(map, grid, e.victimPos), JSON.stringify(e.victimPos)));
