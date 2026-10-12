// Quick balance readout: N maps (alternating maps/sides), key calibration metrics.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
import { emptyTelemetry, ingestMap, wilson, type Ratio } from '../../src/core/calibration/telemetry';
const N = Number(process.argv[2] ?? 40);
const t = emptyTelemetry();
const conv = { ct: { n: 0, d: 0 }, t: { n: 0, d: 0 } };
for (let i = 0; i < N; i++) {
  const r = simulateMap({ matchId: 'b', mapIndex: 0, seed: `bal-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('a', 60, `r${i % 25}`), syntheticTeam('b', 60, `s${i % 25}`)], firstAttacker: ((i >> 1) % 2) as 0 | 1 });
  ingestMap(t, r.events);
  const team = new Map<string, number>();
  let att = 0; let open: boolean | null = null; let full = false;
  for (const e of r.events) {
    if (e.type === 'spawn') team.set(e.playerId, e.team);
    if (e.type === 'round_start') { att = e.attackerTeam; open = null; full = e.buyTypes[0] === 'full' && e.buyTypes[1] === 'full'; }
    if (e.type === 'kill' && open === null) open = team.get(e.attackerId) === att;
    if (e.type === 'round_end' && full && open !== null) { const c = open ? conv.t : conv.ct; c.d++; if ((e.winnerTeam === att) === open) c.n++; }
  }
}
const pct = (x: Ratio) => `${wilson(x).pct.toFixed(1)}%`;
const agg = (k: 'ctRoundWins' | 'plantRate' | 'ctWinAfterPlant' | 'pistolCtWin') => Object.values(t.byMap).reduce((s, m) => ({ n: s.n + m[k].n, d: s.d + m[k].d }), { n: 0, d: 0 });
console.log(`rounds ${t.rounds} | CT ${pct(agg('ctRoundWins'))} (52) | plant ${pct(agg('plantRate'))} (54) | CT after plant ${pct(agg('ctWinAfterPlant'))} (23) | pistol CT ${pct(agg('pistolCtWin'))} (50) | conv CT ${pct(conv.ct)} T ${pct(conv.t)} (75/70)`);
