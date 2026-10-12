// npm run sim:career -- [seasons=20] [seed=career-1]
// Multi-season ecosystem validation (validation-only strength resolver). Writes reports/career-validation.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { advanceTo, createEcosystem } from '../src/core/competition/ecosystem';
import { quickResolver } from '../src/core/competition/quickResolver';
import { reportMarkdown, sampleSeason, validate, type SeasonSample } from '../src/core/competition/validation';
import { dayOf } from '../src/core/world/calendar';
import { generateWorld } from '../src/core/world/generate';

const seasons = Number(process.argv[2] ?? 20);
const seed = process.argv[3] ?? 'career-1';
const featured = JSON.parse(readFileSync('src/shared/art/world.json', 'utf8'));
const arche: Record<string, string> = { northwind: 'elite', hollowcrown: 'elite', redkite: 'contender', ironvale: 'contender', sunline: 'contender', obsidiantide: 'contender', polararc: 'developing', atlasunion: 'developing' };
const t0 = performance.now();
const world = generateWorld({ seed, featured: { teams: featured.teams.map((t: { id: string }) => ({ ...t, archetype: arche[t.id] })), players: featured.players } });
const eco = createEcosystem(world, quickResolver(world, seed), dayOf(0, 0, 1) - 1);
const history: SeasonSample[] = [];
for (let s = 0; s <= seasons; s++) {
  advanceTo(eco, dayOf(s, 11, 31));
  if (s >= 1) history.push(sampleSeason(eco, s));
  process.stdout.write(`season ${s} done (${((performance.now() - t0) / 1000).toFixed(0)}s)\r`);
}
const checks = validate(eco, history);
const md = reportMarkdown(seed, checks, history, eco, (performance.now() - t0) / 1000);
mkdirSync('reports', { recursive: true });
writeFileSync('reports/career-validation.md', md);
console.log('\n' + checks.map((c) => `${c.pass ? 'PASS' : 'FAIL'}  ${c.label}`).join('\n'));
console.log('report: reports/career-validation.md');
process.exitCode = checks.every((c) => c.pass) ? 0 : 1;
