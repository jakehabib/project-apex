import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const mapId = process.argv[2] ?? 'harbor';
const map = MAP_POOL.find((m) => m.id === mapId)!;
const acc: Record<string, number> = {};
const inc = (k: string, v = 1) => (acc[k] = (acc[k] ?? 0) + v);
for (let i = 0; i < 30; i++) {
  const r = simulateMap({ matchId: 'd', mapIndex: 0, seed: `site-${i}`, map, ruleset: MR12_STANDARD, teams: [syntheticTeam('ta', 60, `r${i}`), syntheticTeam('tb', 60, `r${i}`)], firstAttacker: (i % 2) as 0 | 1 });
  let plant: { site: string; t: number } | null = null;
  let firstContact = -1;
  let attacker = 0;
  const ctDeathsBeforePlant: number[] = [];
  for (const e of r.events) {
    if (e.type === 'round_start') { plant = null; firstContact = -1; attacker = e.attackerTeam; }
    if (e.type === 'spotted' && firstContact < 0) firstContact = e.tMs;
    if (e.type === 'plant') { plant = { site: e.site, t: e.tMs }; inc(`plantT:${e.site}`, e.tMs / 1000); }
    if (e.type === 'round_end') {
      const tw = e.winnerTeam === attacker ? 1 : 0;
      const k = plant ? `site ${plant.site}` : 'no plant';
      inc(k); inc(`${k}:tw`, tw);
      inc('contact', firstContact / 1000); inc('rounds');
    }
  }
}
console.log(`avg first contact ${(acc.contact! / acc.rounds!).toFixed(1)} s`);
for (const k of ['site A', 'site B', 'no plant']) console.log(`${k}: ${acc[k]} rounds, T win ${((acc[`${k}:tw`] ?? 0) / (acc[k] ?? 1) * 100).toFixed(1)}%, avg plant at ${k.startsWith('site') ? ((acc[`plantT:${k.slice(5)}`] ?? 0) / (acc[k] ?? 1)).toFixed(1) + 's' : '-'}`);
