import { describe, expect, it } from 'vitest';
import { advance, autoPlay, createCareer, loadCareer, nextMapInput, pendingSeries, recordMap, saveCareer, type Career } from '../../src/core/career/career';
import { decode, encode } from '../../src/core/career/codec';
import { compactEcosystem, liveStandings } from '../../src/core/competition/ecosystem';
import { simulateMap, type MapResult } from '../../src/core/match/engine/match';
import type { MapSimInput } from '../../src/core/match/engine/types';
import { Rng } from '../../src/core/rng/prng';
import { dayOf } from '../../src/core/world/calendar';
import { generateWorld } from '../../src/core/world/generate';

/** Fast stand-in for the engine (tests of career flow, not of match play): a seeded scoreline. */
function stubSim(input: MapSimInput): MapResult {
  const rng = Rng.fromSeed(input.seed);
  const userWins = rng.chance(0.5);
  const loser = rng.int(3, 11);
  const scores: [number, number] = userWins ? [13, loser] : [loser, 13];
  return { engineVersion: 'stub', matchId: input.matchId, mapId: input.map.id, seed: input.seed, teamIds: [input.teams[0].id, input.teams[1].id], winnerTeam: userWins ? 0 : 1, scores, rounds: [], events: [], fingerprint: 'stub' };
}

const playAll = (c: Career, days: number) => {
  let left = days;
  let guard = 0;
  while (left > 0 && guard++ < 500) {
    const r = advance(c, left);
    left -= r.days;
    const s = pendingSeries(c);
    if (s) autoPlay(c, s.id, stubSim);
  }
  // Leave no day half-finished.
  while (c.pendingDay !== null && guard++ < 600) {
    advance(c, 0);
    const s = pendingSeries(c);
    if (s) autoPlay(c, s.id, stubSim);
  }
};

function freshCareer(seed = 'career-test'): Career {
  return createCareer({ seed, world: generateWorld({ seed }), orgId: [...generateWorld({ seed }).orgs.values()].find((o) => o.homeRegion === 'EU' && o.archetype === 'contender')!.id });
}

describe('save codec', () => {
  it('round-trips maps, sets and generators', () => {
    const rng = Rng.fromSeed('codec');
    rng.next();
    const v = { m: new Map([['a', new Set([1, 2])]]), r: rng, list: [1, 'x', null], nested: { ok: true } };
    const back = decode(JSON.parse(JSON.stringify(encode(v)))) as typeof v;
    expect(back.m.get('a')!.has(2)).toBe(true);
    expect(back.r.next()).toBe(rng.next());
    expect(back.list).toEqual([1, 'x', null]);
  });
});

describe('career mode', () => {
  it('stops on the club’s series and does not move on until it is played', () => {
    const c = freshCareer();
    let r = advance(c, 200);
    for (let i = 0; i < 20 && r.stop !== 'match'; i++) r = advance(c, 200);
    expect(r.stop).toBe('match');
    const s = pendingSeries(c)!;
    expect(s.mapOrder.length).toBe(s.bestOf);
    const day = c.eco.world.day;
    expect(advance(c, 30)).toMatchObject({ stop: 'match', days: 0 });
    expect(c.eco.world.day).toBe(day);
    autoPlay(c, s.id, stubSim);
    expect(s.outcome).not.toBeNull();
    advance(c, 0);
    // The event continues with the stored result: the series appears in the records exactly as played.
    if (!pendingSeries(c)) {
      const rec = c.eco.store.series.get(s.id)!;
      expect(rec.winner).toBe(s.outcome!.winner);
      expect(rec.maps).toEqual(s.outcome!.maps);
    }
  });

  it('a real engine map is recorded with stat lines from its events', () => {
    const c = freshCareer('career-engine');
    let r = advance(c, 200);
    for (let i = 0; i < 20 && r.stop !== 'match'; i++) r = advance(c, 200);
    const s = pendingSeries(c)!;
    const input = nextMapInput(c, s);
    const res = simulateMap(input);
    recordMap(c, s, input, res, [], true);
    const m = s.played[0]!;
    expect(m.lines.length).toBe(10);
    expect(m.lines.reduce((t, l) => t + l.kills, 0)).toBe(res.events.filter((e) => e.type === 'kill').length);
    // Re-watching uses the stored inputs and reproduces the map exactly.
    const again = simulateMap({ ...input, teams: m.teams, seed: m.seed, firstAttacker: m.firstAttacker, instructions: m.instructions });
    expect(again.fingerprint).toBe(res.fingerprint);
  }, 30000);

  it('is deterministic and survives save/load mid-season, including a pending series', () => {
    const a = freshCareer('career-det');
    const b = freshCareer('career-det');
    playAll(a, 150);
    playAll(b, 150);
    expect(saveCareer(a)).toBe(saveCareer(b));
    // Stop at a pending series, save, load, and finish both ways.
    let r = advance(a, 200);
    for (let i = 0; i < 20 && r.stop !== 'match'; i++) r = advance(a, 200);
    const c = loadCareer(saveCareer(a));
    expect(pendingSeries(c)?.id).toBe(pendingSeries(a)?.id);
    playAll(a, 120);
    playAll(c, 120);
    expect(saveCareer(c)).toBe(saveCareer(a));
  }, 60000);

  it('expired contracts at the club leave at the window unless extended', () => {
    const c = freshCareer('career-contracts');
    const org = c.eco.world.orgs.get(c.userOrgId)!;
    const p = c.eco.world.players.get(org.roster[0]!)!;
    p.contract = { ...p.contract!, endDay: dayOf(1, 6, 1) };
    playAll(c, dayOf(1, 6, 2) - c.eco.world.day);
    expect(p.orgId).not.toBe(org.id);
    expect(c.inbox.some((m) => m.kind === 'window' && m.title.includes(p.nickname))).toBe(true);
  }, 60000);

  it('compaction keeps rankings identical', () => {
    const c = freshCareer('career-compact');
    playAll(c, 200);
    const day = c.eco.world.day;
    const before = JSON.stringify(liveStandings(c.eco, day));
    compactEcosystem(c.eco, day, c.userOrgId);
    expect(JSON.stringify(liveStandings(c.eco, day))).toBe(before);
  }, 60000);
});
