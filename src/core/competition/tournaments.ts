/**
 * Tournament configuration and execution. A tournament is a list of stages;
 * invited teams can enter at a specific stage (World Championship Stage 2),
 * qualified teams fill reserved slots, and final placements decide prize money.
 */
import type { Day } from '../world/calendar';
import type { Region } from '../world/types';
import { doubleElimination, gslGroups, roundRobin, singleElimination, swiss, type Entrant, type PlayedSeries, type Resolver, type StageResult } from './formats';
import type { Tier } from './records';
import type { BestOf } from './veto';

export type StageKind = 'single' | 'double' | 'gsl' | 'swiss' | 'roundrobin';

export interface StageConfig {
  readonly name: string;
  readonly kind: StageKind;
  /** Entrants that advance out of this stage (ignored for the final stage). */
  readonly advance: number;
  readonly bestOf: BestOf;
  readonly finalBestOf?: BestOf;
  readonly decidingBestOf?: BestOf;
  readonly days: number;
  /** Swiss parameters. */
  readonly winsNeeded?: number;
  readonly lossesOut?: number;
}

/** Direct invitations drawn from a frozen snapshot list. */
export interface InviteRule {
  /** 'global' or a region list. */
  readonly list: 'global' | Region;
  readonly count: number;
  /** First rank on that list considered (1 = top). */
  readonly fromRank: number;
  /** Stage index the invitees enter at (0 = first stage). */
  readonly entryStage: number;
}

/** Slots filled by the top finishers of a qualifier event. */
export interface QualifierSlot {
  readonly qualifierId: string;
  readonly count: number;
  readonly entryStage: number;
}

export interface TournamentConfig {
  readonly id: string;
  readonly name: string;
  readonly season: number;
  readonly tier: Tier;
  /** Who may take part: everyone, or rosters of one region. */
  readonly scope: 'global' | Region;
  readonly location: string;
  readonly lan: boolean;
  readonly announceDay: Day;
  /** Month-start day whose published snapshot decides invitations (null for open events). */
  readonly cutoffDay: Day | null;
  readonly startDay: Day;
  readonly endDay: Day;
  readonly prizePool: number;
  /** Fraction of the pool by final position (index 0 = winner). */
  readonly prizeSplit: readonly number[];
  readonly stages: readonly StageConfig[];
  readonly invites: readonly InviteRule[];
  readonly qualifierSlots: readonly QualifierSlot[];
  /** Open entry (qualifiers and Tier 3 opens): registrations decided by teams. */
  readonly open: boolean;
  readonly maxEntrants: number;
  /** For qualifiers: the event fed and how many advance. */
  readonly feeds?: { readonly eventId: string; readonly slots: number };
  /** Closed qualifiers: only teams outside the parent's invite range, ranked above this on the scope list. */
  readonly closedMaxRank?: number;
  /** Prestige 0..100 used by AI event selection. */
  readonly prestige: number;
}

export interface TournamentResult {
  readonly eventId: string;
  readonly placements: readonly { readonly entrant: Entrant; readonly place: number; readonly label: string; readonly prize: number }[];
  readonly series: readonly PlayedSeries[];
  readonly stages: readonly { readonly name: string; readonly result: StageResult }[];
}

const STAGE_RUNNERS: Record<StageKind, (es: readonly Entrant[], cfg: StageConfig, opt: { id: string; startDay: Day }, resolve: Resolver) => StageResult> = {
  single: (es, c, o, r) => singleElimination(es, { id: o.id, name: c.name, startDay: o.startDay, days: c.days, bestOf: c.bestOf, ...(c.finalBestOf ? { finalBestOf: c.finalBestOf } : {}) }, r),
  double: (es, c, o, r) => doubleElimination(es, { id: o.id, name: c.name, startDay: o.startDay, days: c.days, bestOf: c.bestOf, ...(c.finalBestOf ? { finalBestOf: c.finalBestOf } : {}) }, r),
  gsl: (es, c, o, r) => gslGroups(es, { id: o.id, name: c.name, startDay: o.startDay, days: c.days, bestOf: c.bestOf }, r),
  swiss: (es, c, o, r) =>
    swiss(es, { id: o.id, name: c.name, startDay: o.startDay, days: c.days, bestOf: c.bestOf, winsNeeded: c.winsNeeded ?? 3, lossesOut: c.lossesOut ?? 3, ...(c.decidingBestOf ? { decidingBestOf: c.decidingBestOf } : {}) }, r),
  roundrobin: (es, c, o, r) => roundRobin(es, { id: o.id, name: c.name, startDay: o.startDay, days: c.days, bestOf: c.bestOf }, r, c.advance),
};

/**
 * Runs a tournament. `byStage[i]` are the teams entering at stage i (already seeded).
 * Teams eliminated in stage k finish behind every team that survived stage k.
 */
