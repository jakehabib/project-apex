// How strongly does player skill translate into AMR and wins in the engine? And does a 99 dominate weak opposition?
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
import { amrFromTotals, computeAmr } from '../../src/core/match/stats/amr';
import { generateWorld } from '../../src/core/world/generate';
import { teamSetupFor } from '../../src/core/world/teamSetup';
import { toOvr } from '../../src/core/world/ratings';
const w = generateWorld({ seed: 'impact' });
const ids = MAP_POOL.map((m) => m.id);
const orgs = [...w.orgs.values()];
const skillOf = (pid: string) => w.players.get(pid)!.skill;
const avg = (o: (typeof orgs)[number]) => o.roster.reduce((s, id) => s + skillOf(id), 0) / 5;
// 1) regression of AMR on (player skill - lobby average)
const xs: number[] = []; const ys: number[] = [];
const N = Number(process.argv[2] ?? 30);
for (let i = 0; i < N; i++) {
  const a = orgs[(i * 7) % orgs.length]!; const b = orgs[(i * 13 + 5) % orgs.length]!;
  if (a === b) continue;
  const r = simulateMap({ matchId: 'i', mapIndex: 0, seed: `imp-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD, teams: [teamSetupFor(w, a, ids), teamSetupFor(w, b, ids)], firstAttacker: 0 });
  const lobby = (avg(a) + avg(b)) / 2;
  for (const p of computeAmr(r.events).values()) { xs.push(skillOf(p.playerId) - lobby); ys.push(amrFromTotals(p.total).amr); }
}
const mx = xs.reduce((s, x) => s + x, 0) / xs.length; const my = ys.reduce((s, y) => s + y, 0) / ys.length;
const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i]! - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
console.log(`AMR ≈ ${(my - slope * mx).toFixed(3)} + ${slope.toFixed(4)} × (skill − lobby avg); n=${xs.length}`);
// 2) a generational player joins a weak club and plays weak clubs
const weak = orgs.filter((o) => o.archetype === 'grassroots').slice(0, 6);
const star = [...w.players.values()].sort((x, y) => y.skill - x.skill)[0]!;
const host = weak[0]!;
const run = (label: string) => {
  let wins = 0; const amrs: number[] = []; const starAmr: number[] = [];
  for (let i = 0; i < 12; i++) {
    const opp = weak[1 + (i % 5)]!;
    const r = simulateMap({ matchId: 'g', mapIndex: 0, seed: `gen-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD, teams: [teamSetupFor(w, host, ids), teamSetupFor(w, opp, ids)], firstAttacker: (i % 2) as 0 | 1 });
    if (r.winnerTeam === 0) wins++;
    for (const p of computeAmr(r.events).values()) { if (p.playerId === star.id) starAmr.push(amrFromTotals(p.total).amr); else if (p.team === 0) amrs.push(amrFromTotals(p.total).amr); }
  }
  const m = (a: number[]) => a.length ? (a.reduce((s, x) => s + x, 0) / a.length).toFixed(2) : '–';
  const sr = [...starAmr].sort((a, b) => a - b);
  console.log(`${label}: host wins ${wins}/12, star AMR ${m(starAmr)}${sr.length ? ` (worst map ${sr[0]!.toFixed(2)}, best ${sr[sr.length - 1]!.toFixed(2)})` : ''}, teammates AMR ${m(amrs)}`);
};
run(`${host.name} (avg OVR ${toOvr(avg(host))}) before`);
const out = host.roster.find((id) => w.players.get(id)!.role === star.role) ?? host.roster[0]!;
host.roster = host.roster.map((id) => (id === out ? star.id : id));
run(`after signing ${star.nickname} (${toOvr(star.skill)} OVR ${star.role})`);
