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
  /** Current employment contract (null for free agents). Moves only via expiry, release or a paid transfer. */
  contract: Contract | null;
  /** What the player wants from a career; fixed personality, drives negotiations. */
  readonly motives: CareerMotives;
  /** 0–100 competitive reputation: ability seen in results, team success and stage. */
  reputation: number;
  /** Wages, bonuses and prize shares earned (USD). */
  careerEarnings: number;
}

/** Weights (0–1) of what a player values when choosing a club. */
export interface CareerMotives {
  /** Financial ambition: salary and bonuses. */
  readonly money: number;
  /** Chasing titles: a club with a realistic path to championships. */
  readonly winning: number;
  /** Starting rather than sitting on a bench; a desired role. */
  readonly playingTime: number;
  /** Prestige of the organisation and its stage. */
  readonly prestige: number;
  /** Preference for staying at the current club and in the home scene. */
  readonly loyalty: number;
}

export interface Contract {
  readonly orgId: string;
  /** Monthly wage (USD). */
  readonly monthly: number;
  readonly startDay: Day;
  /** Expires on a roster-window day (1 January or 1 July). */
  readonly endDay: Day;
  /** One-off payment on signing (USD). */
  readonly signingBonus: number;
  /** Release clause: any club paying this fee may sign the player (null: negotiated transfer only). */
  readonly buyout: number | null;
  /** Share of the club's prize money paid to the starting five (0–0.4). */
  readonly prizeShare: number;
  /** Promised squad status, part of what the player agreed to. */
  readonly status: 'starter' | 'rotation' | 'prospect';
}

export type LedgerKind =
  | 'revenue' | 'prize' | 'prize_share' | 'wages' | 'staff_wages' | 'signing_bonus'
  | 'transfer_in' | 'transfer_out' | 'termination' | 'subsidy' | 'opening';

export interface LedgerEntry {
  readonly day: Day;
  readonly kind: LedgerKind;
  /** Signed amount in USD (income positive). */
  readonly amount: number;
  readonly memo: string;
}

/** An owner or investor who deliberately covers losses; explicit, capped and time-limited. */
export interface Backer {
  readonly name: string;
  readonly kind: 'owner' | 'investor';
  /** Maximum monthly top-up (USD). */
  readonly monthlyCap: number;
  /** Day the commitment ends. */
  readonly untilDay: Day;
}

export interface OrgFinance {
  /** 0–100 brand prestige: results, history and stage. Drives sponsor revenue and player interest. */
  prestige: number;
  /** Explicit external funding, if any. */
  backer: Backer | null;
  /** Share of revenue the club is prepared to spend on player wages (its competitive ambition). */
  wageAmbition: number;
  /** Cash at the start of the retained ledger window; `money` = opening + sum(ledger). */
  ledgerOpening: number;
  /** Recent entries (the last ~24 months; older entries are folded into `ledgerOpening`). */
  ledger: LedgerEntry[];
  /** Consecutive months with negative cash (drives forced sales). */
  monthsInDebt: number;
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
  finance: OrgFinance;
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
