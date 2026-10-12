/**
 * Round-win probability model shared by the engine's save decisions and AMR's
 * Round Swing. Starts from the calibration pack's man-advantage seeds and adjusts
 * for equipment and the planted bomb. Pure: works from counts and gear only.
 */
import { weaponById } from '../rules/arsenal';

/** P(side with `m` alive beats `e` alive) on neutral terms (calibration pack state seeds). */
const FAVOURED: Record<string, number> = {
  '5v4': 0.72, '5v3': 0.9, '5v2': 0.97, '5v1': 0.995,
  '4v3': 0.78, '4v2': 0.9, '4v1': 0.98,
  '3v2': 0.78, '3v1': 0.93,
  '2v1': 0.77,
};

export function neutralWinChance(m: number, e: number): number {
  if (m <= 0) return 0;
  if (e <= 0) return 1;
  if (m === e) return 0.5;
  if (m > e) return FAVOURED[`${m}v${e}`] ?? 0.99;
  return 1 - (FAVOURED[`${e}v${m}`] ?? 0.99);
}

/** 0..1 equipment strength of a loadout (best weapon × armour). */
export function gearScore(primary: string | null, secondary: string, armor: number): number {
  const w = weaponById(primary ?? secondary);
  const gun = w.category === 'sniper' ? 1 : w.category === 'rifle' ? (w.price >= 2500 ? 0.92 : 0.75) : w.category === 'smg' || w.category === 'heavy' ? 0.55 : w.price >= 500 ? 0.35 : 0.22;
  return gun * (armor > 0 ? 1 : 0.8);
}

export const GEAR_ODDS_K = 2.2;
export const PLANT_ODDS = 2.6;

const odds = (p: number) => p / Math.max(1e-6, 1 - p);
const prob = (o: number) => o / (1 + o);

export interface RoundState {
  readonly attackersAlive: number;
  readonly defendersAlive: number;
  /** Mean gear score of living players per side. */
  readonly attackerGear: number;
  readonly defenderGear: number;
  readonly planted: boolean;
}

/** P(attackers win the round) from the current state. */
export function attackerWinProbability(s: RoundState): number {
  const p = neutralWinChance(s.attackersAlive, s.defendersAlive);
  if (p <= 0 || p >= 1) return p;
  let o = odds(p) * Math.exp(GEAR_ODDS_K * (s.attackerGear - s.defenderGear));
  if (s.planted) o *= PLANT_ODDS;
  return Math.max(0.001, Math.min(0.999, prob(o)));
}
