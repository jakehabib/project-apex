import { describe, expect, it } from 'vitest';
import type { MatchEvent, MatchEventInput } from '../../src/core/match/events';
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
import { addTotals, amrFromTotals, computeAmr, duelValue, emptyTotals } from '../../src/core/match/stats/amr';
import { gearScore } from '../../src/core/match/stats/winprob';

/** Minimal event-stream builder: 5v5, team 0 attacks. */
function stream() {
  const ev: MatchEvent[] = [];
  let seq = 0;
  let round = -1;
  const push = (e: MatchEventInput) => ev.push({ ...e, seq: seq++, roundIndex: round } as MatchEvent);
  const ids = [0, 1].flatMap((t) => [0, 1, 2, 3, 4].map((i) => `t${t}p${i}`));
  for (const id of ids) push({ type: 'spawn', tMs: -1, playerId: id, team: id.startsWith('t0') ? 0 : 1, side: id.startsWith('t0') ? 'attacker' : 'defender', nodeId: 'n', pos: { x: 0, y: 0 } });
  return {
    ev,
    round(gear: { t0: 'rifle' | 'pistol'; t1: 'rifle' | 'pistol' }, body: (r: { kill: (a: string, v: string, at?: number) => void }) => void, winner: 0 | 1) {
      round++;
      push({ type: 'round_start', tMs: 0, attackerTeam: 0, scores: [0, 0], buyTypes: ['full', 'full'], plan: '' });
      push({
        type: 'loadout', tMs: 0,
        loadouts: ids.map((id) => {
          const g = id.startsWith('t0') ? gear.t0 : gear.t1;
          return { playerId: id, primary: g === 'rifle' ? 'kraken' : null, secondary: 'vanta9', armor: g === 'rifle' ? 100 : 0, helmet: g === 'rifle', kit: false, utility: [], money: 0, bomb: false };
        }),
      });
      body({
        kill: (a, v, at = 1000) => {
          push({ type: 'damage', tMs: at, attackerId: a, victimId: v, weaponId: 'kraken', amount: 100, armorAfter: 0, headshot: false, hpAfter: 0, attackerPos: { x: 0, y: 0 }, victimPos: { x: 0, y: 0 } });
          push({ type: 'kill', tMs: at, attackerId: a, victimId: v, weaponId: 'kraken', headshot: false, tradeOfPlayerId: null, assisterIds: [], victimPos: { x: 0, y: 0 } });
        },
      });
      push({ type: 'round_end', tMs: 5000, winnerTeam: winner, reason: winner === 0 ? 'defenders_eliminated' : 'attackers_eliminated', scores: [0, 0] });
    },
  };
}

