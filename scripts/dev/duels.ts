// Opening duel breakdown by state of killer and victim.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const counts: Record<string, number> = {};
const N = Number(process.argv[2] ?? 30);
for (let i = 0; i < N; i++) {
  let lastRound = -1;
  let firstDone = false;
  const r = simulateMap({
    matchId: 'd', mapIndex: 0, seed: `duel-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('ta', 60, `r${i % 25}`), syntheticTeam('tb', 60, `r${i % 25}`)], firstAttacker: (i % 2) as 0 | 1,
    trace: (kind, d) => {
      if (kind !== 'kill') return;
      const a = d.attacker as Record<string, unknown>;
      const v = d.victim as Record<string, unknown>;
      const t = d.t as number;
      // round boundary detection via time reset
      if (t < lastRound) firstDone = false;
      lastRound = t;
      if (firstDone) return;
      firstDone = true;
      const key = `${a.side}(${a.task}${a.moving ? ',moving' : ''}) kills ${v.side}(${v.task}${v.moving ? ',moving' : ''}${v.blind ? ',blind' : ''}${d.victimTarget ? ',engaged' : ',unaware'})`;
      counts[key] = (counts[key] ?? 0) + 1;
    },
  });
  void r;
}
for (const [k, v] of Object.entries(counts).sort((x, y) => y[1] - x[1]).slice(0, 25)) console.log(v, k);
