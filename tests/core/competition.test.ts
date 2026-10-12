import { describe, expect, it } from 'vitest';
import { computeStandings, recencyWeight } from '../../src/core/competition/arp';
import { advanceTo, createEcosystem } from '../../src/core/competition/ecosystem';
import { doubleElimination, gslGroups, singleElimination, swiss, type Entrant, type Resolver } from '../../src/core/competition/formats';
import { continuityAfter, createRegistry, syncLineages } from '../../src/core/competition/lineage';
import { POOL_IDS } from '../../src/core/competition/mapPool';
import { quickResolver } from '../../src/core/competition/quickResolver';
import { addSeries, createStore, type SeriesRecord } from '../../src/core/competition/records';
import { sampleSeason, validate } from '../../src/core/competition/validation';
import { runVeto } from '../../src/core/competition/veto';
import { Rng } from '../../src/core/rng/prng';
import { dayOf } from '../../src/core/world/calendar';
import { generateWorld } from '../../src/core/world/generate';
import type { Region } from '../../src/core/world/types';

const entrants = (n: number): Entrant[] => Array.from({ length: n }, (_, i) => ({ lineageId: `L${i + 1}`, orgId: `o${i + 1}`, seed: i + 1 }));
/** Better seed always wins, so bracket results are predictable. */
const chalk: Resolver = (r) => ({ winner: r.a.seed < r.b.seed ? 'a' : 'b', maps: [{ mapId: 'harbor', a: r.a.seed < r.b.seed ? 13 : 7, b: r.a.seed < r.b.seed ? 7 : 13 }] });
const opts = { id: 't', name: 'Stage', startDay: 0, days: 3, bestOf: 3 as const };

describe('map veto', () => {
  it('produces legal BO1/BO3/BO5 series from a 7-map pool', () => {
    const prefs = [Object.fromEntries(POOL_IDS.map((m, i) => [m, i])), Object.fromEntries(POOL_IDS.map((m, i) => [m, -i]))] as const;
    for (const bo of [1, 3, 5] as const) {
      const v = runVeto(POOL_IDS, bo, prefs, Rng.fromSeed(`veto-${bo}`));
      const used = v.steps.map((s) => s.mapId);
      expect(new Set(used).size).toBe(7);
      expect(v.maps.length).toBe(bo);
      expect(v.steps.filter((s) => s.action === 'decider').length).toBe(1);
      expect(v.steps.filter((s) => s.action === 'pick').length).toBe(bo - 1);
      for (const m of v.maps.filter((x) => x.pickedBy !== null)) expect(m.startDefender === 0 || m.startDefender === 1).toBe(true);
    }
  });
  it('rejects a pool that is not seven distinct maps', () => {
    expect(() => runVeto(POOL_IDS.slice(0, 6), 3, [{}, {}], Rng.fromSeed('x'))).toThrow();
  });
});

describe('tournament formats', () => {
  it('single elimination crowns the top seed under chalk and supports byes', () => {
    const r = singleElimination(entrants(8), opts, chalk);
    expect(r.order[0]!.lineageId).toBe('L1');
    expect(r.series.length).toBe(7);
    const byes = singleElimination(entrants(6), opts, chalk);
    expect(byes.series.length).toBe(5);
    expect(byes.order.length).toBe(6);
  });
  it('double elimination plays every team at least twice unless champion', () => {
    const r = doubleElimination(entrants(8), opts, chalk);
    expect(r.order[0]!.lineageId).toBe('L1');
    expect(r.order.length).toBe(8);
    expect(r.series.length).toBe(14);
  });
  it('Swiss advances teams at three wins and eliminates at three losses', () => {
    const r = swiss(entrants(16), { ...opts, winsNeeded: 3, lossesOut: 3 }, chalk);
    expect(r.advancing.length).toBe(8);
    const ids = new Set(r.series.map((s) => s.req.seriesId));
    expect(ids.size).toBe(r.series.length); // no duplicate series ids
  });
  it('GSL groups advance the top two of each group', () => {
    const r = gslGroups(entrants(16), opts, chalk);
    expect(r.advancing.length).toBe(8);
    expect(r.series.length).toBe(20);
  });
});

