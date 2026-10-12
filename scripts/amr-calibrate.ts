// Runs N engine maps and reports population means of AMR raw rates (to set AMR_CONFIG.ref) and the AMR distribution.
import { syntheticTeam } from '../src/core/match/engine/fixtures';
import { simulateMap } from '../src/core/match/engine/match';
import { MAP_POOL } from '../src/core/match/maps';
import { MR12_STANDARD } from '../src/core/match/rules/ruleset';
import { amrFromTotals, computeAmr, emptyTotals, addTotals } from '../src/core/match/stats/amr';
const N = Number(process.argv[2] ?? 40);
const all = emptyTotals();
const perf: { amr: number; role: string; k: number; d: number; adr: number; won: boolean; swing: number }[] = [];
for (let i = 0; i < N; i++) {
  const teams = [syntheticTeam('ta', 50 + (i % 5) * 5, `c${i}`), syntheticTeam('tb', 60, `d${i}`)] as const;
  const r = simulateMap({ matchId: 'amr', mapIndex: 0, seed: `amr-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD, teams: [teams[0], teams[1]], firstAttacker: (i % 2) as 0 | 1 });
  const roles = new Map(teams.flatMap((t) => t.players.map((p) => [p.id, p.roles[0]!] as const)));
  const end = r.events.find((e) => e.type === 'map_end');
  for (const p of computeAmr(r.events).values()) {
    addTotals(all, p.total);
    const b = amrFromTotals(p.total);
    perf.push({ amr: b.amr, role: roles.get(p.playerId) ?? '?', k: p.total.kills, d: p.total.deaths, adr: b.adr, won: !!end && end.type === 'map_end' && end.winnerTeam === p.team, swing: b.swingPerRound });
  }
}
const n = all.rounds;
console.log(`player-maps ${perf.length}, rounds ${n}`);
console.log('raw per-round means → ref:', JSON.stringify({ kill: +(all.adjKills / n).toFixed(3), damage: +(all.adjDamage / n).toFixed(1), survival: +(all.survivalScore / n).toFixed(3), kast: +(all.kastRounds / n).toFixed(3), multi: +(all.multiPoints / n).toFixed(3) }));
const sw = perf.map((p) => p.swing).sort((a, b) => a - b);
console.log('swing/round p10/p50/p90', sw[Math.floor(sw.length * 0.1)], sw[Math.floor(sw.length / 2)], sw[Math.floor(sw.length * 0.9)]);
const a = perf.map((p) => p.amr).sort((x, y) => x - y);
const mean = a.reduce((s, x) => s + x, 0) / a.length;
const sd = Math.sqrt(a.reduce((s, x) => s + (x - mean) ** 2, 0) / a.length);
console.log(`AMR mean ${mean.toFixed(3)} sd ${sd.toFixed(3)} p5 ${a[Math.floor(a.length * 0.05)]} p50 ${a[Math.floor(a.length / 2)]} p95 ${a[Math.floor(a.length * 0.95)]} max ${a[a.length - 1]}`);
const by = new Map<string, number[]>();
for (const p of perf) by.set(p.role, [...(by.get(p.role) ?? []), p.amr]);
console.log('by role:', [...by].map(([k, v]) => `${k} ${(v.reduce((s, x) => s + x, 0) / v.length).toFixed(2)}`).join(', '));
const w = perf.filter((p) => p.won).map((p) => p.amr);
const l = perf.filter((p) => !p.won).map((p) => p.amr);
console.log(`winners ${(w.reduce((s, x) => s + x, 0) / w.length).toFixed(2)} vs losers ${(l.reduce((s, x) => s + x, 0) / l.length).toFixed(2)}`);
