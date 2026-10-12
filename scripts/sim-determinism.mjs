// Headless determinism sweep: every seed is simulated twice in fresh contexts and
// must produce identical fingerprints; also reports throughput.
// Usage: npm run sim:determinism -- [seedCount]
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const count = Number(process.argv[2] ?? 500);
const dir = mkdtempSync(join(tmpdir(), 'apex-sim-'));
const out = join(dir, 'core.mjs');
await build({
  stdin: {
    contents: `export { runMovementProof } from './src/core/match/spike/movementProof';\nexport { HARBOR } from './src/core/match/maps/harbor';`,
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

let mismatches = 0;
const prints = new Set();
const t0 = performance.now();
for (let i = 0; i < count; i++) {
  const seed = `sweep-${i}`;
  const r1 = a.runMovementProof({ seed, map: a.HARBOR });
  const r2 = b.runMovementProof({ seed, map: b.HARBOR });
  if (r1.fingerprint !== r2.fingerprint) {
    mismatches++;
    console.error(`MISMATCH seed=${seed}`);
  }
  prints.add(r1.fingerprint);
}
const ms = performance.now() - t0;
rmSync(dir, { recursive: true, force: true });
console.log(`seeds: ${count} | mismatches: ${mismatches} | distinct outcomes: ${prints.size} | ${(ms / (count * 2)).toFixed(2)} ms per 45 s sim`);
process.exit(mismatches === 0 && prints.size === count ? 0 : 1);
