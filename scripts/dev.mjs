// Development launcher: Vite dev server (HMR) + Electron pointed at it.
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'vite';

const require = createRequire(import.meta.url);
const electronPath = require('electron');

await import('./build-electron.mjs');
const server = await createServer({ configFile: 'vite.config.ts' });
await server.listen();
const url = server.resolvedUrls?.local[0] ?? 'http://localhost:5173/';
console.log(`renderer dev server: ${url}`);

const args = ['.'];
if (process.getuid?.() === 0) args.push('--no-sandbox'); // containers running as root only
const child = spawn(electronPath, args, { stdio: 'inherit', env: { ...process.env, VITE_DEV_SERVER_URL: url } });
child.on('exit', async (code) => {
  await server.close();
  process.exit(code ?? 0);
});
