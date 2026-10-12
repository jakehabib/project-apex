import { syntheticTeam } from '/home/user/project-apex/src/core/match/engine/fixtures';
import { simulateMap } from '/home/user/project-apex/src/core/match/engine/match';
import { MAP_POOL } from '/home/user/project-apex/src/core/match/maps';
import { MR12_STANDARD } from '/home/user/project-apex/src/core/match/rules/ruleset';
const t0 = performance.now(); let rounds = 0;
for (let i = 0; i < 10; i++) rounds += simulateMap({ matchId: 's', mapIndex: 0, seed: `sp-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD, teams: [syntheticTeam('a', 60, 'x'), syntheticTeam('b', 60, 'y')], firstAttacker: 0 }).rounds.length;
console.log('ms/map', ((performance.now() - t0) / 10).toFixed(0), 'rounds', rounds / 10); 
