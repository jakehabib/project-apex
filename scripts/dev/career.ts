import { advance, autoPlay, createCareer, loadCareer, pendingSeries, registerSimulator, saveCareer } from '../../src/core/career/career';
import { simulateMap } from '../../src/core/match/engine/match';
import { generateWorld } from '../../src/core/world/generate';
import { formatDate } from '../../src/core/world/calendar';
import world from '../../src/shared/art/world.json';
registerSimulator(simulateMap);
const seed = process.argv[2] ?? 'c1';
const org = process.argv[3] ?? 'polararc';
let t = performance.now();
const w = generateWorld({ seed, featured: { teams: world.teams, players: world.players, coaches: world.coaches } as any });
const c = createCareer({ seed, world: w, orgId: org });
console.log('created', (performance.now() - t).toFixed(0), 'ms', formatDate(c.eco.world.day));
t = performance.now();
let maps = 0; let stops: Record<string, number> = {};
for (let i = 0; i < 400 && c.eco.world.day < c.startDay + 365; i++) {
  const r = advance(c, 60);
  stops[r.stop] = (stops[r.stop] ?? 0) + 1;
  if (r.stop === 'match') { const s = pendingSeries(c)!; autoPlay(c, s.id); maps += s.played.length; }
}
console.log('season', (performance.now() - t).toFixed(0), 'ms', 'maps', maps, stops, formatDate(c.eco.world.day));
const won = [...c.series.values()].filter((s) => s.outcome && (s.outcome.winner === 'a') === s.userIsA).length;
console.log('series', c.series.size, 'won', won);
for (const m of c.inbox.slice(-12)) console.log(formatDate(m.day), m.kind, m.title);
t = performance.now();
const txt = saveCareer(c);
console.log('save', (txt.length / 1e6).toFixed(2), 'MB', (performance.now() - t).toFixed(0), 'ms');
t = performance.now();
const c2 = loadCareer(txt);
console.log('load', (performance.now() - t).toFixed(0), 'ms', saveCareer(c2) === txt);
// determinism after reload: advance both 40 days
advance(c, 40); advance(c2, 40);
while (pendingSeries(c)) { autoPlay(c, pendingSeries(c)!.id); advance(c, 0); }
while (pendingSeries(c2)) { autoPlay(c2, pendingSeries(c2)!.id); advance(c2, 0); }
console.log('same after reload', saveCareer(c) === saveCareer(c2));
import { toJson } from '../../src/core/career/codec';
const sizes: Record<string, number> = {};
for (const [k, v] of Object.entries(c.eco)) sizes['eco.' + k] = toJson(v).length;
for (const [k, v] of Object.entries(c.eco.world)) sizes['world.' + k] = toJson(v).length;
sizes.series = toJson(c.series).length;
console.log(Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k} ${(v / 1e6).toFixed(2)}`).join('\n'));