describe('AMR (APEX Match Rating)', () => {
  it('values hard duels above easy ones, within clamps', () => {
    const rifle = gearScore('kraken', 'vanta9', 100);
    const pistol = gearScore(null, 'vanta9', 0);
    expect(duelValue(pistol, rifle)).toBeGreaterThan(duelValue(rifle, rifle));
    expect(duelValue(rifle, rifle)).toBeCloseTo(1, 5);
    expect(duelValue(rifle, pistol)).toBeLessThan(1);
    expect(duelValue(rifle, pistol)).toBeGreaterThanOrEqual(0.5);
    expect(duelValue(pistol, rifle)).toBeLessThanOrEqual(1.6);
  });

  it('a gun-round kill is worth more than an anti-eco kill', () => {
    const gun = stream();
    gun.round({ t0: 'rifle', t1: 'rifle' }, (r) => r.kill('t0p0', 't1p0'), 1);
    const eco = stream();
    eco.round({ t0: 'rifle', t1: 'pistol' }, (r) => r.kill('t0p0', 't1p0'), 1);
    const a = amrFromTotals(computeAmr(gun.ev).get('t0p0')!.total);
    const b = amrFromTotals(computeAmr(eco.ev).get('t0p0')!.total);
    expect(a.kill).toBeGreaterThan(b.kill);
    expect(a.amr).toBeGreaterThan(b.amr);
  });

  it('round swing: a kill from behind (4v5) is worth more than a kill while ahead (5v2)', () => {
    const behind = stream();
    behind.round({ t0: 'rifle', t1: 'rifle' }, (r) => {
      r.kill('t1p0', 't0p0', 500);
      r.kill('t0p1', 't1p1', 1000);
    }, 0);
    const ahead = stream();
    ahead.round({ t0: 'rifle', t1: 'rifle' }, (r) => {
      r.kill('t0p0', 't1p0', 400);
      r.kill('t0p0', 't1p1', 500);
      r.kill('t0p2', 't1p2', 600);
      r.kill('t0p1', 't1p3', 1000);
    }, 0);
    const sb = computeAmr(behind.ev).get('t0p1')!.total.swing;
    const sa = computeAmr(ahead.ev).get('t0p1')!.total.swing;
    expect(sb).toBeGreaterThan(sa);
    // Zero-sum per kill: the victim loses what the killer's side gains.
    const v = computeAmr(behind.ev).get('t1p1')!.total.swing;
    expect(v).toBeLessThan(0);
  });

  it('surviving a lost round without contributing earns less than surviving a won round', () => {
    const won = stream();
    won.round({ t0: 'rifle', t1: 'rifle' }, () => {}, 0);
    const lost = stream();
    lost.round({ t0: 'rifle', t1: 'rifle' }, () => {}, 1);
    expect(computeAmr(won.ev).get('t0p3')!.total.survivalScore).toBeGreaterThan(computeAmr(lost.ev).get('t0p3')!.total.survivalScore);
  });

  it('more meaningful performance raises AMR; padding with anti-eco kills does not overpower it', () => {
    // Player X: 3 gun-round kills across 3 rounds. Player Y: 5 kills, all on eco rounds, but dies in the gun rounds.
    const s = stream();
    s.round({ t0: 'rifle', t1: 'rifle' }, (r) => r.kill('t0p0', 't1p0'), 0);
    s.round({ t0: 'rifle', t1: 'rifle' }, (r) => r.kill('t0p0', 't1p0'), 0);
    s.round({ t0: 'rifle', t1: 'rifle' }, (r) => r.kill('t0p0', 't1p0'), 0);
    const x = amrFromTotals(computeAmr(s.ev).get('t0p0')!.total);
    const s2 = stream();
    s2.round({ t0: 'rifle', t1: 'pistol' }, (r) => {
      r.kill('t0p0', 't1p0', 300);
      r.kill('t0p0', 't1p1', 400);
      r.kill('t0p0', 't1p2', 500);
    }, 0);
    s2.round({ t0: 'rifle', t1: 'rifle' }, (r) => r.kill('t1p0', 't0p0'), 1);
    s2.round({ t0: 'rifle', t1: 'pistol' }, (r) => {
      r.kill('t0p0', 't1p0', 300);
      r.kill('t0p0', 't1p1', 400);
    }, 0);
    const y = amrFromTotals(computeAmr(s2.ev).get('t0p0')!.total);
    expect(y.kpr).toBeGreaterThan(x.kpr);
    expect(x.amr).toBeGreaterThan(y.amr * 0.85); // padded kills don't run away with the rating
  });

  it('aggregates from totals (series/season ratings), not by averaging map ratings', () => {
    const a = stream();
    a.round({ t0: 'rifle', t1: 'rifle' }, (r) => r.kill('t0p0', 't1p0'), 0);
    const b = stream();
    for (let i = 0; i < 4; i++) b.round({ t0: 'rifle', t1: 'rifle' }, () => {}, 1);
    const ta = computeAmr(a.ev).get('t0p0')!.total;
    const tb = computeAmr(b.ev).get('t0p0')!.total;
    const series = amrFromTotals(addTotals(addTotals(emptyTotals(), ta), tb));
    const naive = (amrFromTotals(ta).amr + amrFromTotals(tb).amr) / 2;
    expect(series.amr).not.toBeCloseTo(naive, 2);
    expect(series.amr).toBeLessThan(naive); // the 4-round blank weighs more than the 1-round map
  });

  it('is deterministic and averages ≈1.00 over a population of engine maps, with T/CT splits', () => {
    const vals: number[] = [];
    for (let i = 0; i < 8; i++) {
      const r = simulateMap({ matchId: 'amr', mapIndex: 0, seed: `amr-t-${i}`, map: MAP_POOL[i % 2]!, ruleset: MR12_STANDARD, teams: [syntheticTeam('a', 60, `x${i}`), syntheticTeam('b', 60, `y${i}`)], firstAttacker: 0 });
      const m1 = computeAmr(r.events);
      const m2 = computeAmr(r.events);
      for (const [id, p] of m1) {
        expect(amrFromTotals(p.total)).toEqual(amrFromTotals(m2.get(id)!.total));
        expect(p.bySide.attacker.rounds + p.bySide.defender.rounds).toBe(p.total.rounds);
        vals.push(amrFromTotals(p.total).amr);
      }
    }
    const mean = vals.reduce((s, x) => s + x, 0) / vals.length;
    expect(mean).toBeGreaterThan(0.85);
    expect(mean).toBeLessThan(1.15);
  }, 60_000);
});
