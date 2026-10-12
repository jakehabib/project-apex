import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const counts: Record<string, number> = {};
const ends: Record<string, number> = {};
for (let i = 0; i < 30; i++) {
  let planted = false;
  const r = simulateMap({
    matchId: 'd', mapIndex: 0, seed: `rt-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('ta', 60, `r${i}`), syntheticTeam('tb', 60, `r${i}`)], firstAttacker: (i % 2) as 0 | 1,
    trace: (kind, d) => {
      if (kind === 'plant') planted = true;
      if (kind === 'kill' && (d.t as number) < 1000) planted = false;
      if (kind !== 'kill' || !planted) return;
      const a = d.attacker as Record<string, unknown>;
      const v = d.victim as Record<string, unknown>;
      const k = `${a.side}(${a.task}${a.moving ? ',moving' : ''}) kills ${v.side}(${v.task}${v.moving ? ',moving' : ''}${v.blind ? ',blind' : ''}${d.victimTarget ? '' : ',unaware'})`;
      counts[k] = (counts[k] ?? 0) + 1;
    },
  });
  let p2 = false;
  for (const e of r.events) {
    if (e.type === 'round_start') p2 = false;
    if (e.type === 'plant') p2 = true;
    if (e.type === 'round_end' && p2) ends[e.reason] = (ends[e.reason] ?? 0) + 1;
  }
}
console.log(ends);
for (const [k, v] of Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 16)) console.log(v, k);
