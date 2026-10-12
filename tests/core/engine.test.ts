import { describe, expect, it } from 'vitest';
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
import { checkInvariants } from '../../src/core/match/stats/invariants';
import { computeMapStats } from '../../src/core/match/stats/stats';

const run = (seed: string, mapIdx = 0, skills: [number, number] = [60, 60], presets: [string, string] = ['balanced', 'balanced']) =>
  simulateMap({
    matchId: `m-${seed}`, mapIndex: 0, seed, map: MAP_POOL[mapIdx]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('aaa', skills[0], seed, presets[0]), syntheticTeam('bbb', skills[1], seed + 'b', presets[1])], firstAttacker: 0,
  });

describe('match engine', () => {
  it('is deterministic: identical inputs give identical events', () => {
    const a = run('det');
    const b = run('det');
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.events.length).toBe(b.events.length);
  });

  it('pins a golden map result (regression guard; update deliberately)', () => {
    const r = run('golden');
    expect({ scores: r.scores, rounds: r.rounds.length, fingerprint: r.fingerprint }).toMatchSnapshot();
  });

  for (const mapIdx of [0, 1]) {
    for (const seed of ['inv-1', 'inv-2', 'inv-3', 'inv-4', 'inv-5', 'inv-6']) {
      it(`map ${MAP_POOL[mapIdx]!.id} seed ${seed}: every invariant holds`, () => {
        const presets = ['balanced', 'aggressive', 'methodical', 'utility', 'retake'];
        const r = run(seed, mapIdx, [55 + (seed.length % 3) * 5, 60], [presets[seed.charCodeAt(4) % 5]!, presets[(seed.charCodeAt(4) + 2) % 5]!]);
        const violations = checkInvariants(r.events, MAP_POOL[mapIdx]!, MR12_STANDARD);
        expect(violations.slice(0, 10)).toEqual([]);
        expect(r.winnerTeam === null ? r.scores[0] === r.scores[1] : r.scores[r.winnerTeam]! > r.scores[1 - r.winnerTeam]!).toBe(true);
      });
    }
  }

  it('statistics reconcile with the event log', () => {
    const r = run('stats');
    const s = computeMapStats(r.events);
    const players = [...s.players.values()];
    const kills = r.events.filter((e) => e.type === 'kill').length;
    expect(players.reduce((t, p) => t + p.kills, 0)).toBe(kills);
    expect(players.reduce((t, p) => t + p.deaths, 0)).toBe(kills);
    expect(s.roundsPlayed).toBe(r.rounds.length);
    for (const p of players) {
      expect(p.rounds).toBe(r.rounds.length);
      expect(p.kills).toBeGreaterThanOrEqual(p.headshotKills);
      expect(p.kastRounds).toBeLessThanOrEqual(p.rounds);
      expect(p.survived + p.deaths).toBe(p.rounds);
    }
    for (const t of [0, 1] as const) {
      expect(s.teams[t].attackWins + s.teams[t].defenseWins).toBe(r.scores[t]);
    }
    const dmg = r.events.filter((e) => e.type === 'damage').reduce((t, e) => t + (e.type === 'damage' ? e.amount : 0), 0);
    expect(players.reduce((t, p) => t + p.damage, 0)).toBe(dmg);
    const opening = players.reduce((t, p) => t + p.openingKills, 0);
    expect(opening).toBe(r.rounds.filter((rd) => true).length - countRoundsWithoutKills(r.events));
  });
});

function countRoundsWithoutKills(events: ReturnType<typeof run>['events']): number {
  const withKill = new Set(events.filter((e) => e.type === 'kill').map((e) => e.roundIndex));
  const rounds = new Set(events.filter((e) => e.type === 'round_end').map((e) => e.roundIndex));
  return [...rounds].filter((r) => !withKill.has(r)).length;
}
