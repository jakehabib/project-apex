/**
 * Tournament stage formats. Each runner pairs entrants, asks the resolver to
 * play every series (in game: veto + full engine maps), and returns final
 * placements. Pairing rules are deterministic given seeds and results.
 */
import type { Day } from '../world/calendar';
import type { MapScore } from './records';
import type { BestOf } from './veto';

export interface Entrant {
  readonly lineageId: string;
  readonly orgId: string;
  /** 1 = top seed. */
  readonly seed: number;
}

export interface SeriesOutcome {
  readonly winner: 'a' | 'b';
  readonly maps: readonly MapScore[];
}

export interface SeriesRequest {
  readonly seriesId: string;
  readonly stage: string;
  readonly round: string;
  readonly day: Day;
  readonly bestOf: BestOf;
  readonly a: Entrant;
  readonly b: Entrant;
}

export type Resolver = (req: SeriesRequest) => SeriesOutcome;

export interface PlayedSeries {
  readonly req: SeriesRequest;
  readonly out: SeriesOutcome;
}

export interface StageResult {
  /** Entrants in final order: index 0 is best. Ties share `placeLabel`. */
  readonly order: readonly Entrant[];
  readonly placeLabel: ReadonlyMap<string, string>;
  /** Entrants advancing to the next stage (for group/Swiss stages). */
  readonly advancing: readonly Entrant[];
  readonly series: readonly PlayedSeries[];
}

export interface StageOptions {
  readonly id: string;
  readonly name: string;
  readonly startDay: Day;
  /** Days over which rounds are spread (≥1). */
  readonly days: number;
  readonly bestOf: BestOf;
  /** Best-of for the final(s) when different. */
  readonly finalBestOf?: BestOf;
}

const bySeed = (xs: readonly Entrant[]) => [...xs].sort((a, b) => a.seed - b.seed || (a.lineageId < b.lineageId ? -1 : 1));

function play(resolve: Resolver, out: PlayedSeries[], o: StageOptions, round: string, roundIdx: number, rounds: number, a: Entrant, b: Entrant, bo: BestOf): [Entrant, Entrant] {
  const [hi, lo] = a.seed <= b.seed ? [a, b] : [b, a];
  const day = o.startDay + Math.min(o.days - 1, Math.floor((roundIdx * o.days) / Math.max(1, rounds)));
  const req: SeriesRequest = { seriesId: `${o.id}:${round}:${hi.lineageId}-${lo.lineageId}`, stage: o.name, round, day, bestOf: bo, a: hi, b: lo };
  const res = resolve(req);
  out.push({ req, out: res });
  return res.winner === 'a' ? [hi, lo] : [lo, hi];
}

/** Standard bracket order for n (power of two) seeds: 1v n, ... keeping top seeds apart. */
export function bracketOrder(n: number): number[] {
  let order = [1];
  while (order.length < n) {
    const m = order.length * 2 + 1;
    order = order.flatMap((s) => [s, m - s]);
  }
  return order;
}

/**
 * Single elimination. Fields that are not a power of two are padded with byes,
 * which go to the top seeds (no series is recorded for a bye).
 */
export function singleElimination(entrants: readonly Entrant[], o: StageOptions, resolve: Resolver): StageResult {
  const n = entrants.length;
  if (n < 2) throw new Error(`single elimination needs at least 2 entrants, got ${n}`);
  let size = 1;
  while (size < n) size *= 2;
  const seeded = bySeed(entrants);
  let alive: (Entrant | null)[] = bracketOrder(size).map((s) => seeded[s - 1] ?? null);
  const series: PlayedSeries[] = [];
  const out: Entrant[][] = [];
  const rounds = Math.log2(size);
  for (let r = 0; alive.length > 1; r++) {
    const next: (Entrant | null)[] = [];
    const losers: Entrant[] = [];
    const name = alive.length === 2 ? 'Final' : alive.length === 4 ? 'Semi-final' : alive.length === 8 ? 'Quarter-final' : `Round of ${alive.length}`;
    for (let i = 0; i < alive.length; i += 2) {
      const a = alive[i]!;
      const b = alive[i + 1]!;
      if (!a || !b) {
        next.push(a ?? b);
        continue;
      }
      const [w, l] = play(resolve, series, o, name, r, rounds, a, b, alive.length === 2 ? (o.finalBestOf ?? o.bestOf) : o.bestOf);
      next.push(w);
      losers.push(l);
    }
    if (losers.length) out.unshift(bySeed(losers));
    alive = next;
  }
  const champ = alive[0]!;
  return finishOrder([[champ], ...out], series, [champ]);
}

