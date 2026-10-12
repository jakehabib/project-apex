// Runs the invariant checker over the engine-test seeds and dumps the first violating player's ledger.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
import { checkInvariants } from '../../src/core/match/stats/invariants';
for (const mapIdx of [0, 1]) for (const seed of ['inv-1', 'inv-2', 'inv-3', 'inv-4', 'inv-5', 'inv-6']) {
  const skills = [55 + (seed.length % 3) * 5, 60];
  const r = simulateMap({ matchId: `m-${seed}`, mapIndex: 0, seed, map: MAP_POOL[mapIdx]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('aaa', skills[0]!, seed, 'balanced'), syntheticTeam('bbb', skills[1]!, seed + 'b', 'balanced')], firstAttacker: 0 });
  const v = checkInvariants(r.events, MAP_POOL[mapIdx]!, MR12_STANDARD);
  console.log(mapIdx, seed, v.length, v[0] ?? '');
  if (process.argv[2] === 'dump' && v[0]) {
    const m = /r(\d+) .*?: (\S+) /.exec(v[0])!;
    const round = Number(m[1]); const pid = m[2]!;
    for (const e of r.events) if (e.roundIndex >= round - 1 && e.roundIndex <= round && ['buy', 'drop', 'pickup', 'kill', 'loadout'].includes(e.type) && JSON.stringify(e).includes(pid))
      console.log('  ', e.roundIndex, e.type === 'loadout' ? JSON.stringify(e.loadouts.find((l) => l.playerId === pid)) : JSON.stringify(e).slice(0, 200));
    process.exit(0);
  }
}
