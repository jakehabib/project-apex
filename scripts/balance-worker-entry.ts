// Worker body for scripts/sim-balance.mjs (bundled by esbuild at run time).
import { parentPort } from 'node:worker_threads';
import { syntheticTeam } from '../src/core/match/engine/fixtures';
import { simulateMap } from '../src/core/match/engine/match';
import { ENGINE_VERSION, type Attributes, type TeamSetup } from '../src/core/match/engine/types';
import { MAP_POOL } from '../src/core/match/maps';
import { MR12_STANDARD } from '../src/core/match/rules/ruleset';
import { checkInvariants } from '../src/core/match/stats/invariants';

interface Side {
  skill: number;
  preset?: string;
  coach?: number;
  mod?: { role: string; attr: keyof Attributes; value: number };
  all?: Partial<Attributes>;
}

function makeTeam(id: string, s: Side, seed: string): TeamSetup {
  const t = syntheticTeam(id, s.skill, seed, s.preset ?? 'balanced');
  const players = t.players.map((p) => {
    let attributes = { ...p.attributes, ...(s.all ?? {}) };
    if (s.mod && p.roles[0] === s.mod.role) attributes = { ...attributes, [s.mod.attr]: s.mod.value };
    return { ...p, attributes };
  });
  const coach = s.coach !== undefined ? { ...t.coach!, preparation: s.coach, reading: s.coach, adaptation: s.coach } : t.coach;
  return { ...t, players, ...(coach ? { coach } : {}) };
}

parentPort!.on('message', (job: { ci: number; i: number; cell: { a: Side; b: Side } } | null) => {
  if (!job) {
    process.exit(0);
  }
  const { ci, i, cell } = job;
  // Same roster seeds for both sides of a cell so only the modified factor differs.
  const rosterSeed = `roster-${i % 25}`;
  const map = MAP_POOL[i % MAP_POOL.length]!;
  const first = (Math.floor(i / MAP_POOL.length) % 2) as 0 | 1;
  const r = simulateMap({
    matchId: `bal-${ci}-${i}`, mapIndex: 0, seed: `bal-${ci}-${i}`, map, ruleset: MR12_STANDARD,
    teams: [makeTeam('ta', cell.a, rosterSeed), makeTeam('tb', cell.b, rosterSeed)], firstAttacker: first,
  });
  let tWins = 0;
  let roundMs = 0;
  const reasons: Record<string, number> = {};
  const buys: Record<string, number> = {};
  let upsets = 0;
  for (const rd of r.rounds) {
    if (rd.winnerTeam === rd.attackerTeam) tWins++;
    roundMs += rd.endMs;
    reasons[rd.reason] = (reasons[rd.reason] ?? 0) + 1;
    for (const b of rd.buyTypes) buys[b] = (buys[b] ?? 0) + 1;
    const wb = rd.buyTypes[rd.winnerTeam];
    const lb = rd.buyTypes[1 - rd.winnerTeam];
    if ((wb === 'eco' || wb === 'force') && lb === 'full') upsets++;
  }
  const check = i % 10 === 0;
  const violations = check ? (checkInvariants(r.events, map, MR12_STANDARD).length > 0 ? 1 : 0) : 0;
  parentPort!.postMessage({
    ci,
    r: {
      engine: ENGINE_VERSION, winner: r.winnerTeam, rounds: r.rounds.length, tWins, roundMs, reasons, buys, upsets,
      plants: r.events.filter((e) => e.type === 'plant').length, defuses: r.events.filter((e) => e.type === 'defuse').length,
      kills: r.events.filter((e) => e.type === 'kill').length, timeouts: r.events.filter((e) => e.type === 'timeout').length,
      violations, checked: check ? 1 : 0, scoreA: r.scores[0], scoreB: r.scores[1],
    },
  });
});
