// Headless determinism sweep on the real engine: every seed is simulated as a full map
// in two independent module instances and must produce identical fingerprints.
// Usage: npm run sim:determinism -- [seedCount=40]
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const count = Number(process.argv[2] ?? 40);
const dir = mkdtempSync(join(tmpdir(), 'apex-sim-'));
const out = join(dir, 'core.mjs');
await build({
  stdin: {
    contents: [
      "export { simulateMap } from './src/core/match/engine/match';",
      "export { syntheticTeam } from './src/core/match/engine/fixtures';",
      "export { MAP_POOL } from './src/core/match/maps';",
      "export { MR12_STANDARD } from './src/core/match/rules/ruleset';",
    ].join('\n'),
    resolveDir: process.cwd(),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  outfile: out,
  logLevel: 'error',
});
const load = async (tag) => import(`${pathToFileURL(out).href}?ctx=${tag}`);
const [a, b] = await Promise.all([load('a'), load('b')]);
const run = (lib, i) =>
  lib.simulateMap({
    matchId: `det-${i}`, mapIndex: 0, seed: `sweep-${i}`, map: lib.MAP_POOL[i % lib.MAP_POOL.length], ruleset: lib.MR12_STANDARD,
    teams: [lib.syntheticTeam('da', 60, `s${i}a`), lib.syntheticTeam('db', 60, `s${i}b`)], firstAttacker: i % 2,
  });

let mismatches = 0;
const prints = new Set();
const t0 = performance.now();
for (let i = 0; i < count; i++) {
  const r1 = run(a, i);
  const r2 = run(b, i);
  if (r1.fingerprint !== r2.fingerprint) {
    mismatches++;
    console.error(`MISMATCH seed=sweep-${i}`);
  }
  prints.add(r1.fingerprint);
}
const ms = performance.now() - t0;
rmSync(dir, { recursive: true, force: true });
console.log(`maps: ${count} | mismatches: ${mismatches} | distinct outcomes: ${prints.size} | ${(ms / (count * 2)).toFixed(0)} ms per full map`);
process.exit(mismatches === 0 && prints.size === count ? 0 : 1);
