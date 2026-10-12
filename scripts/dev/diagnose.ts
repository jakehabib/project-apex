// Developer diagnostic: why rounds are won. Usage: node scripts/dev/run.mjs scripts/dev/diagnose.ts [maps]
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';

const N = Number(process.argv[2] ?? 40);
const acc: Record<string, number> = {};
const inc = (k: string, v = 1) => (acc[k] = (acc[k] ?? 0) + v);
for (let i = 0; i < N; i++) {
  const map = MAP_POOL[i % 2]!;
  const r = simulateMap({ matchId: 'd', mapIndex: 0, seed: `diag-${i}`, map, ruleset: MR12_STANDARD, teams: [syntheticTeam('ta', 60, `r${i % 25}`), syntheticTeam('tb', 60, `r${i % 25}`)], firstAttacker: (i % 2) as 0 | 1 });
  let round = -1;
  let attacker = 0;
  let first = true;
  let alive = [5, 5];
  let plantAlive: number[] | null = null;
  let teamOf = new Map<string, number>();
  let plan = '';
  for (const e of r.events) {
    if (e.type === 'spawn') teamOf.set(e.playerId, e.team);
    if (e.type === 'round_start') { round = e.roundIndex; attacker = e.attackerTeam; first = true; alive = [5, 5]; plantAlive = null; plan = e.plan.split(' ')[0]!; inc(`${map.id}:rounds`); inc(`plan:${plan}`); }
    if (e.type === 'kill') {
      const killerSide = teamOf.get(e.attackerId) === attacker ? 'T' : 'CT';
      if (first) { inc(`${map.id}:opening:${killerSide}`); first = false; }
      alive[teamOf.get(e.victimId)!]!--;
    }
    if (e.type === 'plant') { plantAlive = [alive[attacker]!, alive[1 - attacker]!]; inc(`plants:${plantAlive[0]}v${plantAlive[1]}`); }
    if (e.type === 'round_end') {
      const tWon = e.winnerTeam === attacker;
      inc(`${map.id}:twin`, tWon ? 1 : 0);
      inc(`plan:${plan}:twin`, tWon ? 1 : 0);
      if (plantAlive) { inc('postplant'); inc('postplant:twin', tWon ? 1 : 0); }
      else { inc('noplant'); inc('noplant:twin', tWon ? 1 : 0); }
    }
  }
}
const pct = (a: number, b: number) => `${((a / Math.max(1, b)) * 100).toFixed(1)}%`;
for (const m of MAP_POOL) {
  console.log(`${m.id}: T round win ${pct(acc[`${m.id}:twin`] ?? 0, acc[`${m.id}:rounds`] ?? 0)}, opening kills by T ${pct(acc[`${m.id}:opening:T`] ?? 0, (acc[`${m.id}:opening:T`] ?? 0) + (acc[`${m.id}:opening:CT`] ?? 0))}`);
}
for (const k of Object.keys(acc).filter((k) => k.startsWith('plan:') && !k.endsWith('twin'))) console.log(`${k}: ${acc[k]} rounds, T win ${pct(acc[`${k}:twin`] ?? 0, acc[k]!)}`);
console.log(`post-plant rounds: ${acc.postplant}, T win ${pct(acc['postplant:twin'] ?? 0, acc.postplant ?? 0)} | no-plant rounds: ${acc.noplant}, T win ${pct(acc['noplant:twin'] ?? 0, acc.noplant ?? 0)}`);
console.log('numbers at plant (T v CT):', Object.entries(acc).filter(([k]) => k.startsWith('plants:')).sort().map(([k, v]) => `${k.slice(7)}=${v}`).join(' '));
