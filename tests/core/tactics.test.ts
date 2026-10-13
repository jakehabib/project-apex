/**
 * Tactical AI acceptance tests (owner brief, step 11). They measure behaviour from the event log:
 * coordination, utility before hits, trade spacing, honest information, stability and scenarios.
 */
import { describe, expect, it } from 'vitest';
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { MapSimulation, simulateMap } from '../../src/core/match/engine/match';
import type { ScenarioSetup } from '../../src/core/match/engine/types';
import type { MatchEvent } from '../../src/core/match/events';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
import { checkInvariants } from '../../src/core/match/stats/invariants';
import { buildTracks, positionAt } from '../../src/core/match/replay/positions';

const HARBOR = MAP_POOL.find((m) => m.id === 'harbor')!;
const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
type Ai = Extract<MatchEvent, { type: 'ai' }>;

const input = (seed: string, scenario?: ScenarioSetup, map = HARBOR) => ({
  matchId: `tac-${seed}`, mapIndex: 0, seed, map, ruleset: MR12_STANDARD,
  teams: [syntheticTeam('aaa', 64, `${seed}a`), syntheticTeam('bbb', 64, `${seed}b`)] as const, firstAttacker: 0 as const,
  ...(scenario ? { scenario } : {}),
});

/** Plays only the first round (scenarios apply to it) and returns its events. */
function firstRound(seed: string, scenario?: ScenarioSetup) {
  const sim = new MapSimulation(input(seed, scenario));
  const r = sim.step()!;
  return { events: sim.events.filter((e) => e.roundIndex === 0), winner: r.winnerTeam, reason: r.reason };
}

describe('tactical AI: full maps', () => {
  const maps = [0, 1, 2].map((i) => simulateMap(input(`full-${i}`)));
  const rounds = maps.flatMap((m) => {
    const by = new Map<number, MatchEvent[]>();
    for (const e of m.events) by.set(e.roundIndex, [...(by.get(e.roundIndex) ?? []), e]);
    return [...by.entries()].map(([ri, evs]) => ({ ri, evs, all: m.events }));
  });

  it('is deterministic: the same seed gives the same tactical decisions', () => {
    const a = simulateMap(input('det-tac'));
    const b = simulateMap(input('det-tac'));
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.events.filter((e) => e.type === 'ai').length).toBe(b.events.filter((e) => e.type === 'ai').length);
  });

  it('every round has a named team plan with squads and assignments', () => {
    for (const { evs } of rounds) {
      const start = evs.find((e) => e.type === 'round_start');
      if (!start || start.type !== 'round_start') continue;
      const tAi = evs.filter((e): e is Ai => e.type === 'ai' && e.team === start.attackerTeam);
      expect(tAi.length).toBeGreaterThan(0);
      expect(tAi[0]!.assign.some((a) => a.squad !== '')).toBe(true);
    }
  });

  it('squads keep trade spacing instead of moving as one blob', () => {
    let samples = 0;
    let stacked = 0;
    for (const { ri, evs, all } of rounds) {
      const start = evs.find((e) => e.type === 'round_start');
      if (!start || start.type !== 'round_start') continue;
      const tracks = buildTracks(all, ri);
      const ids = evs.filter((e) => e.type === 'spawn' && e.team === start.attackerTeam).map((e) => (e as { playerId: string }).playerId);
      const deadAt = new Map(evs.filter((e) => e.type === 'kill').map((e) => [(e as { victimId: string }).victimId, e.tMs]));
      const end = evs.find((e) => e.type === 'round_end')!.tMs;
      for (let t = 6000; t < end; t += 500) {
        const moving = ids.filter((id) => (deadAt.get(id) ?? Infinity) > t && tracks.get(id)!.segments.some((s) => s.t0 <= t && s.t1 > t));
        const ps = moving.map((id) => positionAt(tracks.get(id)!, t));
        samples++;
        if (ps.some((p, i) => ps.some((q, j) => j > i && d(p, q) < 35))) stacked++;
      }
    }
    expect(stacked / samples).toBeLessThan(0.15);
  });

  it('hits are prepared with utility when the team has it', () => {
    let hits = 0;
    let prepared = 0;
    for (const { evs } of rounds) {
      const start = evs.find((e) => e.type === 'round_start') as Extract<MatchEvent, { type: 'round_start' }> | undefined;
      if (!start || start.buyTypes[start.attackerTeam] !== 'full') continue;
      const ids = new Set(evs.filter((e) => e.type === 'spawn' && e.team === start.attackerTeam).map((e) => (e as { playerId: string }).playerId));
      const hit = evs.find((e): e is Ai => e.type === 'ai' && e.team === start.attackerTeam && e.phase === 'hit');
      if (!hit || start.plan.startsWith('Rush') || start.plan.startsWith('Contact')) continue;
      hits++;
      if (evs.some((e) => e.type === 'utility' && ids.has(e.playerId) && e.tMs <= hit.tMs && e.tMs >= hit.tMs - 4000)) prepared++;
    }
    expect(hits).toBeGreaterThan(5);
    expect(prepared / hits).toBeGreaterThan(0.6);
  });

  it('defenders rotate only on information they actually have, and say what it was', () => {
    let rotations = 0;
    for (const { evs } of rounds) {
      for (const e of evs) {
        if (e.type !== 'ai' || !e.phase.startsWith('rotate')) continue;
        rotations++;
        expect(e.note).toMatch(/seen|heard|cue/);
        const site = e.phase.slice(-1) as 'A' | 'B';
        expect(e.pressure.find((p) => p.area === site)!.value).toBeGreaterThan(1);
      }
    }
    expect(rotations).toBeGreaterThan(0);
  });

  it('players do not oscillate between destinations', () => {
    let changes = 0;
    let playerRounds = 0;
    for (const { evs } of rounds) {
      const last = new Map<string, string>();
      for (const e of evs) {
        if (e.type !== 'ai') continue;
        for (const a of e.assign) {
          const k = a.dest ? `${Math.round(a.dest.x)},${Math.round(a.dest.y)}` : '-';
          if (last.has(a.playerId) && last.get(a.playerId) !== k) changes++;
          last.set(a.playerId, k);
        }
      }
      playerRounds += 10;
    }
    expect(changes / playerRounds).toBeLessThan(3);
  });

  it('every simulated map passes the invariant checker', () => {
    for (const m of maps) expect(checkInvariants(m.events, HARBOR, MR12_STANDARD)).toEqual([]);
  });
});

