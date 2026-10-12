/**
 * APEX Match Rating (AMR): a performance rating in the structure of HLTV Rating 3.0,
 * implemented as an original APEX calculation (docs/AMR_BRIEF.md). It is a pure fold
 * over match events and never influences the simulation.
 *
 *   AMR = 0.30·Kill + 0.20·Swing + 0.15·Damage + 0.15·Survival + 0.10·KAST + 0.10·Multi-kill
 *
 * Each sub-rating is a per-round rate divided by a population reference, so an
 * average player scores ≈ 1.00. Aggregates (series, event, season, career, side)
 * add raw totals and only then divide: never an average of match ratings.
 */
import type { MatchEvent, Side } from '../events';
import { attackerWinProbability, gearScore } from './winprob';

export interface AmrConfig {
  readonly weights: { readonly kill: number; readonly swing: number; readonly damage: number; readonly survival: number; readonly kast: number; readonly multi: number };
  /** Population means of the per-round raw rates (calibrated by `scripts/amr-calibrate.ts`). */
  readonly ref: { readonly kill: number; readonly damage: number; readonly survival: number; readonly kast: number; readonly multi: number };
  /** Swing per round that maps to ±1.00 on the Swing sub-rating. */
  readonly swingScale: number;
  /** Duel difficulty: logistic slope on the gear gap, and value clamps. */
  readonly duelSlope: number;
  readonly killValueMin: number;
  readonly killValueMax: number;
  /** Share of a kill's swing for the killer; the rest goes to damage and flash assisters. */
  readonly killerShare: number;
  readonly flashAssistWindowMs: number;
}

export const AMR_CONFIG: AmrConfig = {
  weights: { kill: 0.3, swing: 0.2, damage: 0.15, survival: 0.15, kast: 0.1, multi: 0.1 },
  ref: { kill: 0.606, damage: 66.1, survival: 0.413, kast: 0.684, multi: 0.245 },
  swingScale: 0.11,
  duelSlope: 3.2,
  killValueMin: 0.5,
  killValueMax: 1.6,
  killerShare: 0.7,
  flashAssistWindowMs: 2500,
};

/** Raw additive totals. Everything AMR needs at any aggregation level. */
export interface AmrTotals {
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  /** Eco-adjusted kill value sum. */
  adjKills: number;
  /** Raw and eco-adjusted damage (health actually removed). */
  damage: number;
  adjDamage: number;
  survivalScore: number;
  kastRounds: number;
  multiPoints: number;
  swing: number;
  openingKills: number;
  openingDeaths: number;
  clutchesWon: number;
  multiKills: [number, number, number, number];
  flashAssists: number;
}

export const emptyTotals = (): AmrTotals => ({
  rounds: 0, kills: 0, deaths: 0, assists: 0, adjKills: 0, damage: 0, adjDamage: 0, survivalScore: 0, kastRounds: 0, multiPoints: 0, swing: 0,
  openingKills: 0, openingDeaths: 0, clutchesWon: 0, multiKills: [0, 0, 0, 0], flashAssists: 0,
});

export function addTotals(into: AmrTotals, x: AmrTotals): AmrTotals {
  for (const k of Object.keys(into) as (keyof AmrTotals)[]) {
    if (k === 'multiKills') for (let i = 0; i < 4; i++) into.multiKills[i]! += x.multiKills[i]!;
    else (into[k] as number) += x[k] as number;
  }
  return into;
}

