// Bundles and runs a TypeScript dev script: node scripts/dev/run.mjs <file.ts> [...args]
import { build } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const [file, ...rest] = process.argv.slice(2);
const out = join(mkdtempSync(join(tmpdir(), 'apex-dev-')), 'script.mjs');
await build({ entryPoints: [file], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' });
process.exit(spawnSync(process.execPath, [out, ...rest], { stdio: 'inherit' }).status ?? 1);
