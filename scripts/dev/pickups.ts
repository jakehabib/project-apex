// Pick-up audit: what survivors take after rounds, by side and item.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const tally = new Map<string, number>();
for (let i = 0; i < 20; i++) {
  const r = simulateMap({ matchId: 'p', mapIndex: 0, seed: `pk-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('a', 60, `a${i}`), syntheticTeam('b', 60, `b${i}`)], firstAttacker: (i % 2) as 0 | 1 });
  const side = new Map<string, string>();
  const held = new Map<string, string | null>();
  for (const e of r.events) {
    if (e.type === 'spawn') side.set(e.playerId, e.side);
    if (e.type === 'loadout') for (const l of e.loadouts) held.set(l.playerId, l.primary);
    if (e.type === 'pickup' || (e.type === 'drop' && e.tMs > 0)) {
      const who = e.type === 'pickup' ? e.playerId : e.toPlayerId;
      const k = `${side.get(who)} ${e.type} ${e.itemId}${e.type === 'pickup' ? ` (had ${held.get(who) ?? 'pistol'})` : ''}`;
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
  }
}
for (const [k, v] of [...tally].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(4), k);
