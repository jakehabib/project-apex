// Plays the first round of a scenario for several seeds and prints the outcome and plan.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { MapSimulation } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const [att, def] = (process.argv[2] ?? '5v3').split('v').map(Number);
const planted = process.argv[3] as 'A' | 'B' | undefined;
for (let i = 0; i < Number(process.argv[4] ?? 10); i++) {
  const seed = `sc-${i}`;
  const sim = new MapSimulation({ matchId: `tac-${seed}`, mapIndex: 0, seed, map: MAP_POOL[0]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('aaa', 64, `${seed}a`), syntheticTeam('bbb', 64, `${seed}b`)], firstAttacker: 0, scenario: { attackers: att, defenders: def, ...(planted ? { planted } : {}) } });
  const r = sim.step()!;
  const evs = sim.events.filter((e) => e.roundIndex === 0);
  const kills = evs.filter((e) => e.type === 'kill').map((e) => {
    if (e.type !== 'kill') return '';
    const dmg = [...evs].reverse().find((x) => x.type === 'damage' && x.seq < e.seq && x.attackerId === e.attackerId);
    const kp = dmg && dmg.type === 'damage' ? `(${Math.round(dmg.attackerPos.x / 20)},${Math.round(dmg.attackerPos.y / 20)})` : '';
    const stage = [...evs].reverse().find((x) => x.type === 'ai' && x.team === 0 && x.seq < e.seq);
    return `${e.attackerId.slice(0, 3)}${kp}>${e.victimId.slice(0, 3)}(${Math.round(e.victimPos.x / 20)},${Math.round(e.victimPos.y / 20)})@${(e.tMs / 1000).toFixed(0)}[${stage && stage.type === 'ai' ? stage.phase : ''}]`;
  }).join(' ');
  console.log(`${seed} ${r.winnerTeam === 0 ? 'T' : 'CT'} ${r.reason} ${r.plan} | ${kills}`);
}
