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
