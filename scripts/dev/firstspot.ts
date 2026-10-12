// For each round's first kill: who spotted whom first, and how many shooters engaged the victim.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
const N = Number(process.argv[2] ?? 20);
const c: Record<string, number> = {};
const inc = (k: string) => (c[k] = (c[k] ?? 0) + 1);
for (let i = 0; i < N; i++) {
  const r = simulateMap({
    matchId: 'd', mapIndex: 0, seed: `fs-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('ta', 60, `r${i % 25}`), syntheticTeam('tb', 60, `r${i % 25}`)], firstAttacker: (i % 2) as 0 | 1,
  });
  const byRound = new Map<number, typeof r.events>();
  for (const e of r.events) byRound.set(e.roundIndex, [...(byRound.get(e.roundIndex) ?? []), e]);
  for (const [, evs] of byRound) {
    const rs = evs.find((e) => e.type === 'round_start');
    if (!rs || rs.type !== 'round_start') continue;
    const attTeam = rs.attackerTeam;
    const sideOf = (id: string) => (evs.find((e) => e.type === 'spawn' && e.playerId === id) as { team: number } | undefined)?.team === attTeam ? 'T' : 'CT';
    const k = evs.find((e) => e.type === 'kill');
    if (!k || k.type !== 'kill') continue;
    const pair = [k.attackerId, k.victimId];
    const sp = evs.filter((e) => e.type === 'spotted' && e.tMs <= k.tMs && pair.includes(e.observerId) && pair.includes(e.targetId));
    const first = sp[0];
    const killerSide = sideOf(k.attackerId);
    const firstSpotter = !first || first.type !== 'spotted' ? 'none' : first.observerId === k.attackerId ? 'killer' : 'victim';
    const gap = first && first.type === 'spotted' ? k.tMs - first.tMs : -1;
    inc(`${killerSide} kill, first spotted by ${firstSpotter}`);
    const dmgs = evs.filter((e) => e.type === 'damage' && e.victimId === k.victimId && e.tMs <= k.tMs);
    const shooters = new Set(dmgs.map((d) => (d as { attackerId: string }).attackerId)).size;
    inc(`${killerSide} kill, shooters on victim=${shooters}`);
    const back = evs.filter((e) => e.type === 'damage' && e.attackerId === k.victimId && e.tMs <= k.tMs).length;
    inc(`${killerSide} kill, victim landed hits=${Math.min(back, 3)}`);
    inc(`${killerSide} kill, gap ${gap < 0 ? 'na' : gap < 300 ? '<300' : gap < 700 ? '<700' : gap < 1500 ? '<1500' : '>1500'}`);
  }
}
for (const [k, v] of Object.entries(c).sort()) console.log(v, k);
