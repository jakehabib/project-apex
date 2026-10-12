/**
 * Calibration telemetry: an analyzer that reads simulated event logs and counts
 * outcomes with explicit numerators/denominators. It is deliberately a separate
 * code path from the engine and from stats.ts (brief: "independent telemetry
 * analyzer"), so a bug in one is visible in the other.
 *
 * Man-advantage states are counted the *first time* a state is reached in a
 * round (not weighted by time spent), from the perspective of the team ahead.
 */
import type { BuyType, MatchEvent } from '../match/events';

export interface Ratio {
  n: number;
  d: number;
}

const r = (): Ratio => ({ n: 0, d: 0 });
const add = (x: Ratio, hit: boolean) => {
  x.d++;
  if (hit) x.n++;
};

export type BuyTier = 'pistol' | 'eco' | 'force' | 'full';
export const tierOf = (b: BuyType): BuyTier => (b === 'pistol' ? 'pistol' : b === 'eco' ? 'eco' : b === 'full' ? 'full' : 'force');

export interface MapTelemetry {
  rounds: number;
  maps: number;
  ctRoundWins: Ratio;
  plantRate: Ratio;
  ctWinAfterPlant: Ratio;
  openingConversion: Ratio;
  pistolCtWin: Ratio;
  overtime: Ratio;
}

export interface Telemetry {
  maps: number;
  rounds: number;
  byMap: Record<string, MapTelemetry>;
  /** Rounds where the team with the opening kill won. */
  openingConversion: Ratio;
  plantRate: Ratio;
  ctWinAfterPlant: Ratio;
  pistolCtWin: Ratio;
  overtime: Ratio;
  /** buy tier of team vs opponent tier -> team won. Key `${mine}>${theirs}`. */
  buyMatchups: Record<string, Ratio>;
  /** CT win after plant by `${ctTier}>${tTier}`. */
  retakeByTier: Record<string, Ratio>;
  /** Among CT wins after plant: all five attackers died. */
  retakeAllFiveDead: Ratio;
  retakeCtDeaths: { sum: number; count: number };
  /** `${ahead}v${behind}` first reached -> team ahead won. */
  states: Record<string, Ratio>;
  /** solo 1vX attempts (X = opponents alive) -> solo player's team won. */
  clutches: Record<string, Ratio>;
  /** Halftime lead `${lead}-${trail}` -> leader won map. */
  halftime: Record<string, Ratio>;
  roundEndReasons: Record<string, number>;
  avgRoundsPerMap: { sum: number; count: number };
  kills: number;
  tradeKills: number;
}

export function emptyTelemetry(): Telemetry {
  return {
    maps: 0, rounds: 0, byMap: {}, openingConversion: r(), plantRate: r(), ctWinAfterPlant: r(), pistolCtWin: r(), overtime: r(),
    buyMatchups: {}, retakeByTier: {}, retakeAllFiveDead: r(), retakeCtDeaths: { sum: 0, count: 0 }, states: {}, clutches: {},
    halftime: {}, roundEndReasons: {}, avgRoundsPerMap: { sum: 0, count: 0 }, kills: 0, tradeKills: 0,
  };
}

const bucket = (rec: Record<string, Ratio>, k: string) => (rec[k] ??= r());