/** Double elimination with a grand final (no bracket reset). */
export function doubleElimination(entrants: readonly Entrant[], o: StageOptions, resolve: Resolver): StageResult {
  const n = entrants.length;
  if (n < 4 || (n & (n - 1)) !== 0) throw new Error(`double elimination needs a power of two ≥4, got ${n}`);
  const series: PlayedSeries[] = [];
  const seeded = bySeed(entrants);
  let upper = bracketOrder(n).map((s) => seeded[s - 1]!);
  let lower: Entrant[] = [];
  const eliminated: Entrant[][] = [];
  const rounds = 2 * Math.log2(n);
  let r = 0;
  while (upper.length > 1) {
    const ub: Entrant[] = [];
    const dropped: Entrant[] = [];
    for (let i = 0; i < upper.length; i += 2) {
      const [w, l] = play(resolve, series, o, `Upper round ${r + 1}`, r, rounds, upper[i]!, upper[i + 1]!, upper.length === 2 ? (o.finalBestOf ?? o.bestOf) : o.bestOf);
      ub.push(w);
      dropped.push(l);
    }
    upper = ub;
    // Lower bracket: survivors play each other, then face this round's dropouts.
    if (lower.length > 0) {
      if (lower.length > dropped.length) {
        const lb: Entrant[] = [];
        const out: Entrant[] = [];
        for (let i = 0; i < lower.length; i += 2) {
          const [w, l] = play(resolve, series, o, `Lower round ${r}a`, r, rounds, lower[i]!, lower[i + 1]!, o.bestOf);
          lb.push(w);
          out.push(l);
        }
        eliminated.unshift(out);
        lower = lb;
      }
      const lb: Entrant[] = [];
      const out: Entrant[] = [];
      // Reverse dropouts to avoid immediate rematches.
      const d = [...dropped].reverse();
      for (let i = 0; i < lower.length; i++) {
        const [w, l] = play(resolve, series, o, `Lower round ${r}b`, r, rounds, lower[i]!, d[i]!, o.bestOf);
        lb.push(w);
        out.push(l);
      }
      eliminated.unshift(out);
      lower = lb;
    } else lower = dropped;
    r++;
  }
  while (lower.length > 1) {
    const lb: Entrant[] = [];
    const out: Entrant[] = [];
    for (let i = 0; i < lower.length; i += 2) {
      const [w, l] = play(resolve, series, o, 'Lower final', r, rounds, lower[i]!, lower[i + 1]!, o.bestOf);
      lb.push(w);
      out.push(l);
    }
    eliminated.unshift(out);
    lower = lb;
    r++;
  }
  const [champ, runnerUp] = play(resolve, series, o, 'Grand final', r, rounds, upper[0]!, lower[0]!, o.finalBestOf ?? o.bestOf);
  const groups = [[champ], [runnerUp], ...eliminated.map(bySeed)];
  return finishOrder(groups, series, [champ]);
}

/** Swiss stage: pair by record (and Buchholz), wins advance at `winsNeeded`, losses eliminate at `lossesOut`. */
export function swiss(entrants: readonly Entrant[], o: StageOptions & { winsNeeded: number; lossesOut: number; decidingBestOf?: BestOf }, resolve: Resolver): StageResult {
  const series: PlayedSeries[] = [];
  const rec = new Map(entrants.map((e) => [e.lineageId, { e, w: 0, l: 0, opps: [] as string[] }]));
  const advanced: { e: Entrant; w: number; l: number }[] = [];
  const out: { e: Entrant; w: number; l: number }[] = [];
  const maxRounds = o.winsNeeded + o.lossesOut - 1;
  for (let round = 0; round < maxRounds; round++) {
    const active = [...rec.values()];
    if (active.length < 2) break;
    const buchholz = (id: string) => rec.get(id)!.opps.reduce((s, x) => s + ((rec.get(x) ?? [...advanced, ...out].find((y) => y.e.lineageId === x))!.w - (rec.get(x) ?? [...advanced, ...out].find((y) => y.e.lineageId === x))!.l), 0);
    // Group by record, highest first; within a group, sort by Buchholz then seed, pair top vs bottom avoiding rematches.
    const groups = new Map<string, typeof active>();
    for (const x of active) groups.set(`${x.w}-${x.l}`, [...(groups.get(`${x.w}-${x.l}`) ?? []), x]);
    const keys = [...groups.keys()].sort((a, b) => Number(b.split('-')[0]) - Number(a.split('-')[0]) || Number(a.split('-')[1]) - Number(b.split('-')[1]));
    let carry: typeof active = [];
    for (const k of keys) {
      const g = [...carry, ...groups.get(k)!].sort((a, b) => buchholz(b.e.lineageId) - buchholz(a.e.lineageId) || a.e.seed - b.e.seed);
      carry = [];
      if (g.length % 2 === 1) carry.push(g.pop()!);
      while (g.length > 0) {
        const top = g.shift()!;
        let j = g.length - 1;
        while (j > 0 && top.opps.includes(g[j]!.e.lineageId)) j--;
        const opp = g.splice(j, 1)[0]!;
        const deciding = top.w === o.winsNeeded - 1 || top.l === o.lossesOut - 1 || opp.w === o.winsNeeded - 1 || opp.l === o.lossesOut - 1;
        const [w, l] = play(resolve, series, o, `Round ${round + 1} (${k})`, round, maxRounds, top.e, opp.e, deciding ? (o.decidingBestOf ?? o.bestOf) : o.bestOf);
        const rw = rec.get(w.lineageId)!;
        const rl = rec.get(l.lineageId)!;
        rw.w++;
        rl.l++;
        rw.opps.push(l.lineageId);
        rl.opps.push(w.lineageId);
      }
    }
    for (const x of [...rec.values()]) {
      if (x.w >= o.winsNeeded) {
        advanced.push({ e: x.e, w: x.w, l: x.l });
        rec.delete(x.e.lineageId);
      } else if (x.l >= o.lossesOut) {
        out.push({ e: x.e, w: x.w, l: x.l });
        rec.delete(x.e.lineageId);
      }
    }
  }
  const rank = (xs: { e: Entrant; w: number; l: number }[]) => [...xs].sort((a, b) => b.w - b.l - (a.w - a.l) || a.e.seed - b.e.seed);
  const ordered = [...rank(advanced), ...rank([...rec.values()].map((x) => ({ e: x.e, w: x.w, l: x.l }))), ...rank(out)];
  const placeLabel = new Map<string, string>();
  for (const x of ordered) placeLabel.set(x.e.lineageId, `${x.w}–${x.l}`);
  return { order: ordered.map((x) => x.e), placeLabel, advancing: rank(advanced).map((x) => x.e), series };
}

