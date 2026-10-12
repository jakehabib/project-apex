// Kill distance distribution (map units; 10 units = 1 m).
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const N = Number(process.argv[2] ?? 10);
const d: number[] = [];
for (let i = 0; i < N; i++) {
  const r = simulateMap({ matchId: 'd', mapIndex: 0, seed: `kd-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('ta', 60, `r${i}`), syntheticTeam('tb', 60, `r${i}`)], firstAttacker: (i % 2) as 0 | 1 });
  const lastDmg = new Map<string, { x: number; y: number }>();
  for (const e of r.events) {
    if (e.type === 'damage') lastDmg.set(`${e.attackerId}>${e.victimId}`, e.attackerPos);
    if (e.type === 'kill') { const a = lastDmg.get(`${e.attackerId}>${e.victimId}`); if (a) d.push(Math.hypot(a.x - e.victimPos.x, a.y - e.victimPos.y)); }
  }
}
d.sort((a, b) => a - b);
const q = (p: number) => Math.round(d[Math.floor(p * (d.length - 1))]!);
console.log('kills', d.length, 'p10', q(0.1), 'p25', q(0.25), 'median', q(0.5), 'p75', q(0.75), 'p90', q(0.9));
const bins = [0, 150, 300, 450, 600, 800, 1000, 2000];
for (let i = 0; i < bins.length - 1; i++) console.log(`${bins[i]}-${bins[i + 1]}`, (d.filter((x) => x >= bins[i]! && x < bins[i + 1]!).length / d.length * 100).toFixed(1) + '%');
