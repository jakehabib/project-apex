// Alive counts at the moment of plant, and CT retake win rate per state.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const N = Number(process.argv[2] ?? 30);
const st: Record<string, [number, number]> = {};
let plantTimes: number[] = [];
for (let i = 0; i < N; i++) {
  const r = simulateMap({ matchId: 'b', mapIndex: 0, seed: `ap-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('a', 60, `r${i % 25}`), syntheticTeam('b', 60, `s${i % 25}`)], firstAttacker: ((i >> 1) % 2) as 0 | 1 });
  const team = new Map<string, number>();
  let att = 0; let alive = new Set<string>(); let key: string | null = null;
  for (const e of r.events) {
    if (e.type === 'spawn') team.set(e.playerId, e.team);
    if (e.type === 'round_start') { att = e.attackerTeam; alive = new Set(team.keys()); key = null; }
    if (e.type === 'kill') alive.delete(e.victimId);
    if (e.type === 'plant') { const t = [...alive].filter((id) => team.get(id) === att).length; const c = alive.size - t; key = `${t}v${c}`; plantTimes.push(e.tMs); }
    if (e.type === 'round_end' && key) { const g = (st[key] ??= [0, 0]); g[0]++; if (e.winnerTeam !== att) g[1]++; }
  }
}
const tot = Object.values(st).reduce((s, g) => s + g[0], 0);
for (const [k, g] of Object.entries(st).sort((a, b) => b[1][0] - a[1][0])) console.log(`T${k.replace('v', ' vs CT')}`.padEnd(12), `${(100 * g[0] / tot).toFixed(1)}% of plants`, `CT retake won ${(100 * g[1] / g[0]).toFixed(0)}%`);
plantTimes.sort((a, b) => a - b);
console.log('plant time median', (plantTimes[Math.floor(plantTimes.length / 2)]! / 1000).toFixed(0), 's; p25', (plantTimes[Math.floor(plantTimes.length / 4)]! / 1000).toFixed(0), 'p75', (plantTimes[Math.floor(plantTimes.length * 0.75)]! / 1000).toFixed(0));
