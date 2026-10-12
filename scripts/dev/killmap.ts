// All kills: killer side/task -> victim side/task, plus phase (pre/post plant).
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const N = Number(process.argv[2] ?? 16);
const c: Record<string, number> = {};
let planted = false;
let lastT = 1e9;
for (let i = 0; i < N; i++) {
  simulateMap({ matchId: 'h', mapIndex: 0, seed: `km-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('a', 60, `r${i}`), syntheticTeam('b', 60, `r${i}`)], firstAttacker: (i % 2) as 0 | 1,
    trace: (k, d) => {
      const t = d.t as number;
      if (t < lastT - 1000) planted = false;
      lastT = t;
      if (k === 'plant') planted = true;
      if (k !== 'kill') return;
      const v = d.victim as { side: string; task: string; moving: boolean };
      const a = d.attacker as { side: string; task: string };
      const key = `${planted ? 'POST' : 'PRE '} ${a.side === 'attacker' ? 'T ' : 'CT'} ${a.task.padEnd(22)} kills ${v.side === 'attacker' ? 'T ' : 'CT'} ${v.task}${v.moving ? ' (moving)' : ''}`;
      c[key] = (c[key] ?? 0) + 1;
    } });
}
const tot = (pred: (k: string) => boolean) => Object.entries(c).filter(([k]) => pred(k)).reduce((s, [, v]) => s + v, 0);
console.log('PRE: T kills', tot((k) => k.startsWith('PRE  T ')), 'CT kills', tot((k) => k.startsWith('PRE  CT')), '| POST: T kills', tot((k) => k.startsWith('POST T ')), 'CT kills', tot((k) => k.startsWith('POST CT')));
for (const [k, v] of Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(String(v).padStart(5), k);
