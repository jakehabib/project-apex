// Batch balance harness: npm run sim:balance -- [mapsPerCell=200] [--quick]
// Runs scenario matrices across worker threads and writes reports/balance/{report.md,summary.json}.
import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

const args = process.argv.slice(2);
const N = Number(args.find((a) => /^\d+$/.test(a)) ?? 200);
const only = args.find((a) => a.startsWith('--only='))?.slice(7);
const dir = mkdtempSync(join(tmpdir(), 'apex-balance-'));
const bundle = join(dir, 'balance-core.mjs');
await build({
  entryPoints: ['scripts/balance-worker-entry.ts'],
  bundle: true,
  format: 'esm',
  platform: 'node',
  outfile: bundle,
  logLevel: 'error',
});

/** Scenario cells: each runs N maps alternating map and first-attacker. */
const cells = [];
const add = (group, label, a, b) => cells.push({ group, label, a, b });
add('equal', 'Equal 60 vs 60 (balanced)', { skill: 60 }, { skill: 60 });
for (const gap of [3, 6, 10, 15]) add('skill', `+${gap} skill`, { skill: 60 + gap / 2 }, { skill: 60 - gap / 2 });
for (const p of ['aggressive', 'methodical', 'utility', 'retake']) add('tactics', `${p} vs balanced`, { skill: 60, preset: p }, { skill: 60 });
add('roles', 'IGL calling 85 vs 35', { skill: 60, mod: { role: 'igl', attr: 'calling', value: 85 } }, { skill: 60, mod: { role: 'igl', attr: 'calling', value: 35 } });
add('roles', 'Coach 85 vs 25', { skill: 60, coach: 85 }, { skill: 60, coach: 25 });
add('roles', 'AWPer awp 88 vs 55', { skill: 60, mod: { role: 'awper', attr: 'awp', value: 88 } }, { skill: 60, mod: { role: 'awper', attr: 'awp', value: 55 } });
add('roles', 'Star rifling 90 vs 62', { skill: 60, mod: { role: 'star', attr: 'rifling', value: 90 } }, { skill: 60, mod: { role: 'star', attr: 'rifling', value: 62 } });
add('roles', 'Anchor positioning 88 vs 45', { skill: 60, mod: { role: 'anchor', attr: 'positioning', value: 88 } }, { skill: 60, mod: { role: 'anchor', attr: 'positioning', value: 45 } });
add('roles', 'Utility 85 vs 40 (all)', { skill: 60, all: { utility: 85 } }, { skill: 60, all: { utility: 40 } });
add('roles', 'Teamwork 85 vs 40 (all)', { skill: 60, all: { teamwork: 85 } }, { skill: 60, all: { teamwork: 40 } });

if (only) {
  const keep = cells.filter((c) => c.group === only || c.group === 'equal');
  cells.length = 0;
  cells.push(...keep);
}
const jobs = [];
for (const [ci, c] of cells.entries()) for (let i = 0; i < N; i++) jobs.push({ ci, i, cell: c });

const threads = Math.max(1, availableParallelism());
const results = cells.map(() => []);
let done = 0;
const t0 = performance.now();
await new Promise((resolve, reject) => {
  let next = 0;
  let active = 0;
  const startWorker = () => {
    const w = new Worker(bundle, { workerData: null });
    active++;
    const feed = () => {
      if (next >= jobs.length) {
        w.postMessage(null);
        return;
      }
      w.postMessage(jobs[next++]);
    };
    w.on('message', (msg) => {
      results[msg.ci].push(msg.r);
      done++;
      if (done % 200 === 0) process.stdout.write(`\r${done}/${jobs.length} maps`);
      feed();
    });
    w.on('error', reject);
    w.on('exit', () => {
      active--;
      if (active === 0) resolve();
    });
    feed();
  };
  for (let i = 0; i < threads; i++) startWorker();
});
const secs = (performance.now() - t0) / 1000;
rmSync(dir, { recursive: true, force: true });