export function runTournament(cfg: TournamentConfig, byStage: readonly (readonly Entrant[])[], resolve: Resolver): TournamentResult {
  let carry: Entrant[] = [];
  const eliminatedByStage: Entrant[][] = [];
  const stages: { name: string; result: StageResult }[] = [];
  const series: PlayedSeries[] = [];
  let day = cfg.startDay;
  let final: StageResult | null = null;
  for (let i = 0; i < cfg.stages.length; i++) {
    const sc = cfg.stages[i]!;
    // Advancing teams keep their original seed; reseed by seed for the next stage.
    const entrants = [...carry, ...(byStage[i] ?? [])].sort((a, b) => a.seed - b.seed || (a.lineageId < b.lineageId ? -1 : 1));
    if (entrants.length < 2) {
      carry = entrants;
      continue;
    }
    // A short field that doesn't fit the planned format falls back to a seeded bracket with byes.
    const n = entrants.length;
    const pow2 = (n & (n - 1)) === 0;
    const fits = sc.kind === 'single' || sc.kind === 'roundrobin' || (sc.kind === 'double' && pow2 && n >= 4) || (sc.kind === 'gsl' && n % 4 === 0 && n >= 8) || (sc.kind === 'swiss' && n % 2 === 0 && n >= 8);
    const kind = fits ? sc.kind : 'single';
    const res = STAGE_RUNNERS[kind](entrants, kind === sc.kind ? sc : { ...sc, kind }, { id: `${cfg.id}:s${i}`, startDay: day }, resolve);
    stages.push({ name: sc.name, result: res });
    series.push(...res.series);
    day += sc.days;
    const last = i === cfg.stages.length - 1;
    if (last) final = res;
    else {
      const adv = new Set(res.advancing.map((e) => e.lineageId));
      carry = res.order.filter((e) => adv.has(e.lineageId)).slice(0, sc.advance);
      eliminatedByStage.unshift(res.order.filter((e) => !adv.has(e.lineageId)));
    }
  }
  // Finishing groups: the final stage's order (tied labels grouped), then each earlier stage's eliminations.
  const groups: Entrant[][] = [];
  if (final) {
    for (const e of final.order) {
      const lbl = final.placeLabel.get(e.lineageId) ?? '';
      const last = groups[groups.length - 1];
      const prevLbl = last ? (final.placeLabel.get(last[0]!.lineageId) ?? '') : null;
      if (last && lbl !== '' && lbl === prevLbl && lbl.includes('–')) last.push(e);
      else groups.push([e]);
    }
  } else for (const e of carry) groups.push([e]);
  for (const g of eliminatedByStage) if (g.length) groups.push(g);

  // Positions and prize money. Tied teams split the prizes of the positions they span.
  const placements: { entrant: Entrant; place: number; label: string; prize: number }[] = [];
  let pos = 0;
  for (const g of groups) {
    const share = cfg.prizeSplit.slice(pos, pos + g.length).reduce((a, x) => a + x, 0) / g.length;
    const label = g.length === 1 ? ordinalNum(pos + 1) : `${ordinalNum(pos + 1)}–${ordinalNum(pos + g.length)}`;
    for (const e of g) placements.push({ entrant: e, place: pos + 1, label, prize: Math.round(cfg.prizePool * share) });
    pos += g.length;
  }
  return { eventId: cfg.id, placements, series, stages };
}

function ordinalNum(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}

/** Standard prize splits by field size (fractions sum to 1). */
export function prizeSplit(n: number): number[] {
  const tables: Record<number, number[]> = {
    8: [0.4, 0.2, 0.1, 0.1, 0.05, 0.05, 0.05, 0.05],
    16: [0.35, 0.15, 0.08, 0.08, 0.045, 0.045, 0.045, 0.045, 0.02, 0.02, 0.02, 0.02, 0.0175, 0.0175, 0.0175, 0.0175],
    24: [0.32, 0.14, 0.07, 0.07, 0.04, 0.04, 0.04, 0.04, 0.017, 0.017, 0.017, 0.017, 0.017, 0.017, 0.017, 0.017, 0.009, 0.009, 0.009, 0.009, 0.009, 0.009, 0.009, 0.009],
  };
  if (tables[n]) {
    const t = tables[n]!;
    const sum = t.reduce((a, x) => a + x, 0);
    return t.map((x) => x / sum);
  }
  // Fallback: geometric-ish to the top half.
  const half = Math.max(1, Math.ceil(n / 2));
  const raw = Array.from({ length: n }, (_, k) => (k < half ? 1 / (k + 1.5) : 0));
  const sum = raw.reduce((s, x) => s + x, 0);
  return raw.map((x) => x / sum);
}
