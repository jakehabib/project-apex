/**
 * Season calendar template. Generates every tournament of a season with its
 * announcement date, invitation cutoff (a monthly snapshot), event dates,
 * invite rules, qualifier pathways, format and prize money.
 */
import { dayOf, type Day } from '../world/calendar';
import { REGIONS, type Region } from '../world/types';
import { prizeSplit, type StageConfig, type TournamentConfig } from './tournaments';

const T1_STAGES: readonly StageConfig[] = [
  { name: 'Group stage', kind: 'gsl', advance: 8, bestOf: 3, days: 4 },
  { name: 'Playoffs', kind: 'single', advance: 1, bestOf: 3, finalBestOf: 5, days: 4 },
];
const T2_STAGES: readonly StageConfig[] = [
  { name: 'Swiss stage', kind: 'swiss', advance: 8, bestOf: 1, decidingBestOf: 3, winsNeeded: 3, lossesOut: 3, days: 3 },
  { name: 'Playoffs', kind: 'single', advance: 1, bestOf: 3, days: 3 },
];
const T3_STAGES: readonly StageConfig[] = [{ name: 'Main bracket', kind: 'double', advance: 1, bestOf: 3, days: 3 }];
const QUAL_STAGES = (bo: 1 | 3): readonly StageConfig[] => [{ name: 'Qualifier bracket', kind: 'single', advance: 1, bestOf: bo, finalBestOf: 3, days: 2 }];
const CHAMP_STAGES: readonly StageConfig[] = [
  { name: 'Opening Stage', kind: 'swiss', advance: 8, bestOf: 1, decidingBestOf: 3, winsNeeded: 3, lossesOut: 3, days: 4 },
  { name: 'Elimination Stage', kind: 'swiss', advance: 8, bestOf: 1, decidingBestOf: 3, winsNeeded: 3, lossesOut: 3, days: 4 },
  { name: 'Champions Stage', kind: 'single', advance: 1, bestOf: 3, days: 4 },
];

const CITIES: Record<Region, readonly string[]> = {
  EU: ['Copenhagen', 'Cologne', 'Katowice', 'Paris', 'Stockholm', 'Lisbon', 'Belgrade', 'Hamburg', 'Valencia', 'Malta'],
  AM: ['Rio de Janeiro', 'Dallas', 'Atlanta', 'Buenos Aires', 'São Paulo', 'Montreal', 'Mexico City', 'Austin'],
  AS: ['Shanghai', 'Seoul', 'Melbourne', 'Singapore', 'Bangkok', 'Sydney', 'Ulaanbaatar', 'Tokyo'],
};
const T1_NAMES = ['Apex Masters', 'Crown Series', 'Summit Invitational', 'Atlas Open', 'Meridian Cup', 'Vanguard Masters', 'Pinnacle Series', 'Zenith Invitational'];
const T2_NAMES = ['Challenger Series', 'Proving Cup', 'Ascent League', 'Frontier Series', 'Rising Stars Cup', 'Contender Series'];
const REGION_LABEL: Record<Region, string> = { EU: 'Europe', AM: 'Americas', AS: 'Asia' };

/** Cutoff = the 1st of the month `monthsBefore` months before the event's month. */
function cutoffFor(season: number, month: number, monthsBefore: number): Day {
  let m = month - monthsBefore;
  let s = season;
  while (m < 0) {
    m += 12;
    s--;
  }
  return dayOf(s, m, 1);
}

