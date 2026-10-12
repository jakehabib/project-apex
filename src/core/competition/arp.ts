/**
 * APEX Ranking Points (ARP). A pure function of stored results:
 *
 *   seed = 400 + 1600 × mean(prize standing, bounty collected, opponent network)
 *   ARP  = seed adjusted by a recency-weighted head-to-head pass over the window
 *
 * See docs/COMPETITION_DESIGN.md. Tier is never a multiplier: strong events
 * matter through their opponents and prize money.
 */
import type { Day } from '../world/calendar';
import type { Region } from '../world/types';
import type { RecordStore, SeriesRecord } from './records';

export interface ArpConfig {
  readonly windowDays: number;
  /** Results younger than this carry full weight. */
  readonly fullWeightDays: number;
  /** Best N contributions counted per factor (stops farming volume). */
  readonly bestN: number;
  /** Rank whose prize standing defines 1.0 (teams at or above it saturate). */
  readonly prizeReferenceRank: number;
  readonly seedMin: number;
  readonly seedSpan: number;
  readonly h2hK: number;
  readonly minSeries: number;
  /** Must have played a ranked series this recently to be listed. */
  readonly activeDays: number;
}

export const ARP_CONFIG: ArpConfig = {
  windowDays: 180,
  fullWeightDays: 30,
  bestN: 10,
  prizeReferenceRank: 5,
  seedMin: 400,
  seedSpan: 1600,
  h2hK: 24,
  minSeries: 5,
  activeDays: 90,
};

export interface ArpComponents {
  /** 0..1 each. */
  readonly prize: number;
  readonly bounty: number;
  readonly network: number;
  readonly seed: number;
  /** Rating change from the head-to-head pass. */
  readonly h2h: number;
}

export interface Standing {
  readonly lineageId: string;
  readonly orgId: string;
  readonly region: Region;
  readonly arp: number;
  readonly components: ArpComponents;
  readonly rankedSeries: number;
  readonly wins: number;
  readonly losses: number;
  globalRank: number;
  regionalRank: number;
}

export interface LineageInfo {
  /** Active lineages only; ended lineages are never listed. */
  readonly active: (lineageId: string) => boolean;
  readonly orgOf: (lineageId: string) => string;
  readonly regionOf: (lineageId: string) => Region;
}

export const recencyWeight = (age: number, cfg: ArpConfig = ARP_CONFIG): number =>
  age < 0 || age > cfg.windowDays ? 0 : age <= cfg.fullWeightDays ? 1 : 1 - (age - cfg.fullWeightDays) / (cfg.windowDays - cfg.fullWeightDays);

const bestSum = (xs: number[], n: number) => xs.sort((a, b) => b - a).slice(0, n).reduce((s, x) => s + x, 0);

