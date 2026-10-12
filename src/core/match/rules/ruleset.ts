/**
 * Match rules are data. The default ruleset follows the modern MR12 tactical
 * shooter convention: 24 regulation rounds, side switch after 12, first to 13,
 * overtime blocks of 6 (MR3) with a side switch after 3. Values are a
 * configurable game ruleset, not a claim about any official league rulebook.
 */

export interface EconomyRules {
  readonly startMoney: number;
  readonly maxMoney: number;
  readonly overtimeStartMoney: number;
  /** Loss bonus ladder indexed by consecutive-loss counter (capped at last entry). */
  readonly lossBonus: readonly number[];
  readonly winReward: {
    readonly elimination: number;
    readonly bombDetonated: number;
    readonly bombDefused: number;
    readonly timeExpired: number;
  };
  /** Extra team money for attackers who lose a round after planting. */
  readonly attackerPlantLossBonus: number;
  /** Individual reward for the planter / defuser. */
  readonly plantReward: number;
  readonly defuseReward: number;
  /** Attackers who survive a lost time-expired round receive no money (genre convention). */
  readonly noRewardForTimeoutSurvivors: boolean;
  /** Loss streak counter at the start of each half (1 => a lost pistol round pays the 2nd ladder step). */
  readonly halfStartLossStreak: number;
}

export interface TimingRules {
  readonly freezeTimeMs: number;
  readonly roundTimeMs: number;
  readonly bombTimerMs: number;
  readonly plantTimeMs: number;
  readonly defuseTimeMs: number;
  readonly defuseKitTimeMs: number;
  readonly buyTimeMs: number;
}

export interface FormatRules {
  readonly regulationRounds: number;
  readonly halfLength: number;
  readonly overtimeEnabled: boolean;
  readonly overtimeRounds: number;
  readonly overtimeHalfLength: number;
  /** When false, regulation can end tied (e.g. group-stage draws). */
  readonly mustProduceWinner: boolean;
  /** Tactical timeouts available to each team per map. */
  readonly timeoutsPerTeam: number;
}

export interface Ruleset {
  readonly id: string;
  readonly name: string;
  readonly economy: EconomyRules;
  readonly timing: TimingRules;
  readonly format: FormatRules;
}

export const MR12_STANDARD: Ruleset = {
  id: 'mr12-standard',
  name: 'MR12 Standard',
  economy: {
    startMoney: 800,
    maxMoney: 16000,
    overtimeStartMoney: 12500,
    lossBonus: [1400, 1900, 2400, 2900, 3400],
    winReward: { elimination: 3250, bombDetonated: 3500, bombDefused: 3500, timeExpired: 3250 },
    attackerPlantLossBonus: 600,
    plantReward: 300,
    defuseReward: 300,
    noRewardForTimeoutSurvivors: true,
    halfStartLossStreak: 1,
  },
  timing: {
    freezeTimeMs: 15000,
    roundTimeMs: 115000,
    bombTimerMs: 40000,
    plantTimeMs: 3200,
    defuseTimeMs: 10000,
    defuseKitTimeMs: 5000,
    buyTimeMs: 20000,
  },
  format: {
    regulationRounds: 24,
    halfLength: 12,
    overtimeEnabled: true,
    overtimeRounds: 6,
    overtimeHalfLength: 3,
    mustProduceWinner: true,
    timeoutsPerTeam: 3,
  },
};

/** Rounds needed to win regulation (13 under MR12). */
export const regulationTarget = (f: FormatRules): number => f.halfLength + 1;

/**
 * Whether teams swap sides before playing the given 0-based round index.
 * Covers regulation (after round 12) and every overtime half boundary.
 */
export function isSideSwitchBefore(f: FormatRules, roundIndex: number): boolean {
  if (roundIndex === 0) return false;
  if (roundIndex < f.regulationRounds) return roundIndex === f.halfLength;
  const intoOt = roundIndex - f.regulationRounds;
  // Teams keep the side they ended regulation on for OT1's first half; then
  // switch at each OT half boundary.
  return intoOt > 0 && intoOt % f.overtimeHalfLength === 0;
}

/** Score needed to win given rounds already played (handles regulation and every overtime block). */
export function winTarget(f: FormatRules, roundsPlayed: number): number {
  if (roundsPlayed <= f.regulationRounds) return f.halfLength + 1;
  const block = Math.floor((roundsPlayed - f.regulationRounds - 1) / f.overtimeRounds);
  return f.regulationRounds / 2 + block * (f.overtimeRounds / 2) + f.overtimeRounds / 2 + 1;
}

/** Map winner after `roundsPlayed` rounds, 'draw', or null if the map continues. */
export function mapOutcome(f: FormatRules, scores: readonly [number, number], roundsPlayed: number): 0 | 1 | 'draw' | null {
  const target = winTarget(f, roundsPlayed);
  if (scores[0] >= target) return 0;
  if (scores[1] >= target) return 1;
  if (roundsPlayed === f.regulationRounds && scores[0] === scores[1] && (!f.overtimeEnabled || !f.mustProduceWinner)) return 'draw';
  return null;
}

/** True if this round is the last of its half (money resets afterwards, so saving has no value). */
export function isLastRoundOfHalf(f: FormatRules, roundIndex: number): boolean {
  return isSideSwitchBefore(f, roundIndex + 1) || roundIndex + 1 === f.regulationRounds;
}

/** 0-based index of the round within its half. */
export function roundInHalf(f: FormatRules, roundIndex: number): number {
  if (roundIndex < f.regulationRounds) return roundIndex % f.halfLength;
  return (roundIndex - f.regulationRounds) % f.overtimeHalfLength;
}
