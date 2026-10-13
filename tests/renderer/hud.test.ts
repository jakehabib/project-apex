import { describe, expect, it } from 'vitest';
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
import { computeMapStats } from '../../src/core/match/stats/stats';
import { hudAt, roundInfo } from '../../src/renderer/broadcast/hudState';

describe('broadcast HUD state is derived from the event log', () => {
  const r = simulateMap({ matchId: 'hud', mapIndex: 0, seed: 'hud-1', map: MAP_POOL[0]!, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('aaa', 62, 'h1'), syntheticTeam('bbb', 62, 'h2')], firstAttacker: 0 });
  const last = r.rounds.length - 1;

  it('at the start of a round, money and equipment equal the loadout', () => {
    const info = roundInfo(r.events, 3);
    const h = hudAt(r.events, 3, 0, info);
    const loadout = r.events.find((e) => e.type === 'loadout' && e.roundIndex === 3);
    if (!loadout || loadout.type !== 'loadout') throw new Error('no loadout');
    for (const p of h.players) {
      const l = loadout.loadouts.find((x) => x.playerId === p.id)!;
      expect(p.money).toBe(l.money);
      expect(p.primary).toBe(l.primary);
      expect(p.hp).toBe(100);
    }
  });

  it('final K/D on the HUD matches the map statistics', () => {
    const info = roundInfo(r.events, last);
    const h = hudAt(r.events, last, info.end!.tMs + 1, info);
    const stats = computeMapStats(r.events);
    for (const p of h.players) {
      const s = stats.players.get(p.id)!;
      expect(p.kills).toBe(s.kills);
      expect(p.deaths).toBe(s.deaths);
    }
    expect(h.scores).toEqual(r.scores);
  });

  it('the kill feed lists exactly the round kills up to the playback time', () => {
    const info = roundInfo(r.events, 5);
    const kills = r.events.filter((e) => e.type === 'kill' && e.roundIndex === 5);
    const mid = kills[Math.floor(kills.length / 2)]!.tMs;
    expect(hudAt(r.events, 5, mid, info).feed.length).toBe(kills.filter((k) => k.tMs <= mid).length);
  });
});
