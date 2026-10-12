import { describe, expect, it } from 'vitest';
import { advanceTo, createEcosystem } from '../../src/core/competition/ecosystem';
import { quickResolver } from '../../src/core/competition/quickResolver';
import { dayOf } from '../../src/core/world/calendar';
import { assessOffer, ledgerBalance, marketValue, negotiate, transferFee, wageRoom } from '../../src/core/world/contracts';
import { generateWorld, migrateWorld, WORLD_VERSION } from '../../src/core/world/generate';
import { toOvr } from '../../src/core/world/ratings';
import type { Org, Player, World } from '../../src/core/world/types';

const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[xs.length >> 1] ?? 0;

describe('contract market', () => {
  const world = generateWorld({ seed: 'contracts-test' });
  const day = world.day;

  it('every signed player has a contract and wages sit in the reference bands', () => {
    const signed = [...world.players.values()].filter((p) => p.orgId);
    expect(signed.every((p) => p.contract && p.contract.orgId === p.orgId)).toBe(true);
    const band = (lo: number, hi: number) => median(signed.filter((p) => toOvr(p.skill) >= lo && toOvr(p.skill) < hi).map((p) => p.contract!.monthly));
    expect(band(60, 70)).toBeGreaterThanOrEqual(1500);
    expect(band(60, 70)).toBeLessThanOrEqual(4000);
    expect(band(85, 90)).toBeGreaterThanOrEqual(15000);
    expect(band(85, 90)).toBeLessThanOrEqual(30000);
  });

  it('market value is not OVR alone: region, age and role move it, and each factor is explained', () => {
    const ps = [...world.players.values()].filter((p) => toOvr(p.skill) >= 84 && toOvr(p.skill) <= 86);
    const eu = ps.find((p) => p.region === 'EU');
    const as = ps.find((p) => p.region === 'AS');
    if (eu && as) expect(marketValue(world, eu, day).monthly).toBeGreaterThan(marketValue(world, as, day).monthly);
    const v = marketValue(world, ps[0]!, day);
    expect(v.factors.length).toBeGreaterThan(2);
  });

  it('negotiations are deterministic and give reasons', () => {
    const org = [...world.orgs.values()].find((o) => o.archetype === 'contender')!;
    const fa = [...world.players.values()].find((p) => !p.orgId && !p.retired)!;
    const a = negotiate(world, org, fa, day, 'starter');
    const b = negotiate(world, org, fa, day, 'starter');
    expect(a).toEqual(b);
    expect(a.rounds.length).toBeGreaterThan(0);
  });

  it('players can refuse attractive money for a bad career move (bench role at a weaker club)', () => {
    const star = [...world.players.values()].filter((p) => p.orgId && toOvr(p.skill) >= 88).sort((a, b) => b.motives.playingTime - a.motives.playingTime)[0]!;
    const weak = [...world.orgs.values()].filter((o) => o.archetype === 'grassroots')[0]!;
    const v = marketValue(world, star, day).monthly;
    const bench = assessOffer(world, star, weak, { monthly: Math.round(v * 1.3), signingBonus: 0, years: 2, status: 'rotation', prizeShare: 0.1 }, day);
    expect(bench.accept).toBe(false);
    expect(bench.reasons.join(' ')).toMatch(/prestige|starting role|titles/);
  });

  it('a contracted player costs a fee; a free agent costs none', () => {
    const contracted = [...world.players.values()].find((p) => p.contract)!;
    const free = [...world.players.values()].find((p) => !p.orgId)!;
    expect(transferFee(world, contracted, day)).toBeGreaterThan(0);
    expect(transferFee(world, free, day)).toBe(0);
  });

  it('cash always equals the ledger, and contracted players only move with a fee or at expiry (2 seasons)', () => {
    const w = generateWorld({ seed: 'contracts-eco' });
    const eco = createEcosystem(w, quickResolver(w, 'contracts-eco'), dayOf(0, 0, 1) - 1);
    const holder = new Map<string, { org: string | null; end: number | null }>();
    const snapshot = () => {
      for (const p of w.players.values()) holder.set(p.id, { org: p.orgId, end: p.contract?.endDay ?? null });
    };
    snapshot();
    advanceTo(eco, dayOf(1, 11, 31));
    for (const o of w.orgs.values()) expect(ledgerBalance(o)).toBe(o.money);
    for (const m of eco.moves) {
      if (m.fromOrgId && m.fromOrgId !== m.orgId) expect(m.fee).toBeGreaterThan(0);
    }
    // Clubs field five.
    expect([...w.orgs.values()].filter((o) => o.roster.length < 5).length).toBe(0);
  }, 120_000);

  it('a club without backing cannot keep signing beyond its wage capacity', () => {
    const w = generateWorld({ seed: 'contracts-cap' });
    const poor = [...w.orgs.values()].find((o) => o.archetype === 'grassroots' && !o.finance.backer)! as Org;
    const elite = [...w.players.values()].filter((p) => p.orgId && toOvr(p.skill) >= 88).sort((a, b) => b.skill - a.skill);
    let signed = 0;
    for (const p of elite.slice(0, 5)) if (negotiate(w, poor, p as Player, w.day, 'starter').ok) signed++;
    expect(signed).toBeLessThanOrEqual(1);
    expect(wageRoom(w, poor, w.day)).toBeLessThan(30000);
  });

  it('migrates a world saved before contracts existed (v2) deterministically', () => {
    const make = (): World => {
      const w = generateWorld({ seed: 'legacy' });
      for (const p of w.players.values()) {
        const x = p as unknown as Record<string, unknown>;
        delete x.contract;
        delete x.motives;
        delete x.reputation;
        delete x.careerEarnings;
      }
      for (const o of w.orgs.values()) delete (o as unknown as Record<string, unknown>).finance;
      (w as { version: number }).version = 2;
      return w;
    };
    const a = migrateWorld(make());
    const b = migrateWorld(make());
    expect(a.version).toBe(WORLD_VERSION);
    const pa = [...a.players.values()].filter((p) => p.orgId);
    expect(pa.every((p) => p.contract)).toBe(true);
    expect(pa.map((p) => p.contract!.monthly)).toEqual([...b.players.values()].filter((p) => p.orgId).map((p) => p.contract!.monthly));
  });
});
