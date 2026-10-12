/** World entities used by the competition ecosystem. Plain data: serializable, no methods. */
import type { Day } from './calendar';
import type { MutableAttributes } from './attributes';

export type Region = 'EU' | 'AM' | 'AS';
export const REGIONS: readonly Region[] = ['EU', 'AM', 'AS'];
export const REGION_NAMES: Record<Region, string> = { EU: 'Europe', AM: 'Americas', AS: 'Asia' };

export type PlayerRole = 'AWPer' | 'In-game leader' | 'Star rifler' | 'Entry fragger' | 'Anchor' | 'Support' | 'Lurker';

export interface Player {
  readonly id: string;
  readonly name: string;
  readonly nickname: string;
  readonly nationality: string;
  readonly region: Region;
  readonly role: PlayerRole;
  /** Birth day relative to world start (negative = born before). */
  readonly bornDay: Day;
  /** The ten attributes the match engine uses (0–100). */
  attrs: MutableAttributes;
  /** Hidden per-attribute ceilings. Never shown directly: scouting reports estimate them. */
  ceiling: MutableAttributes;
  /** Role-aware overall from `attrs` (cached; recomputed whenever attributes change). */
  skill: number;
  /** Role-aware overall from `ceiling` (hidden potential). */
  potential: number;
  /** Org currently employing the player, or null for free agents. */
  orgId: string | null;
  /** Day the player joined the current org (tenure protects new signings from being benched). */
  joinedDay: Day;
  retired: boolean;
}

/** How an AI organisation behaves in the competitive ecosystem. */
export type Archetype = 'elite' | 'contender' | 'developing' | 'grassroots';

export interface Org {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly homeRegion: Region;
  archetype: Archetype;
  /** Cash in USD. Prize money is credited here. */
  money: number;
  /** Exactly five starting players when competing. */
  roster: string[];
  /** Contracted players not in the starting five (benched, transfer-listed). Paid, never fielded. */
  bench: string[];
  /** Controlled by the human player. */
  isUser: boolean;
  /** Employed staff (head coach first, then scouts). */
  staff: string[];
}

export type StaffRole = 'coach' | 'scout';

/** Coaches and scouts. Ratings 1–100; only the ones relevant to the role matter. */
export interface Staff {
  readonly id: string;
  readonly name: string;
  readonly nationality: string;
  readonly region: Region;
  readonly role: StaffRole;
  readonly bornDay: Day;
  orgId: string | null;
  /** Coach: how much players grow under them. */
  development: number;
  /** Coach: map preparation and utility precision (engine CoachSetup.preparation). */
  preparation: number;
  /** Coach: reading opponents (engine CoachSetup.reading). */
  reading: number;
  /** Coach: tactical timeouts and in-match adjustments (engine CoachSetup.adaptation). */
  adaptation: number;
  /** Scout: accuracy judging current ability. */
  judging: number;
  /** Scout: accuracy judging potential. */
  potentialEye: number;
  /** Scout: how many players a week they can assess. */
  reach: number;
}

export interface World {
  readonly seed: string;
  readonly version: number;
  day: Day;
  readonly players: Map<string, Player>;
  readonly orgs: Map<string, Org>;
  readonly staff: Map<string, Staff>;
  /** Counter for generated IDs (players created after world start). */
  nextPlayerSeq: number;
}

export const ageOn = (p: Player, day: Day): number => Math.floor((day - p.bornDay) / 365);