export function computeStandings(store: RecordStore, asOf: Day, info: LineageInfo, cfg: ArpConfig = ARP_CONFIG): Standing[] {
  const inWindow = (day: Day) => day <= asOf && asOf - day <= cfg.windowDays;
  const series = [...store.series.values()].filter((s) => s.ranked && inWindow(s.day)).sort((a, b) => a.day - b.day || (a.id < b.id ? -1 : 1));

  // 1. Prize standing (best events, recency weighted), normalised to the reference rank.
  const prizeRaw = new Map<string, number[]>();
  for (const p of store.prizes.values()) {
    if (!inWindow(p.day) || p.amount <= 0) continue;
    const list = prizeRaw.get(p.lineageId) ?? [];
    list.push(p.amount * recencyWeight(asOf - p.day, cfg));
    prizeRaw.set(p.lineageId, list);
  }
  const prizeTotal = new Map([...prizeRaw].map(([id, xs]) => [id, bestSum(xs, cfg.bestN)]));
  const ref = [...prizeTotal.values()].sort((a, b) => b - a)[cfg.prizeReferenceRank - 1] ?? Math.max(1, ...prizeTotal.values());
  const prize = (id: string) => Math.min(1, (prizeTotal.get(id) ?? 0) / Math.max(1, ref));

  // Distinct opponents beaten (for the network factor).
  const beaten = new Map<string, Map<string, number>>(); // winner -> loser -> best recency weight
  const played = new Map<string, { n: number; w: number; l: number; last: Day }>();
  for (const s of series) {
    const [win, lose] = s.winner === 'a' ? [s.a.lineageId, s.b.lineageId] : [s.b.lineageId, s.a.lineageId];
    const w = recencyWeight(asOf - s.day, cfg);
    const m = beaten.get(win) ?? new Map<string, number>();
    m.set(lose, Math.max(m.get(lose) ?? 0, w));
    beaten.set(win, m);
    for (const [id, won] of [[win, true], [lose, false]] as const) {
      const p = played.get(id) ?? { n: 0, w: 0, l: 0, last: -Infinity };
      p.n++;
      if (won) p.w++;
      else p.l++;
      p.last = Math.max(p.last, s.day);
      played.set(id, p);
    }
  }
  const distinctWins = (id: string) => beaten.get(id)?.size ?? 0;
  const maxDistinct = Math.max(1, ...[...beaten.keys()].map(distinctWins));

  // 2. Bounty collected: beaten opponents' prize standing, recency weighted, best N.
  const bounty = (id: string) => {
    const m = beaten.get(id);
    if (!m) return 0;
    return bestSum([...m].map(([opp, w]) => prize(opp) * w), cfg.bestN) / cfg.bestN;
  };
  // 3. Opponent network: distinct opponents beaten, each weighted by how many distinct teams *they* beat.
  const network = (id: string) => {
    const m = beaten.get(id);
    if (!m) return 0;
    return bestSum([...m].map(([opp, w]) => (distinctWins(opp) / maxDistinct) * w), cfg.bestN) / cfg.bestN;
  };

  const ids = [...played.keys()].sort();
  const comp = new Map<string, { prize: number; bounty: number; network: number; seed: number }>();
  for (const id of ids) {
    const f = { prize: prize(id), bounty: bounty(id), network: network(id) };
    comp.set(id, { ...f, seed: cfg.seedMin + cfg.seedSpan * ((f.prize + f.bounty + f.network) / 3) });
  }

  // 4. Head-to-head pass, chronological, recency-scaled K.
  const rating = new Map(ids.map((id) => [id, comp.get(id)!.seed]));
  for (const s of series as SeriesRecord[]) {
    const ra = rating.get(s.a.lineageId)!;
    const rb = rating.get(s.b.lineageId)!;
    const ea = 1 / (1 + 10 ** ((rb - ra) / 400));
    const k = cfg.h2hK * recencyWeight(asOf - s.day, cfg);
    const sa = s.winner === 'a' ? 1 : 0;
    rating.set(s.a.lineageId, ra + k * (sa - ea));
    rating.set(s.b.lineageId, rb + k * (ea - sa));
  }

  const out: Standing[] = [];
  for (const id of ids) {
    const p = played.get(id)!;
    if (!info.active(id) || p.n < cfg.minSeries || asOf - p.last > cfg.activeDays) continue;
    const c = comp.get(id)!;
    const r = rating.get(id)!;
    out.push({
      lineageId: id, orgId: info.orgOf(id), region: info.regionOf(id), arp: Math.round(r),
      components: { prize: c.prize, bounty: c.bounty, network: c.network, seed: Math.round(c.seed), h2h: Math.round(r - c.seed) },
      rankedSeries: p.n, wins: p.w, losses: p.l, globalRank: 0, regionalRank: 0,
    });
  }
  out.sort((a, b) => b.arp - a.arp || (a.lineageId < b.lineageId ? -1 : 1));
  const byRegion = new Map<Region, number>();
  out.forEach((s, i) => {
    s.globalRank = i + 1;
    const n = (byRegion.get(s.region) ?? 0) + 1;
    byRegion.set(s.region, n);
    s.regionalRank = n;
  });
  return out;
}

/** Plain-English summary of why a lineage has its score. */
export function explainStanding(s: Standing): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const h2h = s.components.h2h >= 0 ? `+${s.components.h2h}` : `${s.components.h2h}`;
  return `Prize standing ${pct(s.components.prize)}, bounty collected ${pct(s.components.bounty)}, opponent network ${pct(s.components.network)} → seed ${s.components.seed}; head-to-head ${h2h} over ${s.rankedSeries} ranked series (${s.wins}–${s.losses}).`;
}
