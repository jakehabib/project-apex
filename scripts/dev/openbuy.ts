// Opening-kill side and round winner by buy matchup.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const N = Number(process.argv[2] ?? 20);
const c: Record<string, [number, number, number]> = {};
const conv: Record<string, [number, number]> = {};
for (let i = 0; i < N; i++) {
  const r = simulateMap({
    matchId: 'd', mapIndex: 0, seed: `ob-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('ta', 60, `r${i % 25}`), syntheticTeam('tb', 60, `r${i % 25}`)], firstAttacker: (i % 2) as 0 | 1,
  });
  const team = new Map<string, number>();
  for (const e of r.events) if (e.type === 'spawn') team.set(e.playerId, e.team);
  let rs: any = null;
  let opened = false;
  let openT = false;
  for (const e of r.events) {
    if (e.type === 'round_start') { rs = e; opened = false; }
    if (e.type === 'kill' && !opened) { opened = true; openT = team.get(e.attackerId) === rs.attackerTeam; }
    if (e.type === 'round_end') {
      const att = rs.attackerTeam;
      const k = `T ${rs.buyTypes[att]} vs CT ${rs.buyTypes[1 - att]}`;
      const g = (c[k] ??= [0, 0, 0]);
      g[0]++; if (openT) g[1]++; if (e.winnerTeam === att) g[2]++;
      if (rs.buyTypes[att] === 'full' && rs.buyTypes[1 - att] === 'full' && opened) { const kk = openT ? 'T opening' : 'CT opening'; const cv = (conv[kk] ??= [0, 0]); cv[0]++; if ((e.winnerTeam === att) === openT) cv[1]++; }
    }
  }
}
for (const [k, g] of Object.entries(c).sort((x, y) => y[1][0] - x[1][0])) console.log(k.padEnd(30), 'n', String(g[0]).padStart(4), 'T opening', (g[1] / g[0]).toFixed(2), 'T win', (g[2] / g[0]).toFixed(2));

for (const [k, v] of Object.entries(conv)) console.log(`full v full, ${k}: converted ${(v[1] / v[0]).toFixed(2)} (n ${v[0]})`);
