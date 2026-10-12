/**
 * Madden-style display ratings: OVR and POT on a 1–99 scale, a monotonic mapping
 * of the internal role-aware overall (which drives the engine and stays unchanged).
 * Anchors: most Tier 1 starters ≥80, the truly elite 90+, generational talents 99.
 */
const ANCHORS: readonly [number, number][] = [
  [0, 1], [30, 25], [50, 50], [64, 66], [70, 74], [75, 80], [83, 87], [89, 91], [92, 95], [94.5, 99],
];

export function toOvr(skill: number): number {
  if (skill >= ANCHORS[ANCHORS.length - 1]![0]) return 99;
  for (let i = 1; i < ANCHORS.length; i++) {
    const [x1, y1] = ANCHORS[i]!;
    if (skill <= x1) {
      const [x0, y0] = ANCHORS[i - 1]!;
      return Math.max(1, Math.min(99, Math.round(y0 + ((skill - x0) * (y1 - y0)) / (x1 - x0))));
    }
  }
  return 99;
}

export type RatingTier = 'Generational' | 'Elite' | 'Star' | 'Tier 1' | 'Pro' | 'Semi-pro' | 'Amateur';

export function ratingTier(ovr: number): RatingTier {
  return ovr >= 97 ? 'Generational' : ovr >= 90 ? 'Elite' : ovr >= 85 ? 'Star' : ovr >= 80 ? 'Tier 1' : ovr >= 70 ? 'Pro' : ovr >= 58 ? 'Semi-pro' : 'Amateur';
}

/** Single-attribute display (attributes are already 1–99-like; shown as integers). */
export const attrDisplay = (x: number): number => Math.max(1, Math.min(99, Math.round(x)));