describe('roster continuity (lineage)', () => {
  it('keeps the lineage with 2 changes, loses it with 3, and a moved core takes its history along', () => {
    const w = generateWorld({ seed: 'lin', orgsPerRegion: { EU: 4, AM: 2, AS: 2 }, freeAgents: 20 });
    const reg = createRegistry();
    syncLineages(reg, w, 0);
    const [a, b] = [...w.orgs.values()];
    const la = reg.activeByOrg.get(a!.id)!;
    const fa = [...w.players.values()].filter((p) => !p.orgId).map((p) => p.id);
    // Two replacements: same lineage.
    expect(continuityAfter(reg, a!, [...a!.roster.slice(0, 3), fa[0]!, fa[1]!]).keeps).toBe(true);
    a!.roster = [...a!.roster.slice(0, 3), fa[0]!, fa[1]!];
    syncLineages(reg, w, 10);
    expect(reg.activeByOrg.get(a!.id)).toBe(la);
    // Three replacements: new lineage, old one ended.
    expect(continuityAfter(reg, a!, [...a!.roster.slice(0, 2), fa[2]!, fa[3]!, fa[4]!]).keeps).toBe(false);
    a!.roster = [...a!.roster.slice(0, 2), fa[2]!, fa[3]!, fa[4]!];
    syncLineages(reg, w, 20);
    expect(reg.activeByOrg.get(a!.id)).not.toBe(la);
    expect(reg.lineages.get(la)!.endedDay).toBe(20);
    // Core move: org B's players 1-3 move to a new roster at org A; A inherits B's lineage, B starts fresh.
    const lb = reg.activeByOrg.get(b!.id)!;
    const moving = b!.roster.slice(0, 3);
    a!.roster = [...moving, fa[5]!, fa[6]!];
    b!.roster = [...b!.roster.slice(3), fa[7]!, fa[8]!, fa[9]!];
    syncLineages(reg, w, 30);
    expect(reg.activeByOrg.get(a!.id)).toBe(lb);
    expect(reg.activeByOrg.get(b!.id)).not.toBe(lb);
    // Never two active lineages holding the same ≥3 players.
    const active = [...reg.lineages.values()].filter((l) => l.endedDay === null);
    for (let i = 0; i < active.length; i++) for (let j = i + 1; j < active.length; j++) expect(active[i]!.core.filter((p) => active[j]!.core.includes(p)).length).toBeLessThan(3);
  });
});

describe('ARP model', () => {
  const info = { active: () => true, orgOf: (id: string) => id, regionOf: () => 'EU' as Region };
  const series = (id: string, day: number, a: string, b: string, aWins: boolean, ranked = true): SeriesRecord => ({
    id, eventId: 'e', stage: 's', day, ranked, lan: false, tier: 2, a: { lineageId: a, orgId: a }, b: { lineageId: b, orgId: b }, winner: aWins ? 'a' : 'b', maps: [],
  });
  it('beating strong teams is worth more than farming weak ones, and results age out', () => {
    const store = createStore();
    // "strong" has prize money; "weak" has none.
    store.prizes.set('p1', { id: 'p1', eventId: 'e', day: 90, lineageId: 'strong', orgId: 'strong', amount: 500_000, placement: '1st' });
    let k = 0;
    for (let d = 10; d < 100; d += 10) {
      addSeries(store, series(`s${k++}`, d, 'giantkiller', 'strong', true));
      addSeries(store, series(`s${k++}`, d, 'farmer', 'weak', true));
      addSeries(store, series(`s${k++}`, d + 1, 'strong', 'weak', true));
      addSeries(store, series(`s${k++}`, d + 2, 'weak', 'filler', true));
    }
    const st = computeStandings(store, 100, info);
    const arp = (id: string) => st.find((s) => s.lineageId === id)!.arp;
    expect(arp('giantkiller')).toBeGreaterThan(arp('farmer'));
    expect(recencyWeight(10)).toBe(1);
    expect(recencyWeight(200)).toBe(0);
    expect(computeStandings(store, 400, info).length).toBe(0);
  });
  it('duplicate records are rejected and unranked matches never count', () => {
    const store = createStore();
    const r = series('dup', 5, 'a', 'b', true);
    expect(addSeries(store, r)).toBe(true);
    expect(addSeries(store, r)).toBe(false);
    expect(() => addSeries(store, { ...r, winner: 'b' })).toThrow();
    for (let i = 0; i < 6; i++) addSeries(store, series(`x${i}`, 10 + i, 'a', 'b', true, false));
    expect(computeStandings(store, 30, info).length).toBe(0); // only 1 ranked series: below the listing minimum
  });
});

describe('ecosystem (short run)', () => {
  it('runs two seasons deterministically and passes the brief checks', () => {
    const run = () => {
      const w = generateWorld({ seed: 'eco-test' });
      const eco = createEcosystem(w, quickResolver(w, 'eco-test'), dayOf(0, 0, 1) - 1);
      advanceTo(eco, dayOf(1, 11, 31));
      return { eco, history: [sampleSeason(eco, 1)] };
    };
    const a = run();
    const b = run();
    expect(a.eco.store.series.size).toBe(b.eco.store.series.size);
    expect(JSON.stringify(a.eco.snapshots.at(-1)!.standings.slice(0, 20))).toBe(JSON.stringify(b.eco.snapshots.at(-1)!.standings.slice(0, 20)));
    const checks = validate(a.eco, a.history).filter((c) => !['climbers', 'coherence'].includes(c.id));
    for (const c of checks) expect(c.pass, `${c.label}: ${c.detail}`).toBe(true);
  }, 120_000);
});