export interface AmrBreakdown {
  readonly amr: number;
  readonly kill: number;
  readonly swing: number;
  readonly damage: number;
  readonly survival: number;
  readonly kast: number;
  readonly multi: number;
  /** Plain per-round stats for display. */
  readonly kpr: number;
  readonly dpr: number;
  readonly adr: number;
  readonly adjAdr: number;
  readonly kastPct: number;
  readonly swingPerRound: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function amrFromTotals(t: AmrTotals, cfg: AmrConfig = AMR_CONFIG): AmrBreakdown {
  const n = Math.max(1, t.rounds);
  const kill = t.adjKills / n / cfg.ref.kill;
  const damage = t.adjDamage / n / cfg.ref.damage;
  const survival = t.survivalScore / n / cfg.ref.survival;
  const kast = t.kastRounds / n / cfg.ref.kast;
  const multi = t.multiPoints / n / cfg.ref.multi;
  const swing = Math.max(0, 1 + t.swing / n / cfg.swingScale);
  const w = cfg.weights;
  const amr = w.kill * kill + w.swing * swing + w.damage * damage + w.survival * survival + w.kast * kast + w.multi * multi;
  return {
    amr: r2(amr), kill: r2(kill), swing: r2(swing), damage: r2(damage), survival: r2(survival), kast: r2(kast), multi: r2(multi),
    kpr: r2(t.kills / n), dpr: r2(t.deaths / n), adr: Math.round((t.damage / n) * 10) / 10, adjAdr: Math.round((t.adjDamage / n) * 10) / 10,
    kastPct: Math.round((t.kastRounds / n) * 1000) / 10, swingPerRound: Math.round((t.swing / n) * 1000) / 1000,
  };
}

export interface PlayerAmr {
  readonly playerId: string;
  readonly team: number;
  readonly total: AmrTotals;
  readonly bySide: Record<Side, AmrTotals>;
}

/** Value of a kill (or damage) given attacker and victim equipment: harder duels are worth more. */
export function duelValue(attackerGear: number, victimGear: number, cfg: AmrConfig = AMR_CONFIG): number {
  const pWin = 1 / (1 + Math.exp(-cfg.duelSlope * (attackerGear - victimGear)));
  return Math.max(cfg.killValueMin, Math.min(cfg.killValueMax, (1 - pWin) / 0.5));
}

/** Folds one map's events into per-player AMR totals (overall and per side). */
export function computeAmr(events: readonly MatchEvent[], cfg: AmrConfig = AMR_CONFIG): Map<string, PlayerAmr> {
  const out = new Map<string, PlayerAmr>();
  const teamOf = new Map<string, number>();
  const sideOf = new Map<string, Side>();
  const gear = new Map<string, number>();
  let attackerTeam = 0;
  let alive = new Set<string>();
  let planted = false;
  let firstKill = false;
  // Per-round scratch per player.
  let rk = new Map<string, number[]>(); // kill values this round
  let dmgRound = new Map<string, number>();
  let assisted = new Set<string>();
  let traded = new Set<string>();
  let lastFlash = new Map<string, { by: string; t: number }>();
  let clutch: { id: string } | null = null;

  const get = (id: string): PlayerAmr => {
    let p = out.get(id);
    if (!p) {
      p = { playerId: id, team: teamOf.get(id) ?? 0, total: emptyTotals(), bySide: { attacker: emptyTotals(), defender: emptyTotals() } };
      out.set(id, p);
    }
    return p;
  };
  const both = (id: string, f: (t: AmrTotals) => void) => {
    const p = get(id);
    f(p.total);
    f(p.bySide[sideOf.get(id) ?? 'attacker']);
  };
  const state = () => {
    const live = [...alive];
    const side = (s: Side) => live.filter((id) => sideOf.get(id) === s);
    const meanGear = (ids: string[]) => ids.reduce((a, id) => a + (gear.get(id) ?? 0.5), 0) / Math.max(1, ids.length);
    const att = side('attacker');
    const def = side('defender');
    return attackerWinProbability({ attackersAlive: att.length, defendersAlive: def.length, attackerGear: meanGear(att), defenderGear: meanGear(def), planted });
  };
  /** Credit a change in P(attackers win) to a team's players. */
  const swing = (beforeAtt: number, afterAtt: number, gainer: string, helpers: string[], loser: string | null) => {
    const sideGain = sideOf.get(gainer) === 'attacker' ? afterAtt - beforeAtt : beforeAtt - afterAtt;
    const helperShare = helpers.length ? (1 - cfg.killerShare) / helpers.length : 0;
    both(gainer, (t) => (t.swing += sideGain * (helpers.length ? cfg.killerShare : 1)));
    for (const h of helpers) both(h, (t) => (t.swing += sideGain * helperShare));
    if (loser) both(loser, (t) => (t.swing -= sideGain));
  };

  for (const e of events) {
    switch (e.type) {
      case 'spawn':
        teamOf.set(e.playerId, e.team);
        sideOf.set(e.playerId, e.side);
        get(e.playerId);
        break;
      case 'round_start':
        attackerTeam = e.attackerTeam;
        alive = new Set(teamOf.keys());
        for (const [id, t] of teamOf) sideOf.set(id, t === attackerTeam ? 'attacker' : 'defender');
        planted = false;
        firstKill = false;
        rk = new Map();
        dmgRound = new Map();
        assisted = new Set();
        traded = new Set();
        lastFlash = new Map();
        clutch = null;
        break;
      case 'loadout':
        for (const l of e.loadouts) gear.set(l.playerId, gearScore(l.primary, l.secondary, l.armor));
        break;
      case 'flashed':
        if (teamOf.get(e.byPlayerId) !== teamOf.get(e.playerId)) lastFlash.set(e.playerId, { by: e.byPlayerId, t: e.tMs });
        break;
      case 'damage': {
        if (teamOf.get(e.attackerId) === teamOf.get(e.victimId)) break;
        const v = duelValue(gear.get(e.attackerId) ?? 0.5, gear.get(e.victimId) ?? 0.5, cfg);
        both(e.attackerId, (t) => {
          t.damage += e.amount;
          t.adjDamage += e.amount * v;
        });
        dmgRound.set(e.attackerId, (dmgRound.get(e.attackerId) ?? 0) + e.amount);
        break;
      }
      case 'kill': {
        const enemy = teamOf.get(e.attackerId) !== teamOf.get(e.victimId);
        const before = state();
        alive.delete(e.victimId);
        const after = state();
        both(e.victimId, (t) => t.deaths++);
        if (!enemy) break;
        const v = duelValue(gear.get(e.attackerId) ?? 0.5, gear.get(e.victimId) ?? 0.5, cfg);
        both(e.attackerId, (t) => {
          t.kills++;
          t.adjKills += v;
        });
        rk.set(e.attackerId, [...(rk.get(e.attackerId) ?? []), v]);
        const helpers = [...e.assisterIds];
        for (const a of e.assisterIds) {
          both(a, (t) => t.assists++);
          assisted.add(a);
        }
        const fl = lastFlash.get(e.victimId);
        if (fl && e.tMs - fl.t <= cfg.flashAssistWindowMs && fl.by !== e.attackerId && teamOf.get(fl.by) === teamOf.get(e.attackerId) && !helpers.includes(fl.by)) {
          helpers.push(fl.by);
          both(fl.by, (t) => t.flashAssists++);
          assisted.add(fl.by);
        }
        if (e.tradeOfPlayerId) traded.add(e.tradeOfPlayerId);
        if (!firstKill) {
          firstKill = true;
          both(e.attackerId, (t) => t.openingKills++);
          both(e.victimId, (t) => t.openingDeaths++);
        }
        swing(before, after, e.attackerId, helpers, e.victimId);
        if (!clutch) {
          for (const tm of [0, 1]) {
            const mine = [...alive].filter((id) => teamOf.get(id) === tm);
            if (mine.length === 1 && [...alive].some((id) => teamOf.get(id) !== tm)) {
              clutch = { id: mine[0]! };
              break;
            }
          }
        }
        break;
      }
      case 'plant': {
        const before = state();
        planted = true;
        swing(before, state(), e.playerId, [], null);
        break;
      }
      case 'defuse': {
        // The defuse converts the remaining round probability into a win.
        const before = state();
        swing(before, 0, e.playerId, [], null);
        break;
      }
      case 'round_end': {
        for (const id of teamOf.keys()) {
          const won = teamOf.get(id) === e.winnerTeam;
          const kills = rk.get(id) ?? [];
          const contributed = kills.length > 0 || assisted.has(id) || (dmgRound.get(id) ?? 0) >= 50;
          const survived = alive.has(id);
          // Survival: alive in a won round is good; saving in a lost round without contributing earns little.
          // Deaths in won rounds (often entries opening the site) and traded deaths cost less.
          const surv = survived ? (won ? 1 : contributed ? 0.6 : 0.2) : (traded.has(id) ? 0.35 : 0) + (won ? 0.25 : 0);
          const kast = kills.length > 0 || assisted.has(id) || survived || traded.has(id);
          // Multi-kill rounds, weighted by the difficulty of those kills (anti-eco 5Ks don't dominate).
          const mk = kills.length;
          const avgV = mk ? kills.reduce((a, x) => a + x, 0) / mk : 0;
          const pts = mk >= 2 ? [0, 0, 1, 2.2, 3.6, 5.2][Math.min(5, mk)]! * avgV : 0;
          both(id, (t) => {
            t.rounds++;
            t.survivalScore += surv;
            if (kast) t.kastRounds++;
            t.multiPoints += pts;
            if (mk >= 2) t.multiKills[Math.min(5, mk) - 2]!++;
          });
        }
        if (clutch && teamOf.get(clutch.id) === e.winnerTeam) both(clutch.id, (t) => t.clutchesWon++);
        break;
      }
    }
  }
  return out;
}
