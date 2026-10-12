import { describe, expect, it } from 'vitest';
import { isLastRoundOfHalf, isOvertimeHalfStart, isSideSwitchBefore, mapOutcome, MR12_STANDARD, winTarget } from '../../src/core/match/rules/ruleset';

const f = MR12_STANDARD.format;

describe('MR12 format and CS2-style overtime', () => {
  it('swaps sides only at regulation halftime and at each overtime halftime', () => {
    const swaps = Array.from({ length: 48 }, (_, r) => r).filter((r) => isSideSwitchBefore(f, r));
    // Regulation half (12); OT1 half (27); OT2 half (33); OT3 half (39); OT4 half (45). No swap at 24, 30, 36, 42.
    expect(swaps).toEqual([12, 27, 33, 39, 45]);
  });

  it('resets money at every overtime half start, including set starts without a swap', () => {
    const resets = Array.from({ length: 40 }, (_, r) => r).filter((r) => isOvertimeHalfStart(f, r));
    expect(resets).toEqual([24, 27, 30, 33, 36, 39]);
    expect(MR12_STANDARD.economy.overtimeStartMoney).toBe(12500);
  });

  it('win targets: 13 in regulation, then 16, 19, 22... per overtime set', () => {
    expect(winTarget(f, 13)).toBe(13);
    expect(winTarget(f, 24)).toBe(13);
    expect(winTarget(f, 25)).toBe(16);
    expect(winTarget(f, 30)).toBe(16);
    expect(winTarget(f, 31)).toBe(19);
  });

  it('map outcomes: clinch at 13, 12–12 continues, 15–15 continues, 16–14 ends', () => {
    expect(mapOutcome(f, [13, 5], 18)).toBe(0);
    expect(mapOutcome(f, [12, 12], 24)).toBeNull();
    expect(mapOutcome(f, [16, 14], 30)).toBe(0);
    expect(mapOutcome(f, [15, 15], 30)).toBeNull();
    expect(mapOutcome(f, [15, 19], 34)).toBe(1);
    expect(mapOutcome({ ...f, mustProduceWinner: false }, [12, 12], 24)).toBe('draw');
  });

  it('last round of each half (no future value in saving)', () => {
    const last = Array.from({ length: 36 }, (_, r) => r).filter((r) => isLastRoundOfHalf(f, r));
    expect(last).toEqual([11, 23, 26, 29, 32, 35]);
  });
});
