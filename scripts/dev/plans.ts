import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const c: Record<string, [number, number, number]> = {};
for (let i = 0; i < 30; i++) {
  const r = simulateMap({ matchId: 'b', mapIndex: 0, seed: `pl-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('a', 60, `r${i % 25}`), syntheticTeam('b', 60, `s${i % 25}`)], firstAttacker: ((i >> 1) % 2) as 0 | 1 });
  let att = 0; let plan = ''; let planted = false; let full = false;
  for (const e of r.events) {
    if (e.type === 'round_start') { att = e.attackerTeam; plan = e.plan.split(' ')[0]!; planted = false; full = e.buyTypes[0] === 'full' && e.buyTypes[1] === 'full'; }
    if (e.type === 'plant') planted = true;
    if (e.type === 'round_end' && full) { const g = (c[plan] ??= [0, 0, 0]); g[0]++; if (e.winnerTeam === att) g[1]++; if (planted) g[2]++; }
  }
}
for (const [k, g] of Object.entries(c)) console.log(k.padEnd(10), 'n', g[0], 'T win', (g[1] / g[0]).toFixed(2), 'plant', (g[2] / g[0]).toFixed(2));
