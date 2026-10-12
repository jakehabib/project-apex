/** World entities used by the competition ecosystem. Plain data: serializable, no methods. */
import type { Day } from './calendar';

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
  /** Current overall ability 0..100 (drives match strength). */
  skill: number;
  /** Ceiling the player can grow toward. */
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
}

export interface World {
  readonly seed: string;
  readonly version: number;
  day: Day;
  readonly players: Map<string, Player>;
  readonly orgs: Map<string, Org>;
  /** Counter for generated IDs (players created after world start). */
  nextPlayerSeq: number;
}

export const ageOn = (p: Player, day: Day): number => Math.floor((day - p.bornDay) / 365);