/** GSL groups of four (opening, winners, elimination, decider). Top two of each group advance. */
export function gslGroups(entrants: readonly Entrant[], o: StageOptions, resolve: Resolver): StageResult {
  if (entrants.length % 4 !== 0) throw new Error('GSL groups need a multiple of four entrants');
  const seeded = bySeed(entrants);
  const groupsN = entrants.length / 4;
  // Snake seeding into groups.
  const groups: Entrant[][] = Array.from({ length: groupsN }, () => []);
  seeded.forEach((e, i) => {
    const row = Math.floor(i / groupsN);
    const col = row % 2 === 0 ? i % groupsN : groupsN - 1 - (i % groupsN);
    groups[col]!.push(e);
  });
  const series: PlayedSeries[] = [];
  const firsts: Entrant[] = [];
  const seconds: Entrant[] = [];
  const thirds: Entrant[] = [];
  const fourths: Entrant[] = [];
  groups.forEach((g, gi) => {
    const tag = `Group ${String.fromCharCode(65 + gi)}`;
    const [w1, l1] = play(resolve, series, o, `${tag} opening`, 0, 3, g[0]!, g[3]!, o.bestOf);
    const [w2, l2] = play(resolve, series, o, `${tag} opening`, 0, 3, g[1]!, g[2]!, o.bestOf);
    const [first, ww] = play(resolve, series, o, `${tag} winners`, 1, 3, w1, w2, o.bestOf);
    const [elimW, fourth] = play(resolve, series, o, `${tag} elimination`, 1, 3, l1, l2, o.bestOf);
    const [second, third] = play(resolve, series, o, `${tag} decider`, 2, 3, ww, elimW, o.bestOf);
    firsts.push(first);
    seconds.push(second);
    thirds.push(third);
    fourths.push(fourth);
  });
  const advancing = [...firsts, ...seconds];
  const groupsOrdered = [bySeed(firsts), bySeed(seconds), bySeed(thirds), bySeed(fourths)];
  const res = finishOrder(groupsOrdered, series, advancing);
  return res;
}

export function roundRobin(entrants: readonly Entrant[], o: StageOptions, resolve: Resolver, advanceCount = 0): StageResult {
  const series: PlayedSeries[] = [];
  const pts = new Map(entrants.map((e) => [e.lineageId, { e, w: 0, md: 0 }]));
  const list = bySeed(entrants);
  const rounds = list.length - 1;
  let idx = 0;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const p = play(resolve, series, o, 'Round robin', idx++ % Math.max(1, rounds), rounds, list[i]!, list[j]!, o.bestOf);
      pts.get(p[0].lineageId)!.w++;
      const last = series[series.length - 1]!.out;
      const won = last.maps.filter((m) => (last.winner === 'a' ? m.a > m.b : m.b > m.a)).length;
      pts.get(p[0].lineageId)!.md += won - (last.maps.length - won);
      pts.get(p[1].lineageId)!.md -= won - (last.maps.length - won);
    }
  const order = [...pts.values()].sort((a, b) => b.w - a.w || b.md - a.md || a.e.seed - b.e.seed).map((x) => x.e);
  const placeLabel = new Map(order.map((e, i) => [e.lineageId, ordinal(i + 1)]));
  return { order, placeLabel, advancing: order.slice(0, advanceCount), series };
}

function finishOrder(groups: Entrant[][], series: PlayedSeries[], advancing: Entrant[]): StageResult {
  const placeLabel = new Map<string, string>();
  const order: Entrant[] = [];
  let place = 1;
  for (const g of groups) {
    const label = g.length === 1 ? ordinal(place) : `${ordinal(place)}–${ordinal(place + g.length - 1)}`;
    for (const e of g) {
      placeLabel.set(e.lineageId, label);
      order.push(e);
    }
    place += g.length;
  }
  return { order, placeLabel, advancing, series };
}

export function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th');
  return `${n}${s}`;
}
