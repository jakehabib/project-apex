import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { buildGrid, calloutAt } from '../../src/core/match/maps/grid';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const map = MAP_POOL.find((m) => m.id === (process.argv[2] ?? 'harbor'))!;
const grid = buildGrid(map);
const c: Record<string, number> = {};
for (let i = 0; i < 30; i++) {
  const r = simulateMap({ matchId: 'd', mapIndex: 0, seed: `w-${i}`, map, ruleset: MR12_STANDARD, teams: [syntheticTeam('ta', 60, `r${i}`), syntheticTeam('tb', 60, `r${i}`)], firstAttacker: (i % 2) as 0 | 1 });
  let first = true; let att = 0; const team = new Map<string, number>();
  for (const e of r.events) {
    if (e.type === 'spawn') team.set(e.playerId, e.team);
    if (e.type === 'round_start') { first = true; att = e.attackerTeam; }
    if (e.type === 'kill' && first) {
      first = false;
      const side = team.get(e.attackerId) === att ? 'T' : 'CT';
      const k = `${calloutAt(map, grid, e.victimPos)}`;
      c[`${k}|${side}`] = (c[`${k}|${side}`] ?? 0) + 1;
    }
  }
}
const places = [...new Set(Object.keys(c).map((k) => k.split('|')[0]!))];
places.sort((a, b) => ((c[`${b}|T`] ?? 0) + (c[`${b}|CT`] ?? 0)) - ((c[`${a}|T`] ?? 0) + (c[`${a}|CT`] ?? 0)));
for (const p of places) console.log(`${p.padEnd(20)} T kills ${String(c[`${p}|T`] ?? 0).padStart(4)}  CT kills ${String(c[`${p}|CT`] ?? 0).padStart(4)}`);