export function seasonCalendar(season: number): TournamentConfig[] {
  const out: TournamentConfig[] = [];
  const id = (code: string) => `S${season}-${code}`;
  const pick = <T,>(xs: readonly T[], k: number) => xs[(k + season * 3) % xs.length]!;

  const qualifier = (parent: string, parentName: string, scope: Region, slots: number, start: Day, prize: number, prestige: number, bo: 1 | 3, maxEntrants: number, tier: TournamentConfig['tier'], code: string): TournamentConfig => ({
    id: id(code), name: `${parentName}: ${REGION_LABEL[scope]} Qualifier`, season, tier, scope, location: 'Online', lan: false,
    announceDay: start - 35, cutoffDay: null, startDay: start, endDay: start + 1, prizePool: prize, prizeSplit: prizeSplit(Math.max(2, slots * 2)),
    stages: QUAL_STAGES(bo), invites: [], qualifierSlots: [], open: true, maxEntrants, feeds: { eventId: parent, slots }, prestige,
  });

  // Tier 1 internationals: 16 teams, 12 global invites + 4 regional qualifier places.
  const t1Starts: [number, number][] = [[0, 26], [1, 23], [2, 23], [3, 20], [6, 20], [7, 24], [8, 21], [9, 19]];
  t1Starts.forEach(([month, dom], k) => {
    const start = dayOf(season, month, dom);
    const code = `T1-${k + 1}`;
    const city = pick(CITIES[(['EU', 'AM', 'EU', 'AS', 'EU', 'AM', 'EU', 'AS'] as Region[])[k]!], k);
    const name = `${pick(T1_NAMES, k)} ${city}`;
    const quals = [
      qualifier(id(code), name, 'EU', 2, start - 18, 20_000, 45, 3, 32, 2, `${code}-QEU`),
      qualifier(id(code), name, 'AM', 1, start - 18, 10_000, 45, 3, 32, 2, `${code}-QAM`),
      qualifier(id(code), name, 'AS', 1, start - 18, 10_000, 45, 3, 32, 2, `${code}-QAS`),
    ];
    out.push(...quals);
    out.push({
      id: id(code), name, season, tier: 1, scope: 'global', location: city, lan: true,
      announceDay: cutoffFor(season, month, 2) - 30, cutoffDay: cutoffFor(season, month, 2), startDay: start, endDay: start + 7,
      prizePool: 1_000_000, prizeSplit: prizeSplit(16), stages: T1_STAGES,
      invites: [{ list: 'global', count: 12, fromRank: 1, entryStage: 0 }],
      qualifierSlots: quals.map((q) => ({ qualifierId: q.id, count: q.feeds!.slots, entryStage: 0 })), open: false, maxEntrants: 16, prestige: 80,
    });
  });

  // Tier 2: alternate global and regional events.
  const t2Starts: [number, number][] = [[0, 12], [1, 6], [2, 6], [3, 4], [4, 4], [4, 22], [6, 6], [7, 4], [8, 4], [9, 4], [10, 2], [10, 20]];
  t2Starts.forEach(([month, dom], k) => {
    const start = dayOf(season, month, dom);
    const code = `T2-${k + 1}`;
    const regional: Region | null = k % 2 === 1 ? REGIONS[(k >> 1) % 3]! : null;
    const name = `${pick(T2_NAMES, k)} ${regional ? REGION_LABEL[regional] : 'International'} ${k + 1}`;
    const quals = regional
      ? [qualifier(id(code), name, regional, 8, start - 12, 5_000, 25, 1, 64, 3, `${code}-Q${regional}`)]
      : [qualifier(id(code), name, 'EU', 4, start - 12, 5_000, 25, 1, 64, 3, `${code}-QEU`), qualifier(id(code), name, 'AM', 2, start - 12, 3_000, 25, 1, 64, 3, `${code}-QAM`), qualifier(id(code), name, 'AS', 2, start - 12, 3_000, 25, 1, 64, 3, `${code}-QAS`)];
    out.push(...quals);
    out.push({
      id: id(code), name, season, tier: 2, scope: regional ?? 'global', location: regional ? pick(CITIES[regional], k) : 'Online', lan: !regional && k % 4 === 0,
      announceDay: cutoffFor(season, month, 1) - 30, cutoffDay: cutoffFor(season, month, 1), startDay: start, endDay: start + 5,
      prizePool: regional ? (regional === 'EU' ? 150_000 : regional === 'AM' ? 100_000 : 70_000) : 250_000, prizeSplit: prizeSplit(16), stages: T2_STAGES,
      invites: [{ list: regional ?? 'global', count: 8, fromRank: regional ? 4 : 10, entryStage: 0 }],
      qualifierSlots: quals.map((q) => ({ qualifierId: q.id, count: q.feeds!.slots, entryStage: 0 })), open: false, maxEntrants: 16, prestige: regional ? 40 : 50,
    });
  });

  // Tier 3 regional cups every four weeks: 4 regional invites + 12 from an open qualifier.
  for (const region of REGIONS) {
    const offset = region === 'EU' ? 0 : region === 'AM' ? 9 : 18;
    for (let k = 0; k < 12; k++) {
      const start = dayOf(season, 0, 8) + offset + k * 28;
      if (start + 3 >= dayOf(season + 1, 0, 1)) break;
      const code = `T3-${region}-${k + 1}`;
      const name = `${REGION_LABEL[region]} Development Cup #${k + 1}`;
      const q = qualifier(id(code), name, region, 12, start - 6, 0, 10, 1, 64, 3, `${code}-Q`);
      out.push(q);
      const month = Math.min(11, Math.floor((start - dayOf(season, 0, 1)) / 30.5));
      out.push({
        id: id(code), name, season, tier: 3, scope: region, location: 'Online', lan: false,
        announceDay: start - 40, cutoffDay: cutoffFor(season, month, 1), startDay: start, endDay: start + 2,
        prizePool: region === 'EU' ? 40_000 : region === 'AM' ? 25_000 : 15_000, prizeSplit: prizeSplit(16), stages: T3_STAGES,
        invites: [{ list: region, count: 4, fromRank: 12, entryStage: 0 }], qualifierSlots: [{ qualifierId: q.id, count: 12, entryStage: 0 }],
        open: false, maxEntrants: 16, prestige: 15,
      });
    }
  }

  // World Championships (June and December): regional snapshot invites into both Swiss stages + regional qualifiers.
  for (const [k, month, dom] of [[1, 5, 8], [2, 11, 1]] as const) {
    const start = dayOf(season, month, dom);
    const code = `WC${k}`;
    const name = `Apex World Championship ${k === 1 ? 'I' : 'II'}`;
    const quals = (['EU', 'AM', 'AS'] as const).map((r) => qualifier(id(code), name, r, r === 'EU' ? 3 : 2, start - 26, 25_000, 60, 3, 64, 2, `${code}-Q${r}`));
    out.push(...quals);
    out.push({
      id: id(code), name, season, tier: 'championship', scope: 'global', location: k === 1 ? pick(CITIES.EU, season) : pick(CITIES[season % 2 ? 'AM' : 'AS'], season), lan: true,
      announceDay: cutoffFor(season, month, 2) - 60, cutoffDay: cutoffFor(season, month, 2), startDay: start, endDay: start + 13,
      prizePool: 1_250_000, prizeSplit: prizeSplit(24), stages: CHAMP_STAGES,
      invites: [
        { list: 'EU', count: 4, fromRank: 1, entryStage: 1 },
        { list: 'AM', count: 2, fromRank: 1, entryStage: 1 },
        { list: 'AS', count: 2, fromRank: 1, entryStage: 1 },
        { list: 'EU', count: 5, fromRank: 5, entryStage: 0 },
        { list: 'AM', count: 2, fromRank: 3, entryStage: 0 },
        { list: 'AS', count: 2, fromRank: 3, entryStage: 0 },
      ],
      qualifierSlots: quals.map((q) => ({ qualifierId: q.id, count: q.feeds!.slots, entryStage: 0 })), open: false, maxEntrants: 24, prestige: 100,
    });
  }
  return out.sort((a, b) => a.startDay - b.startDay || (a.id < b.id ? -1 : 1));
}