describe('tactical AI: scenarios', () => {
  const seeds = Array.from({ length: 10 }, (_, i) => `sc-${i}`);
  const attackerWins = (sc: ScenarioSetup) => seeds.map((s) => firstRound(s, sc)).filter((r) => r.winner === 0).length;

  it('5v4 favours the attackers more than 4v5 (numbers matter)', () => {
    expect(attackerWins({ attackers: 5, defenders: 4 })).toBeGreaterThan(attackerWins({ attackers: 4, defenders: 5 }));
  });

  it('5v3 is usually won by the side with five', () => {
    expect(attackerWins({ attackers: 5, defenders: 3 })).toBeGreaterThanOrEqual(6);
  });

  it('3v3 post-plant: attackers spread on post-plant spots, defenders retake as a group', () => {
    const r = firstRound('pp-1', { attackers: 3, defenders: 3, planted: 'A' });
    const ai = r.events.filter((e): e is Ai => e.type === 'ai');
    expect(ai.some((e) => e.team === 0 && e.phase === 'postplant')).toBe(true);
    expect(ai.some((e) => e.team === 1 && e.phase === 'retake A')).toBe(true);
    const push = ai.find((e) => e.team === 1 && e.phase === 'retake A')!;
    expect(push.note).toMatch(/ready/);
    // Players sitting the scenario out never spawn; leave their end-of-round money out of the check.
    const spawned = new Set(r.events.filter((e) => e.type === 'spawn').map((e) => (e as { playerId: string }).playerId));
    const evs = r.events.filter((e) => e.type !== 'money' || spawned.has(e.playerId));
    expect(checkInvariants(evs, HARBOR, MR12_STANDARD).filter((v) => !v.includes('map_end') && !v.includes('round starts') && !v.includes('seq gap') && !v.includes('map stopped'))).toEqual([]);
  });

  it('post-plant retakes are hard but possible (defenders win some, not most)', () => {
    const wins = seeds.map((s) => firstRound(s, { attackers: 3, defenders: 3, planted: 'B' })).filter((r) => r.winner === 1).length;
    expect(wins).toBeGreaterThanOrEqual(1);
    expect(wins).toBeLessThanOrEqual(7);
  });

  it('2v2 and 1v3 rounds always finish legally (nobody waits for an impossible condition)', () => {
    for (const s of seeds.slice(0, 5)) {
      for (const sc of [{ attackers: 2, defenders: 2 }, { attackers: 1, defenders: 3 }, { attackers: 3, defenders: 1 }]) {
        const r = firstRound(s, sc);
        expect(['attackers_eliminated', 'defenders_eliminated', 'bomb_detonated', 'bomb_defused', 'time_expired']).toContain(r.reason);
      }
    }
  });
});
