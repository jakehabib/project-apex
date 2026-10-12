// Statistical calibration run: npm run sim:calibrate -- [rounds=100000] [--seed=holdout]
// Simulates at least the requested number of rounds across worker threads, measures
// telemetry with the independent analyzer, compares with the benchmark pack and flags
// significant deviations. Writes reports/calibration/{report.md,telemetry.json}.
import { build } from 'esbuild';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

const args = process.argv.slice(2);
const targetRounds = Number(args.find((a) => /^\d+$/.test(a)) ?? 100000);
const seedBase = args.find((a) => a.startsWith('--seed='))?.slice(7) ?? 'calibration';
const dir = mkdtempSync(join(tmpdir(), 'apex-cal-'));
const worker = join(dir, 'w.mjs');
const lib = join(dir, 'lib.mjs');
await build({ entryPoints: ['scripts/calibrate-worker-entry.ts'], bundle: true, format: 'esm', platform: 'node', outfile: worker, logLevel: 'error' });
await build({
  stdin: { contents: `export * from './src/core/calibration/telemetry';\nexport * from './src/core/calibration/compare';\nexport * from './src/core/calibration/benchmarks';`, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: lib, logLevel: 'error',
});
const { emptyTelemetry, mergeTelemetry, compare, wilson, DATASET_ID } = await import(lib);

const mapsNeeded = Math.ceil(targetRounds / 21);
const threads = Math.max(1, availableParallelism());
const chunk = 25;
let next = 0;
let total = emptyTelemetry();
let violations = 0;
const t0 = performance.now();
await new Promise((resolve, reject) => {
  let active = 0;
  for (let k = 0; k < threads; k++) {
    const w = new Worker(worker);
    active++;
    const feed = () => {
      if (next >= mapsNeeded) return w.postMessage(null);
      const from = next;
      next = Math.min(mapsNeeded, next + chunk);
      w.postMessage({ from, to: next, seedBase, check: 20 });
    };
    w.on('message', (m) => {
      total = mergeTelemetry(total, m.t);
      violations += m.violations;
      process.stdout.write(`\r${total.rounds} rounds / ${total.maps} maps`);
      feed();
    });
    w.on('error', reject);
    w.on('exit', () => --active === 0 && resolve());
    feed();
  }
});
const secs = (performance.now() - t0) / 1000;
rmSync(dir, { recursive: true, force: true });

const rows = compare(total);
const fmt = (x) => (Number.isFinite(x) ? x.toFixed(1) : '–');
const icon = { ok: '✅ ok', watch: '🟡 watch', deviation: '❌ deviation', insufficient: '⚪ n/a', 'hypothesis-in': '🔵 in soft range', 'hypothesis-out': '🟠 outside soft range' };
const L = [];
L.push('# Simulation calibration report', '');
L.push(`Dataset \`${DATASET_ID}\` · ${total.rounds.toLocaleString()} rounds · ${total.maps.toLocaleString()} maps · seed \`${seedBase}\` · ${secs.toFixed(0)} s on ${threads} threads · invariant violations: ${violations} (checked every 20th map)`, '');
L.push('Targets are aggregate goals for the event simulation, never per-round dice. **deviation** = 95% CI entirely outside the tolerance band; **watch** = point estimate outside but CI overlaps. Hypotheses are reported against soft bounds and never gate the build.', '');
for (const group of [['Map side balance (design targets)', (b) => b.provenance === 'design'], ['Measured benchmarks', (b) => b.provenance === 'measured' || b.provenance === 'derived'], ['Unverified man-advantage hypotheses', (b) => b.provenance === 'hypothesis']]) {
  L.push(`## ${group[0]}`, '', '| Metric | Sim | 95% CI | Target ± tol | Sample | Status |', '|---|---|---|---|---|---|');
  for (const r of rows.filter((x) => group[1](x.benchmark))) {
    const tgt = r.benchmark.soft ? `${r.benchmark.target} (soft ${r.benchmark.soft[0]}–${r.benchmark.soft[1]})` : `${r.benchmark.target} ± ${r.benchmark.tolerance}`;
    L.push(`| ${r.benchmark.label} | ${fmt(r.value)}% | ${fmt(r.lo)}–${fmt(r.hi)} | ${tgt} | ${r.n}/${r.d} | ${icon[r.status]} |`);
  }
  L.push('');
}
L.push('## Per-map detail', '', '| Map | Rounds | CT round share | Plant rate | CT win after plant | Opening conversion | Pistol CT | OT |', '|---|---|---|---|---|---|---|---|');
for (const [id, m] of Object.entries(total.byMap)) {
  L.push(`| ${id} | ${m.rounds} | ${fmt(wilson(m.ctRoundWins).pct)}% | ${fmt(wilson(m.plantRate).pct)}% | ${fmt(wilson(m.ctWinAfterPlant).pct)}% | ${fmt(wilson(m.openingConversion).pct)}% | ${fmt(wilson(m.pistolCtWin).pct)}% | ${fmt(wilson(m.overtime).pct)}% |`);
}
L.push('', '## Buy matchups (team tier vs opponent tier → team won)', '', '| Matchup | Win % | Sample |', '|---|---|---|');
for (const [k, v] of Object.entries(total.buyMatchups).sort()) L.push(`| ${k.replace('>', ' vs ')} | ${fmt(wilson(v).pct)}% | ${v.d} |`);
L.push('', '## Round end reasons', '', ...Object.entries(total.roundEndReasons).map(([k, v]) => `- ${k}: ${((v / total.rounds) * 100).toFixed(1)}%`));
L.push('', `Avg rounds per map ${(total.avgRoundsPerMap.sum / total.avgRoundsPerMap.count).toFixed(1)} · trade kills ${((total.tradeKills / total.kills) * 100).toFixed(1)}% of kills · avg CT deaths in successful retakes ${(total.retakeCtDeaths.sum / Math.max(1, total.retakeCtDeaths.count)).toFixed(2)} (pro: 2.85)`);

mkdirSync('reports/calibration', { recursive: true });
writeFileSync('reports/calibration/report.md', L.join('\n') + '\n');
writeFileSync('reports/calibration/telemetry.json', JSON.stringify({ dataset: DATASET_ID, seedBase, secs, violations, telemetry: total, rows }, null, 1));
console.log('\n' + L.join('\n'));
const failed = rows.filter((r) => r.status === 'deviation').length;
console.log(`\n${failed} significant deviation(s); ${violations} invariant violation(s).`);
process.exit(violations > 0 ? 2 : 0);
