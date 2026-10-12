/**
 * Map veto for best-of-1/3/5 series over a seven-map active pool, following
 * the standard competitive templates. Team A (higher seed) starts the veto.
 *
 *   BO1: A ban, B ban, A ban, B ban, A ban, B ban → last map (start sides by knife round)
 *   BO3: A ban, B ban, A pick, B pick, A ban, B ban → decider
 *   BO5: A ban, B ban, A pick, B pick, A pick, B pick → decider
 *
 * On a picked map the *other* team chooses its starting side.
 */
import type { Rng } from '../rng/prng';

export type BestOf = 1 | 3 | 5;
export type VetoAction = 'ban' | 'pick' | 'decider';

export interface VetoStep {
  readonly team: 0 | 1 | null;
  readonly action: VetoAction;
  readonly mapId: string;
}

export interface SeriesMap {
  readonly mapId: string;
  /** Team that picked the map (null for the decider). */
  readonly pickedBy: 0 | 1 | null;
  /** Team that starts on the defending (CT) side. */
  readonly startDefender: 0 | 1;
}

export interface VetoResult {
  readonly steps: readonly VetoStep[];
  readonly maps: readonly SeriesMap[];
}

/** Per-map strength of a team (higher = better), e.g. playbook rating. */
export type MapPreferences = Readonly<Record<string, number>>;

const TEMPLATES: Record<BestOf, readonly ('A-ban' | 'B-ban' | 'A-pick' | 'B-pick')[]> = {
  1: ['A-ban', 'B-ban', 'A-ban', 'B-ban', 'A-ban', 'B-ban'],
  3: ['A-ban', 'B-ban', 'A-pick', 'B-pick', 'A-ban', 'B-ban'],
  5: ['A-ban', 'B-ban', 'A-pick', 'B-pick', 'A-pick', 'B-pick'],
};

/** Does team `t` prefer to start on defence on this map? Defence-sided maps say yes. */
export type SidePreference = (team: 0 | 1, mapId: string) => boolean;

export function runVeto(pool: readonly string[], bestOf: BestOf, prefs: readonly [MapPreferences, MapPreferences], rng: Rng, prefersDefence: SidePreference = () => true): VetoResult {
  if (new Set(pool).size !== pool.length) throw new Error('veto pool has duplicate maps');
  if (pool.length !== 7) throw new Error(`veto needs a 7-map pool, got ${pool.length}`);
  const left = [...pool];
  const steps: VetoStep[] = [];
  const maps: SeriesMap[] = [];
  // Small seeded noise so equally-rated maps don't always resolve the same way.
  const noise = new Map<string, number>(pool.flatMap((m) => [[`0:${m}`, rng.normal(0, 0.4)], [`1:${m}`, rng.normal(0, 0.4)]]));
  const value = (team: 0 | 1, m: string) => (prefs[team][m] ?? 0) - (prefs[1 - team as 0 | 1][m] ?? 0) + noise.get(`${team}:${m}`)!;
  const take = (m: string) => left.splice(left.indexOf(m), 1);
  for (const step of TEMPLATES[bestOf]) {
    const team: 0 | 1 = step.startsWith('A') ? 0 : 1;
    const ranked = [...left].sort((x, y) => value(team, y) - value(team, x) || (x < y ? -1 : 1));
    if (step.endsWith('ban')) {
      const m = ranked[ranked.length - 1]!; // worst relative map
      take(m);
      steps.push({ team, action: 'ban', mapId: m });
    } else {
      const m = ranked[0]!;
      take(m);
      steps.push({ team, action: 'pick', mapId: m });
      const chooser = (1 - team) as 0 | 1;
      maps.push({ mapId: m, pickedBy: team, startDefender: prefersDefence(chooser, m) ? chooser : team });
    }
  }
  if (left.length !== 1) throw new Error('veto template left more than one map');
  const decider = left[0]!;
  steps.push({ team: null, action: 'decider', mapId: decider });
  const knifeWinner: 0 | 1 = rng.chance(0.5) ? 0 : 1;
  maps.push({ mapId: decider, pickedBy: null, startDefender: prefersDefence(knifeWinner, decider) ? knifeWinner : ((1 - knifeWinner) as 0 | 1) });
  return { steps, maps };
}

export const mapsToWin = (bo: BestOf): number => Math.ceil(bo / 2);