/** Adds one simulated map's event log to the telemetry. */
export function ingestMap(t: Telemetry, events: readonly MatchEvent[]): void {
  let mapId = '';
  const teamOf = new Map<string, number>();
  let attacker = 0;
  let buys: readonly [BuyType, BuyType] = ['full', 'full'];
  let alive: [number, number] = [5, 5];
  let planted = false;
  let openingTeam: number | null = null;
  let statesThisRound = new Map<string, number>(); // key -> team ahead
  let soloThisRound = new Map<number, number>(); // team -> opponents alive when solo reached
  let rounds = 0;
  let halftimeScore: [number, number] | null = null;
  let finalWinner: number | null = null;
  let deathsThisRound: [number, number] = [0, 0];

  let mt: MapTelemetry | null = null;

  for (const e of events) {
    switch (e.type) {
      case 'map_start':
        mapId = e.mapId;
        mt = t.byMap[mapId] ??= { rounds: 0, maps: 0, ctRoundWins: r(), plantRate: r(), ctWinAfterPlant: r(), openingConversion: r(), pistolCtWin: r(), overtime: r() };
        break;
      case 'spawn':
        teamOf.set(e.playerId, e.team);
        break;
      case 'round_start':
        attacker = e.attackerTeam;
        buys = e.buyTypes;
        alive = [5, 5];
        planted = false;
        openingTeam = null;
        statesThisRound = new Map();
        soloThisRound = new Map();
        deathsThisRound = [0, 0];
        break;
      case 'plant':
        planted = true;
        break;
      case 'kill': {
        const victimTeam = teamOf.get(e.victimId)!;
        const killerTeam = teamOf.get(e.attackerId)!;
        alive[victimTeam] = alive[victimTeam]! - 1;
        deathsThisRound[victimTeam] = deathsThisRound[victimTeam]! + 1;
        t.kills++;
        if (e.tradeOfPlayerId) t.tradeKills++;
        if (openingTeam === null) openingTeam = killerTeam;
        const [a, b] = alive;
        if (a !== b && a > 0 && b > 0) {
          const ahead = a > b ? 0 : 1;
          const key = `${Math.max(a, b)}v${Math.min(a, b)}`;
          if (!statesThisRound.has(key)) statesThisRound.set(key, ahead);
        }
        if (a === 1 && b === 1 && !statesThisRound.has('1v1')) statesThisRound.set('1v1', -1);
        for (const team of [0, 1] as const) {
          if (alive[team] === 1 && alive[1 - team]! >= 1 && !soloThisRound.has(team)) soloThisRound.set(team, alive[1 - team]!);
        }
        break;
      }
      case 'round_end': {
        rounds++;
        t.rounds++;
        mt!.rounds++;
        const ct = 1 - attacker;
        const ctWon = e.winnerTeam === ct;
        add(mt!.ctRoundWins, ctWon);
        add(t.plantRate, planted);
        add(mt!.plantRate, planted);
        t.roundEndReasons[e.reason] = (t.roundEndReasons[e.reason] ?? 0) + 1;
        if (planted) {
          add(t.ctWinAfterPlant, ctWon);
          add(mt!.ctWinAfterPlant, ctWon);
          add(bucket(t.retakeByTier, `${tierOf(buys[ct]!)}>${tierOf(buys[attacker]!)}`), ctWon);
          if (ctWon) {
            add(t.retakeAllFiveDead, deathsThisRound[attacker] === 5);
            t.retakeCtDeaths.sum += deathsThisRound[ct]!;
            t.retakeCtDeaths.count++;
          }
        }
        if (openingTeam !== null) {
          add(t.openingConversion, e.winnerTeam === openingTeam);
          add(mt!.openingConversion, e.winnerTeam === openingTeam);
        }
        if (buys[0] === 'pistol' && buys[1] === 'pistol') {
          add(t.pistolCtWin, ctWon);
          add(mt!.pistolCtWin, ctWon);
        }
        for (const team of [0, 1] as const) {
          add(bucket(t.buyMatchups, `${tierOf(buys[team]!)}>${tierOf(buys[1 - team]!)}`), e.winnerTeam === team);
        }
        for (const [key, ahead] of statesThisRound) {
          if (key === '1v1') add(bucket(t.states, '1v1'), e.winnerTeam === ct);
          else add(bucket(t.states, key), e.winnerTeam === ahead);
        }
        for (const [team, vs] of soloThisRound) if (vs >= 2) add(bucket(t.clutches, `1v${vs}`), e.winnerTeam === team);
        if (rounds === 12) halftimeScore = [e.scores[0], e.scores[1]];
        break;
      }
      case 'map_end':
        finalWinner = e.winnerTeam;
        break;
    }
  }
  t.maps++;
  mt!.maps++;
  add(t.overtime, rounds > 24);
  add(mt!.overtime, rounds > 24);
  t.avgRoundsPerMap.sum += rounds;
  t.avgRoundsPerMap.count++;
  if (halftimeScore && halftimeScore[0] !== halftimeScore[1] && finalWinner !== null) {
    const leader = halftimeScore[0] > halftimeScore[1] ? 0 : 1;
    add(bucket(t.halftime, `${Math.max(...halftimeScore)}-${Math.min(...halftimeScore)}`), finalWinner === leader);
  }
}

