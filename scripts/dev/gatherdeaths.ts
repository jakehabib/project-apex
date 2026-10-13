// Where attackers die before their hit starts (gather/control stages), and to whom.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
import { calloutAt, buildGrid } from '../../src/core/match/maps/grid';
import type { MatchEvent } from '../../src/core/match/events';
const N = Number(process.argv[2] ?? 12);
const m = MAP_POOL[0]!;
const grid = buildGrid(m);
const where = new Map<string, number>();
const killerWhere = new Map<string, number>();
const killerTask = new Map<string, number>();
for (let i = 0; i < N; i++) {
  const r = simulateMap({ matchId: 't', mapIndex: 0, seed: `tac-${i}`, map: m, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('a', 62, `ta${i}`), syntheticTeam('b', 62, `tb${i}`)], firstAttacker: (i % 2) as 0 | 1 });
  let att = 0;
  let stage = '';
  const side = new Map<string, string>();
  const ctWhy = new Map<string, string>();
  for (const e of r.events as MatchEvent[]) {
    if (e.type === 'round_start') { att = e.attackerTeam; stage = ''; }
    if (e.type === 'spawn') side.set(e.playerId, e.side);
    if (e.type === 'ai') {
      if (e.team === att) stage = e.phase;
      else for (const a of e.assign) ctWhy.set(a.playerId, a.why);
    }
    if (e.type === 'kill' && (process.env.STAGES ?? 'gather,control').split(',').includes(stage) && side.get(e.victimId) === 'attacker') {
      const w = calloutAt(m, grid, e.victimPos);
      if (w === process.argv[3]) { const kp = (r.events as MatchEvent[]).filter((x) => x.type === 'damage' && x.seq < e.seq && x.attackerId === e.attackerId).slice(-1)[0]; if (kp && kp.type === 'damage') console.log(`victim (${Math.round(e.victimPos.x/20)},${Math.round(e.victimPos.y/20)}) killer at (${Math.round(kp.attackerPos.x/20)},${Math.round(kp.attackerPos.y/20)}) ${calloutAt(m, grid, kp.attackerPos)} t=${e.tMs} weapon ${e.weaponId}`); }
      where.set(w, (where.get(w) ?? 0) + 1);
      const kw = ctWhy.get(e.attackerId) ?? '?';
      killerTask.set(kw, (killerTask.get(kw) ?? 0) + 1);
    }
  }
}
console.log('T deaths before the hit, by place:', [...where].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
console.log('killer assignment:', [...killerTask].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
