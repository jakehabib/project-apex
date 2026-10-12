// Save behaviour by situation: how often a side calls a save, and round outcomes.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const N = Number(process.argv[2] ?? 20);
const sit: Record<string, { checks: number; saves: number; p: number }> = {};
let rounds = 0, saveRounds = 0, ctSaves = 0, tSaves = 0;
for (let i = 0; i < N; i++) {
  let pending: { key: string; team: number } | null = null;
  const r = simulateMap({ matchId: 'd', mapIndex: 0, seed: `sv-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('ta', 60, `r${i % 25}`), syntheticTeam('tb', 60, `r${i % 25}`)], firstAttacker: (i % 2) as 0 | 1,
    trace: (kind, d) => {
      if (kind !== 'save_check') return;
      const key = `${d.attacking ? 'T' : 'CT'} ${d.alive}v${d.enemies}${d.planted ? ' planted' : ''}`;
      const g = (sit[key] ??= { checks: 0, saves: 0, p: 0 }); g.checks++; g.p += d.p as number; if ((d.p as number) < (d.threshold as number)) g.saves++;
      pending = { key, team: d.team as number };
    } });
  void pending;
  let saved = new Set<number>();
  const team = new Map<string, number>();
  let att = 0;
  for (const e of r.events) {
    if (e.type === 'spawn') team.set(e.playerId, e.team);
    if (e.type === 'round_start') { rounds++; saved = new Set(); att = e.attackerTeam; }
    if (e.type === 'call' && e.text === 'Save') { saved.add(e.team); if (e.team === att) tSaves++; else ctSaves++; }
    if (e.type === 'round_end' && saved.size) saveRounds++;
  }
}
console.log(`rounds ${rounds}, rounds with a save call ${saveRounds} (${(saveRounds / rounds * 100).toFixed(1)}%), CT save calls ${ctSaves}, T save calls ${tSaves}`);
for (const [k, v] of Object.entries(sit).sort((a, b) => b[1].saves - a[1].saves).slice(0, 20)) console.log(k.padEnd(22), 'evaluated', v.checks, 'below threshold', v.saves, 'avg p', (v.p / v.checks).toFixed(2));
