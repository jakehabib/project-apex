import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const c: Record<string, number> = {};
for (let i = 0; i < 16; i++) simulateMap({ matchId: 'b', mapIndex: 0, seed: `bl-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
  teams: [syntheticTeam('a', 60, `r${i}`), syntheticTeam('b', 60, `s${i}`)], firstAttacker: (i % 2) as 0 | 1,
  trace: (k, d) => { if (k !== 'kill') return; const v = d.victim as { side: string; blind: boolean }; const key = `${v.side} deaths ${v.blind ? 'BLIND' : 'not blind'}`; c[key] = (c[key] ?? 0) + 1; } });
console.log(c);