export function mergeTelemetry(a: Telemetry, b: Telemetry): Telemetry {
  const mergeR = (x: Ratio, y: Ratio): Ratio => ({ n: x.n + y.n, d: x.d + y.d });
  const mergeRec = (x: Record<string, Ratio>, y: Record<string, Ratio>) => {
    const out: Record<string, Ratio> = { ...x };
    for (const [k, v] of Object.entries(y)) out[k] = mergeR(out[k] ?? r(), v);
    return out;
  };
  const byMap: Record<string, MapTelemetry> = { ...a.byMap };
  for (const [k, v] of Object.entries(b.byMap)) {
    const m = byMap[k];
    byMap[k] = m
      ? {
          rounds: m.rounds + v.rounds, maps: m.maps + v.maps, ctRoundWins: mergeR(m.ctRoundWins, v.ctRoundWins), plantRate: mergeR(m.plantRate, v.plantRate),
          ctWinAfterPlant: mergeR(m.ctWinAfterPlant, v.ctWinAfterPlant), openingConversion: mergeR(m.openingConversion, v.openingConversion),
          pistolCtWin: mergeR(m.pistolCtWin, v.pistolCtWin), overtime: mergeR(m.overtime, v.overtime),
        }
      : v;
  }
  const reasons = { ...a.roundEndReasons };
  for (const [k, v] of Object.entries(b.roundEndReasons)) reasons[k] = (reasons[k] ?? 0) + v;
  return {
    maps: a.maps + b.maps, rounds: a.rounds + b.rounds, byMap,
    openingConversion: mergeR(a.openingConversion, b.openingConversion), plantRate: mergeR(a.plantRate, b.plantRate),
    ctWinAfterPlant: mergeR(a.ctWinAfterPlant, b.ctWinAfterPlant), pistolCtWin: mergeR(a.pistolCtWin, b.pistolCtWin), overtime: mergeR(a.overtime, b.overtime),
    buyMatchups: mergeRec(a.buyMatchups, b.buyMatchups), retakeByTier: mergeRec(a.retakeByTier, b.retakeByTier),
    retakeAllFiveDead: mergeR(a.retakeAllFiveDead, b.retakeAllFiveDead),
    retakeCtDeaths: { sum: a.retakeCtDeaths.sum + b.retakeCtDeaths.sum, count: a.retakeCtDeaths.count + b.retakeCtDeaths.count },
    states: mergeRec(a.states, b.states), clutches: mergeRec(a.clutches, b.clutches), halftime: mergeRec(a.halftime, b.halftime),
    roundEndReasons: reasons, avgRoundsPerMap: { sum: a.avgRoundsPerMap.sum + b.avgRoundsPerMap.sum, count: a.avgRoundsPerMap.count + b.avgRoundsPerMap.count },
    kills: a.kills + b.kills, tradeKills: a.tradeKills + b.tradeKills,
  };
}

/** Wilson 95% interval, in percent. */
export function wilson(x: Ratio): { pct: number; lo: number; hi: number } {
  if (x.d === 0) return { pct: NaN, lo: NaN, hi: NaN };
  const z = 1.96;
  const p = x.n / x.d;
  const denom = 1 + (z * z) / x.d;
  const centre = (p + (z * z) / (2 * x.d)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / x.d + (z * z) / (4 * x.d * x.d))) / denom;
  return { pct: p * 100, lo: (centre - half) * 100, hi: (centre + half) * 100 };
}
