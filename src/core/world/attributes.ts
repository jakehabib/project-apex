/**
 * Player attributes in the world model: the same ten 0–100 attributes the match
 * engine consumes, plus a hidden per-attribute ceiling (potential). The overall
 * rating is role-aware: an anchor is judged on what anchors do.
 */
import type { Rng } from '../rng/prng';
import { ATTRIBUTE_KEYS, type Attributes, type Role } from '../match/engine/types';
import type { PlayerRole } from './types';

export type AttrKey = keyof Attributes;
export type MutableAttributes = { -readonly [K in AttrKey]: number };

/** Mechanical skills peak early; tactical/mental ones keep growing into the late twenties. */
export const MECHANICAL: readonly AttrKey[] = ['rifling', 'awp', 'opening'];
export const TACTICAL: readonly AttrKey[] = ['positioning', 'utility', 'gameSense', 'teamwork', 'clutch', 'calling', 'adaptability'];

/** Weights of each attribute in a role's overall rating (each row sums to 1). */
export const ROLE_WEIGHTS: Record<PlayerRole, Partial<Record<AttrKey, number>>> = {
  AWPer: { awp: 0.38, positioning: 0.12, rifling: 0.1, clutch: 0.1, gameSense: 0.1, opening: 0.08, teamwork: 0.05, utility: 0.04, adaptability: 0.03 },
  'Star rifler': { rifling: 0.36, opening: 0.14, clutch: 0.12, positioning: 0.1, gameSense: 0.1, teamwork: 0.08, utility: 0.05, adaptability: 0.05 },
  'Entry fragger': { rifling: 0.3, opening: 0.26, teamwork: 0.12, utility: 0.1, gameSense: 0.08, positioning: 0.06, clutch: 0.04, adaptability: 0.04 },
  'In-game leader': { calling: 0.3, gameSense: 0.16, rifling: 0.14, utility: 0.12, teamwork: 0.1, positioning: 0.08, adaptability: 0.06, clutch: 0.04 },
  Anchor: { positioning: 0.26, rifling: 0.22, clutch: 0.14, utility: 0.12, gameSense: 0.12, teamwork: 0.08, adaptability: 0.06 },
  Support: { utility: 0.26, teamwork: 0.2, rifling: 0.2, gameSense: 0.12, positioning: 0.1, adaptability: 0.06, clutch: 0.06 },
  Lurker: { rifling: 0.26, gameSense: 0.2, positioning: 0.16, clutch: 0.16, opening: 0.1, adaptability: 0.06, utility: 0.06 },
};

/** Attributes a role leans on (generation boosts them; scouting reports highlight them). */
export const ROLE_FOCUS: Record<PlayerRole, readonly AttrKey[]> = {
  AWPer: ['awp', 'positioning'],
  'Star rifler': ['rifling', 'opening'],
  'Entry fragger': ['opening', 'rifling'],
  'In-game leader': ['calling', 'gameSense'],
  Anchor: ['positioning', 'clutch'],
  Support: ['utility', 'teamwork'],
  Lurker: ['gameSense', 'clutch'],
};

export function overallFor(attrs: Attributes, role: PlayerRole): number {
  const w = ROLE_WEIGHTS[role];
  let s = 0;
  let t = 0;
  for (const k of ATTRIBUTE_KEYS) {
    const wk = w[k] ?? 0;
    s += attrs[k] * wk;
    t += wk;
  }
  return Math.round((s / t) * 10) / 10;
}

const clamp = (x: number) => Math.round(Math.max(5, Math.min(99, x)));

/**
 * Attributes for a player whose role-overall should land near `overall`.
 * Role focus attributes are higher; the AWP attribute is low for non-AWPers and calling low for non-IGLs.
 */
export function generateAttributes(rng: Rng, overall: number, role: PlayerRole, spread = 5): MutableAttributes {
  const a = {} as MutableAttributes;
  for (const k of ATTRIBUTE_KEYS) a[k] = rng.normal(overall - 2, spread);
  for (const k of ROLE_FOCUS[role]) a[k] += rng.range(4, 9);
  if (role !== 'AWPer') a.awp -= rng.range(14, 26);
  if (role !== 'In-game leader') a.calling -= rng.range(6, 16);
  for (const k of ATTRIBUTE_KEYS) a[k] = clamp(a[k]);
  // Correct the overall toward the target (one pass is enough at these spreads).
  const off = overall - overallFor(a, role);
  for (const k of ATTRIBUTE_KEYS) if ((ROLE_WEIGHTS[role][k] ?? 0) > 0) a[k] = clamp(a[k] + off);
  return a;
}

/** Hidden ceilings: each attribute's ceiling sits above its current value by a share of the overall headroom. */
export function generateCeiling(rng: Rng, attrs: Attributes, overallNow: number, potentialOverall: number): MutableAttributes {
  const headroom = Math.max(0, potentialOverall - overallNow);
  const c = {} as MutableAttributes;
  for (const k of ATTRIBUTE_KEYS) c[k] = clamp(attrs[k] + headroom * rng.range(0.6, 1.4) + rng.range(0, 3));
  return c;
}

/** Map a world role to the engine's role preference list. */
export function engineRoles(role: PlayerRole): Role[] {
  switch (role) {
    case 'AWPer':
      return ['awper'];
    case 'In-game leader':
      return ['igl', 'support'];
    case 'Star rifler':
      return ['star', 'lurker'];
    case 'Entry fragger':
      return ['entry'];
    case 'Anchor':
      return ['anchor', 'support'];
    case 'Support':
      return ['support', 'anchor'];
    case 'Lurker':
      return ['lurker', 'star'];
  }
}

/** Age multiplier on growth for an attribute group (1 = full speed). Negative values mean decline pressure. */
export function ageGrowth(group: 'mechanical' | 'tactical', age: number): number {
  if (group === 'mechanical') {
    if (age <= 19) return 1;
    if (age <= 22) return 0.8;
    if (age <= 25) return 0.45;
    if (age <= 27) return 0.1;
    if (age <= 29) return -0.5;
    if (age <= 31) return -1.1;
    return -1.8;
  }
  if (age <= 21) return 0.7;
  if (age <= 25) return 0.8;
  if (age <= 28) return 0.55;
  if (age <= 31) return 0.2;
  if (age <= 33) return -0.2;
  return -0.7;
}
