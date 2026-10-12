import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const c: Record<string, number> = {};
let rounds = 0;
for (let i = 0; i < 16; i++) {
  const r = simulateMap({ matchId: 'b', mapIndex: 0, seed: `ut-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('a', 60, `r${i}`), syntheticTeam('b', 60, `s${i}`)], firstAttacker: (i % 2) as 0 | 1 });
  const side = new Map<string, string>();
  for (const e of r.events) {
    if (e.type === 'round_start') rounds++;
    if (e.type === 'spawn') side.set(e.playerId, e.side);
    if (e.type === 'utility') c[`${side.get(e.playerId)} ${e.utility}`] = (c[`${side.get(e.playerId)} ${e.utility}`] ?? 0) + 1;
    if (e.type === 'buy') for (const it of e.items) if (['smoke', 'flash', 'frag', 'cinder', 'ember'].includes(it)) c[`bought ${side.get(e.playerId)} ${it}`] = (c[`bought ${side.get(e.playerId)} ${it}`] ?? 0) + 1;
  }
}
for (const [k, v] of Object.entries(c).sort()) console.log(k.padEnd(28), (v / rounds).toFixed(2), 'per round');
