/**
 * Coach logic. Acts only at legal decision points (freeze time) and only on
 * information the team has: its own round history on the current side.
 *
 * A timeout diagnoses *how* recent rounds were lost and answers with a tactical
 * change for the rest of the half. Adaptation decides how often the coach
 * intervenes and how accurate the diagnosis is.
 */
import type { Rng } from '../../rng/prng';
import type { SiteId } from '../events';
import { emit, type MapCtx, type RoundRecord, type TacticalAdjustment, type TeamState } from './state';

const clamp = (x: number) => Math.max(0.05, Math.min(0.95, x));

/** The manager's live stance call. Balanced leaves the team's tactics unchanged. */
export type Stance = 'aggressive' | 'balanced' | 'passive';
export const STANCE_LABEL: Record<Stance, string> = { aggressive: 'play aggressive', balanced: 'play our standard game', passive: 'play passive' };

const STANCE_DELTA: Record<Stance, { tPace: number; ctAggression: number; ctRotation: number; ecoRisk: number; utilityUse: number }> = {
  aggressive: { tPace: 0.3, ctAggression: 0.35, ctRotation: 0.15, ecoRisk: 0.2, utilityUse: -0.1 },
  balanced: { tPace: 0, ctAggression: 0, ctRotation: 0, ecoRisk: 0, utilityUse: 0 },
  passive: { tPace: -0.3, ctAggression: -0.3, ctRotation: -0.2, ecoRisk: -0.15, utilityUse: 0.1 },
};

export function setStance(team: TeamState, stance: Stance): void {
  team.stance = stance;
  applyAdjustment(team, team.adjustment);
}

export function applyAdjustment(team: TeamState, adj: TacticalAdjustment | null): void {
  team.adjustment = adj;
  const st = STANCE_DELTA[team.stance];
  const b = team.setup.tactics;
  const base = team.stance === 'balanced' ? b : { ...b, tPace: clamp(b.tPace + st.tPace), ctAggression: clamp(b.ctAggression + st.ctAggression), ctRotation: clamp(b.ctRotation + st.ctRotation), ecoRisk: clamp(b.ecoRisk + st.ecoRisk), utilityUse: clamp(b.utilityUse + st.utilityUse) };
  team.tactics = {
    ...base,
    ...(adj?.biasA !== undefined ? { tBiasA: adj.biasA } : {}),
    ...(adj?.pace !== undefined ? { tPace: adj.pace } : {}),
    ...(adj?.utilityUse !== undefined ? { utilityUse: adj.utilityUse } : {}),
    ...(adj?.ctRotation !== undefined ? { ctRotation: adj.ctRotation } : {}),
    ...(adj?.ctAggression !== undefined ? { ctAggression: adj.ctAggression } : {}),
  };
}

/** Diagnosis of a losing run. Exported for tests. */
export function diagnose(team: TeamState, losses: readonly RoundRecord[]): TacticalAdjustment {
  const t = team.tactics;
  if (team.side === 'attacker') {
    const early = losses.filter((r) => r.fast && !r.planted).length;
    const postPlant = losses.filter((r) => r.planted).length;
    const site = repeated(losses);
    if (early >= Math.ceil(losses.length / 2)) {
      return { pace: clamp(t.tPace - 0.3), utilityUse: clamp(t.utilityUse + 0.25), ...(site ? { biasA: site === 'A' ? 0.25 : 0.75 } : {}), reason: 'Dying early: slow down, use full utility' };
    }
    if (postPlant >= Math.ceil(losses.length / 2)) {
      return { utilityUse: clamp(t.utilityUse + 0.2), ...(site ? { biasA: site === 'A' ? 0.75 : 0.25 } : {}), reason: 'Losing post-plants: keep utility for retakes' };
    }
    return { pace: clamp(t.tPace + 0.3), ...(site ? { biasA: site === 'A' ? 0.25 : 0.75 } : {}), reason: 'They rotate in time: hit faster' };
  }
  const planted = losses.filter((r) => r.planted).length;
  const late = losses.filter((r) => r.endMs > 70000).length;
  if (planted >= Math.ceil(losses.length / 2)) {
    return { ctRotation: clamp(t.ctRotation + 0.3), reason: 'Sites falling: rotate earlier' };
  }
  if (late >= Math.ceil(losses.length / 2)) {
    return { ctAggression: clamp(t.ctAggression + 0.3), reason: 'Losing late rounds: take early info' };
  }
  return { ctAggression: clamp(t.ctAggression - 0.2), ctRotation: clamp(t.ctRotation + 0.15), reason: 'Losing duels: play together, fewer solo fights' };
}

function repeated(rs: readonly RoundRecord[]): SiteId | null {
  const a = rs.filter((r) => r.site === 'A').length;
  const b = rs.filter((r) => r.site === 'B').length;
  if (Math.max(a, b) < 2 || a === b) return null;
  return a > b ? 'A' : 'B';
}

export function considerTimeout(m: MapCtx, team: TeamState, rng: Rng, roundsThisSide: number, tMs: number): boolean {
  if (team.timeoutsLeft <= 0 || roundsThisSide < 3) return false;
  const recent = team.history.slice(-Math.min(roundsThisSide, 4));
  const lastThree = recent.slice(-3);
  if (lastThree.length < 3 || lastThree.some((r) => r.won)) return false;
  const adapt = team.coach.adaptation / 100;
  if (!rng.chance(0.25 + 0.5 * adapt)) return false;
  team.timeoutsLeft--;
  const accurate = rng.chance(0.3 + 0.7 * adapt);
  const adj = accurate ? diagnose(team, recent.filter((r) => !r.won)) : { reason: 'Reset and refocus' };
  applyAdjustment(team, adj);
  emit(m, { type: 'timeout', tMs, team: team.index, reason: adj.reason });
  return true;
}
