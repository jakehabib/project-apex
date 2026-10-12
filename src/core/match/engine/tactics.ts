import type { Tactics } from './types';

export interface TacticsPreset extends Tactics {
  readonly name: string;
  readonly summary: string;
  readonly strengths: string;
  readonly risks: string;
}

/** Beginner-level identities (brief §9.1). Each trades something away; none is strictly best. */
export const TACTICS_PRESETS: readonly TacticsPreset[] = [
  {
    id: 'balanced', name: 'Balanced Control', tPace: 0.45, tBiasA: 0.5, tGrouping: 0.6, ecoRisk: 0.35, ctAggression: 0.35, ctRotation: 0.5, utilityUse: 0.65,
    summary: 'Standard setups, mixed tempo, disciplined economy.',
    strengths: 'Hard to read; few self-inflicted economic breaks.',
    risks: 'Rarely overwhelms a better-prepared opponent.',
  },
  {
    id: 'aggressive', name: 'Aggressive Contact', tPace: 0.85, tBiasA: 0.5, tGrouping: 0.75, ecoRisk: 0.7, ctAggression: 0.75, ctRotation: 0.7, utilityUse: 0.45,
    summary: 'Fast hits, early info pushes, frequent force-buys.',
    strengths: 'Punishes passive or slow-rotating defenses; many opening duels.',
    risks: 'Broken economies after lost forces; loses trades to disciplined crossfires.',
  },
  {
    id: 'methodical', name: 'Methodical Default', tPace: 0.15, tBiasA: 0.5, tGrouping: 0.45, ecoRisk: 0.25, ctAggression: 0.25, ctRotation: 0.4, utilityUse: 0.7,
    summary: 'Slow map control and late calls based on information.',
    strengths: 'Strong with a good caller; exploits over-rotations.',
    risks: 'Time pressure; weak callers waste rounds.',
  },
  {
    id: 'utility', name: 'Utility Executes', tPace: 0.5, tBiasA: 0.5, tGrouping: 0.85, ecoRisk: 0.2, ctAggression: 0.3, ctRotation: 0.5, utilityUse: 1,
    summary: 'Full smokes and flashes on every take; saves to keep buying them.',
    strengths: 'Breaks set defenses; rewards high-Utility rosters.',
    risks: 'Expensive; predictable if the executes become readable.',
  },
  {
    id: 'retake', name: 'Retake-Oriented CT', tPace: 0.45, tBiasA: 0.5, tGrouping: 0.6, ecoRisk: 0.35, ctAggression: 0.1, ctRotation: 0.85, utilityUse: 0.6,
    summary: 'Light site presence, fast rotations, play for retakes.',
    strengths: 'Rarely loses players to early executes; strong with good teamwork.',
    risks: 'Concedes plants; weak against strong post-plant teams.',
  },
];

export function presetById(id: string): TacticsPreset {
  return TACTICS_PRESETS.find((p) => p.id === id) ?? TACTICS_PRESETS[0]!;
}
