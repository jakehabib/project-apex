// Ecosystem smoke run: N seasons with the validation-only quick resolver.
import { readFileSync } from 'node:fs';
import { advanceTo, createEcosystem, liveStandings } from '../../src/core/competition/ecosystem';
import { quickResolver } from '../../src/core/competition/quickResolver';
import { dayOf } from '../../src/core/world/calendar';
import { generateWorld } from '../../src/core/world/generate';
const featured = JSON.parse(readFileSync('src/shared/art/world.json', 'utf8'));
const seasons = Number(process.argv[2] ?? 1);
const t0 = performance.now();
const world = generateWorld({ seed: 'eco-dev', featured: { teams: featured.teams.map((t: any) => ({ ...t, archetype: { northwind: 'elite', hollowcrown: 'elite', redkite: 'contender', ironvale: 'contender', sunline: 'contender', obsidiantide: 'contender', polararc: 'developing', atlasunion: 'developing' }[t.id as string] })), players: featured.players } });
const eco = createEcosystem(world, quickResolver(world, 'eco-dev'), dayOf(0, 0, 1) - 1);
advanceTo(eco, dayOf(seasons, 11, 31));
const st = liveStandings(eco, world.day);
console.log(`orgs ${world.orgs.size}, players ${world.players.size}, series ${eco.store.series.size}, prizes ${eco.store.prizes.size}, events run ${eco.results.size}, snapshots ${eco.snapshots.length}, moves ${eco.moves.length}, ${((performance.now() - t0) / 1000).toFixed(1)}s`);
console.log(`ranked teams ${st.length}; invitations ${eco.invitations.length} (declined ${eco.invitations.filter((i) => i.status === 'declined').length}, void ${eco.invitations.filter((i) => i.status === 'void').length}); skips ${eco.skips.length}`);
for (const s of st.slice(0, 15)) { const o = world.orgs.get(s.orgId)!; console.log(`#${String(s.globalRank).padStart(3)} ${o.name.padEnd(26)} ${s.region} #${s.regionalRank} ARP ${s.arp}  ${s.wins}-${s.losses}  seed ${s.components.seed} h2h ${s.components.h2h}`); }
for (const n of eco.news.filter((n) => n.text.includes('World Championship') && n.text.includes('won'))) console.log(n.day, n.text);
import { teamStrength } from '../../src/core/world/evolution';
const strong = [...world.orgs.values()].filter((o) => o.roster.length === 5).sort((a, b) => teamStrength(world, b) - teamStrength(world, a));
console.log('--- strongest rosters (strength → ARP rank)');
for (const o of strong.slice(0, 15)) { const s = st.find((x) => x.orgId === o.id); console.log(teamStrength(world, o).toFixed(1), o.name.padEnd(24), o.homeRegion, 'rank', s?.globalRank ?? '-'); }
const ranks = strong.map((o, i) => [i + 1, st.find((x) => x.orgId === o.id)?.globalRank ?? 200]);
const n = ranks.length; const d2 = ranks.reduce((s, [a, b]) => s + (a! - b!) ** 2, 0); console.log('Spearman strength vs ARP', (1 - 6 * d2 / (n * (n * n - 1))).toFixed(3));
const g = [...world.orgs.values()].find((o) => o.name.startsWith('Granite'))!;
for (const id of g.roster) { const p = world.players.get(id)!; console.log('  ', p.nickname, p.region, p.nationality, 'age', Math.floor((world.day - p.bornDay) / 365), 'skill', p.skill, 'pot', p.potential, 'joined', p.joinedDay); }
const act = [...world.players.values()].filter((p) => p.orgId);
const top = [...world.orgs.values()].map((o) => teamStrength(world, o)).sort((a, b) => b - a);
console.log('avg contracted skill', (act.reduce((s, p) => s + p.skill, 0) / act.length).toFixed(1), 'top10 team avg', (top.slice(0, 10).reduce((s, x) => s + x, 0) / 10).toFixed(1));
