// When defenders holding an angle die: were they aimed at their killer? Did they have a target?
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const N = Number(process.argv[2] ?? 16);
const c: Record<string, number> = {};
const inc = (k: string) => (c[k] = (c[k] ?? 0) + 1);
for (let i = 0; i < N; i++) {
  simulateMap({ matchId: 'h', mapIndex: 0, seed: `h-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('a', 60, `r${i}`), syntheticTeam('b', 60, `r${i}`)], firstAttacker: (i % 2) as 0 | 1,
    trace: (k, d) => {
      if (k !== 'kill') return;
      const v = d.victim as { side: string; task: string };
      const a = d.attacker as { side: string; task: string };
      const aim = d.victimAim as number;
      const bucket = aim > 0.9 ? 'pre-aimed' : aim > 0.5 ? 'roughly facing' : aim > -0.2 ? 'side-on' : 'facing away';
      if (v.task.startsWith('hold')) inc(`${v.side} holder dies: ${bucket}${d.victimTarget ? ' (had a target)' : ''}`);
      if (a.task.startsWith('hold')) inc(`${a.side} holder kills`);
    } });
}
for (const [k, v] of Object.entries(c).sort()) console.log(String(v).padStart(5), k);
