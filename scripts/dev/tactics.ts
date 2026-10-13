// Tactical behaviour audit (owner brief step 11). Usage: node scripts/dev/run.mjs scripts/dev/tactics.ts [maps=10] [map=0]
// Measures coordination from the event log: plan mix, stage reached, utility before hits,
// squad spacing (stacking), entry support, destination oscillation, rotation evidence.
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
import { buildTracks, positionAt } from '../../src/core/match/replay/positions';
import type { MatchEvent } from '../../src/core/match/events';

const N = Number(process.argv[2] ?? 10);
const mapIdx = Number(process.argv[3] ?? 0);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

const kinds = new Map<string, number>();
const endBy = new Map<string, number>();
const killsByStage = new Map<string, [number, number]>();
const winByKind = new Map<string, [number, number]>();
const stages = new Map<string, number>();
let rounds = 0, hits = 0, hitsWithUtil = 0, samples = 0, stackedSamples = 0, entrySupport = 0, entryChecks = 0;
let destChanges = 0, players = 0, rotations = 0, rotationsWithEvidence = 0, plants = 0, smokes = 0, flashes = 0, longIdle = 0;

for (let i = 0; i < N; i++) {
  const r = simulateMap({ matchId: 't', mapIndex: 0, seed: `tac-${i}`, map: MAP_POOL[mapIdx]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('a', 62, `ta${i}`), syntheticTeam('b', 62, `tb${i}`)], firstAttacker: (i % 2) as 0 | 1 });
  const byRound = new Map<number, MatchEvent[]>();
  for (const e of r.events) byRound.set(e.roundIndex, [...(byRound.get(e.roundIndex) ?? []), e]);
  for (const [ri, evs] of byRound) {
    const start = evs.find((e) => e.type === 'round_start');
    if (!start || start.type !== 'round_start') continue;
    rounds++;
    const att = start.attackerTeam;
    const end = evs.find((e) => e.type === 'round_end')!.tMs;
    const tracks = buildTracks(r.events, ri);
    const teamOf = new Map<string, number>();
    for (const e of evs) if (e.type === 'spawn') teamOf.set(e.playerId, e.team);
    const tIds = [...teamOf].filter(([, t]) => t === att).map(([id]) => id);
    const ai = evs.filter((e): e is Extract<MatchEvent, { type: 'ai' }> => e.type === 'ai');
    const tAi = ai.filter((e) => e.team === att);
    const kind = (start.plan.split(':')[0] ?? '').split(' ')[0]!;
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
    const lastStage = tAi.length ? tAi[tAi.length - 1]!.phase : 'none';
    stages.set(lastStage, (stages.get(lastStage) ?? 0) + 1);
    // Utility before the entry swings: smokes/flashes by attackers in the 4 s before the 'hit' stage.
    const hit = tAi.find((e) => e.phase === 'hit');
    if (hit) {
      hits++;
      const util = evs.filter((e) => e.type === 'utility' && tIds.includes(e.playerId) && e.tMs <= hit.tMs && e.tMs >= hit.tMs - 4000);
      if (util.length) hitsWithUtil++;
    }
    for (const e of evs) if (e.type === 'utility' && tIds.includes(e.playerId)) {
      if (e.utility === 'smoke') smokes++;
      if (e.utility === 'flash') flashes++;
    }
    if (evs.some((e) => e.type === 'plant')) plants++;
    const re = evs.find((e) => e.type === 'round_end');
    if (re && re.type === 'round_end') {
      endBy.set(re.reason, (endBy.get(re.reason) ?? 0) + 1);
      const w = winByKind.get(kind) ?? [0, 0];
      w[1]++;
      if (re.winnerTeam === att) w[0]++;
      winByKind.set(kind, w);
    }
    // Stacking: alive attackers closer than 35 units to each other while moving (sample every 500 ms).
    const deathAt = new Map<string, number>();
    for (const e of evs) if (e.type === 'kill') deathAt.set(e.victimId, e.tMs);
    for (let t = 6000; t < end; t += 500) {
      const alive = tIds.filter((id) => (deathAt.get(id) ?? Infinity) > t);
      const ps = alive.filter((id) => tracks.get(id)!.segments.some((sg) => sg.t0 <= t && sg.t1 > t)).map((id) => positionAt(tracks.get(id)!, t));
      let stacked = false;
      for (let a = 0; a < ps.length; a++) for (let b = a + 1; b < ps.length; b++) if (dist(ps[a]!, ps[b]!) < 35) stacked = true;
      samples++;
      if (stacked) stackedSamples++;
    }
    // Entry support: at the first attacker death after the hit, a teammate within 600 units.
    if (hit) {
      const firstDeath = evs.find((e) => e.type === 'kill' && tIds.includes(e.victimId) && e.tMs >= hit.tMs);
      if (firstDeath && firstDeath.type === 'kill') {
        entryChecks++;
        const vp = positionAt(tracks.get(firstDeath.victimId)!, firstDeath.tMs);
        const near = tIds.filter((id) => id !== firstDeath.victimId && (deathAt.get(id) ?? Infinity) > firstDeath.tMs).some((id) => dist(positionAt(tracks.get(id)!, firstDeath.tMs), vp) < 600);
        if (near) entrySupport++;
      }
    }
    for (const e of evs) {
      if (e.type !== 'kill') continue;
      const st = [...tAi].reverse().find((x) => x.tMs <= e.tMs)?.phase ?? 'start';
      const k = killsByStage.get(st) ?? [0, 0];
      if (tIds.includes(e.victimId)) k[1]++;
      else k[0]++;
      killsByStage.set(st, k);
    }
    // Oscillation: destination changes per player (from ai snapshots).
    const destOf = new Map<string, string>();
    const changes = new Map<string, number>();
    for (const e of ai) for (const a of e.assign) {
      const k = a.dest ? `${Math.round(a.dest.x)},${Math.round(a.dest.y)}` : '-';
      if (destOf.has(a.playerId) && destOf.get(a.playerId) !== k) changes.set(a.playerId, (changes.get(a.playerId) ?? 0) + 1);
      destOf.set(a.playerId, k);
    }
    destChanges += [...changes.values()].reduce((s, x) => s + x, 0);
    players += teamOf.size;
    for (const e of ai) if (e.phase.startsWith('rotate')) {
      rotations++;
      if (/seen|heard|cue/.test(e.note)) rotationsWithEvidence++;
    }
    // Idle attackers: alive, not moving for > 25 s before the plant while the round is live.
    const plantT = evs.find((e) => e.type === 'plant')?.tMs ?? end;
    for (const id of tIds) {
      const tr = tracks.get(id)!;
      let last = 0;
      for (const s of tr.segments) {
        if (s.t0 > plantT) break;
        if (s.t0 - last > 25000 && (deathAt.get(id) ?? Infinity) > s.t0) longIdle++;
        last = s.t1;
      }
    }
  }
}
const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : '-');
console.log(`maps ${N}, rounds ${rounds} on ${MAP_POOL[mapIdx]!.id}`);
console.log('plans:', [...kinds].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
console.log('final attack stage:', [...stages].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
console.log(`hits with utility in the 4 s before: ${pct(hitsWithUtil, hits)} (${hits} hits); T smokes/round ${(smokes / rounds).toFixed(2)}, flashes/round ${(flashes / rounds).toFixed(2)}; plants ${pct(plants, rounds)}`);
console.log(`stacked samples (two attackers < 35 u): ${pct(stackedSamples, samples)}`);
console.log(`entry supported (teammate < 600 u at first death after hit): ${pct(entrySupport, entryChecks)}`);
console.log(`destination changes per player-round: ${(destChanges / players).toFixed(2)}`);
console.log(`rotations: ${rotations}, with recorded evidence: ${pct(rotationsWithEvidence, rotations)}`);
console.log('kills by attack stage (T kills / T deaths):', [...killsByStage].map(([k, [a, b]]) => `${k} ${a}/${b}`).join(', '));
console.log('round ends:', [...endBy].map(([k, v]) => `${k} ${v}`).join(', '));
console.log('T win by plan:', [...winByKind].map(([k, [w, n]]) => `${k} ${pct(w, n)} of ${n}`).join(', '));
console.log(`long idle stretches (>25 s still before plant): ${longIdle} over ${rounds} rounds`);