const pct = (x) => `${(x * 100).toFixed(1)}%`;
const ci95 = (p, n) => 1.96 * Math.sqrt((p * (1 - p)) / n);
const summary = cells.map((c, i) => {
  const rs = results[i];
  const n = rs.length;
  const winA = rs.filter((r) => r.winner === 0).length / n;
  const rounds = rs.reduce((s, r) => s + r.rounds, 0);
  const tWins = rs.reduce((s, r) => s + r.tWins, 0);
  const sum = (k) => rs.reduce((s, r) => s + r[k], 0);
  return {
    group: c.group, label: c.label, n, winA, ci: ci95(winA, n),
    tWinRate: tWins / rounds, avgRounds: rounds / n, otRate: rs.filter((r) => r.rounds > 24).length / n,
    avgRoundSec: sum('roundMs') / rounds / 1000, plantRate: sum('plants') / rounds, defuseRate: sum('defuses') / Math.max(1, sum('plants')),
    reasons: Object.fromEntries(['attackers_eliminated', 'defenders_eliminated', 'bomb_detonated', 'bomb_defused', 'time_expired'].map((k) => [k, rs.reduce((s, r) => s + (r.reasons[k] ?? 0), 0) / rounds])),
    buys: Object.fromEntries(['pistol', 'full', 'force', 'eco', 'bonus'].map((k) => [k, rs.reduce((s, r) => s + (r.buys[k] ?? 0), 0) / (rounds * 2)])),
    violations: sum('violations'), checked: sum('checked'), timeouts: sum('timeouts') / n,
    upsets: sum('upsets') / rounds, closeMaps: rs.filter((r) => Math.abs(r.scoreA - r.scoreB) <= 3).length / n,
    kpr: sum('kills') / rounds / 10,
  };
});

const lines = [];
lines.push(`# Balance report`, '', `${N} maps per cell · ${jobs.length} maps · ${secs.toFixed(0)} s on ${threads} threads · engine ${results[0][0]?.engine ?? ''}`, '');
lines.push('Balance *targets* (hypotheses, not empirical CS constants): equal teams ≈ 50% map wins; attack-side round wins 42–55%; skill gaps raise win rate monotonically without certainty; no tactic or single role decides matches.', '');
lines.push('| Scenario | Team A map wins (±95%) | Attack round win | Rounds/map | OT | Avg round | Plants/round | Defuse/plant | Invariant violations |');
lines.push('|---|---|---|---|---|---|---|---|---|');
for (const s of summary) {
  lines.push(`| ${s.label} | ${pct(s.winA)} ±${pct(s.ci)} | ${pct(s.tWinRate)} | ${s.avgRounds.toFixed(1)} | ${pct(s.otRate)} | ${s.avgRoundSec.toFixed(1)} s | ${s.plantRate.toFixed(2)} | ${pct(s.defuseRate)} | ${s.violations}/${s.checked} maps |`);
}
const eq = summary[0];
lines.push('', '## Equal-team round detail', '', '| Round end reason | Share |', '|---|---|');
for (const [k, v] of Object.entries(eq.reasons)) lines.push(`| ${k} | ${pct(v)} |`);
lines.push('', '| Buy type | Share of team-rounds |', '|---|---|');
for (const [k, v] of Object.entries(eq.buys)) lines.push(`| ${k} | ${pct(v)} |`);
lines.push('', `Kills per player-round: ${eq.kpr.toFixed(2)} · Eco/force wins vs full buys: ${pct(eq.upsets)} of rounds · Maps within 3 rounds: ${pct(eq.closeMaps)} · Coach timeouts per map: ${eq.timeouts.toFixed(2)}`);

// Gate checks.
const checks = [];
const skill = summary.filter((s) => s.group === 'skill');
checks.push(['Equal teams within 42–58% map wins', eq.winA > 0.42 && eq.winA < 0.58]);
checks.push(['Attack round win rate 40–56%', eq.tWinRate > 0.4 && eq.tWinRate < 0.56]);
if (skill.length) {
  checks.push(['Skill sweep monotonic (each step ≥ previous − CI)', skill.every((s, i) => i === 0 || s.winA >= skill[i - 1].winA - skill[i - 1].ci)]);
  checks.push(['Biggest skill gap wins more but is not certain (60–97%)', skill.at(-1).winA > 0.6 && skill.at(-1).winA < 0.97]);
}
checks.push(['No tactic preset dominates (30–70%)', summary.filter((s) => s.group === 'tactics').every((s) => s.winA > 0.3 && s.winA < 0.7)]);
checks.push(['Every role/coach upgrade helps on average (> 50%)', summary.filter((s) => s.group === 'roles').every((s) => s.winA > 0.5)]);
checks.push(['No single role/coach upgrade decides matches (< 80%)', summary.filter((s) => s.group === 'roles').every((s) => s.winA < 0.8)]);
checks.push(['Zero invariant violations', summary.every((s) => s.violations === 0)]);
lines.push('', '## Gate checks', '', ...checks.map(([name, ok]) => `- ${ok ? '✅' : '❌'} ${name}`));

mkdirSync('reports/balance', { recursive: true });
writeFileSync('reports/balance/report.md', lines.join('\n') + '\n');
writeFileSync('reports/balance/summary.json', JSON.stringify({ N, secs, summary, checks }, null, 2));
console.log(`\n${lines.join('\n')}`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
