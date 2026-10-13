import type { MapDefinition } from '../maps/types';
import type { Ruleset } from '../rules/ruleset';

export const ENGINE_VERSION = 'apex-engine/1';

/** Visible 0–100 player attributes. Every one of them feeds the simulation (see docs/SIMULATION.md). */
export interface Attributes {
  /** Rifle/SMG/pistol duel accuracy and reaction. */
  readonly rifling: number;
  /** Sniper accuracy and reaction. */
  readonly awp: number;
  /** Willingness and success at taking first contact; entry speed. */
  readonly opening: number;
  /** Reaction on held angles, use of cover, not being caught off-angle. */
  readonly positioning: number;
  /** Flash blind strength, smoke placement accuracy, fire/frag damage. */
  readonly utility: number;
  /** Rotation reads, save judgement, bomb timing. */
  readonly gameSense: number;
  /** Trade spacing and refrag speed. */
  readonly teamwork: number;
  /** Composure when outnumbered. */
  readonly clutch: number;
  /** IGL plan quality, mid-round adaptation, economy alignment. */
  readonly calling: number;
  /** Penalty reduction on non-preferred side/role/map. */
  readonly adaptability: number;
}

export const ATTRIBUTE_KEYS: readonly (keyof Attributes)[] = [
  'rifling', 'awp', 'opening', 'positioning', 'utility', 'gameSense', 'teamwork', 'clutch', 'calling', 'adaptability',
];

export type Role = 'awper' | 'igl' | 'star' | 'entry' | 'support' | 'lurker' | 'anchor';

/**
 * Coach: never plays, but shapes preparation and in-match adjustments.
 *  - preparation: map proficiency and utility precision
 *  - reading: anti-strat — blends with the IGL's calling when reading opponent tendencies
 *  - adaptation: quality and timing of tactical timeouts
 */
export interface CoachSetup {
  readonly id: string;
  readonly name: string;
  readonly preparation: number;
  readonly reading: number;
  readonly adaptation: number;
}

export interface PlayerSetup {
  readonly id: string;
  readonly name: string;
  readonly attributes: Attributes;
  /** Role preferences, most preferred first. The first 'igl'-capable player calls. */
  readonly roles: readonly Role[];
}

/**
 * Team strategy. Values are 0..1 sliders; presets in tactics.ts give them names
 * and explanations. No preset is strictly better: each trades something away.
 */
export interface Tactics {
  readonly id: string;
  /** Attack tempo: 0 slow defaults, 1 fast hits. */
  readonly tPace: number;
  /** Preference for site A (0.5 neutral). */
  readonly tBiasA: number;
  /** 0 split across routes, 1 one grouped route. */
  readonly tGrouping: number;
  /** Willingness to force-buy instead of saving. */
  readonly ecoRisk: number;
  /** Defender aggression: early info pushes and forward holds. */
  readonly ctAggression: number;
  /** How readily defenders rotate on partial information. */
  readonly ctRotation: number;
  /** How much utility the team buys and uses. */
  readonly utilityUse: number;
}

export interface TeamSetup {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly players: readonly PlayerSetup[];
  readonly tactics: Tactics;
  /** 0..1 map practice/proficiency, by map id (default 0.5). */
  readonly mapProficiency?: Readonly<Record<string, number>>;
  /** 0..1 roster cohesion (default 0.5). Small, bounded effect on trades and execution timing. */
  readonly cohesion?: number;
  readonly coach?: CoachSetup;
  /** Broad GM economy philosophy (defaults to DEFAULT_ECONOMY_POLICY). The IGL AI makes the individual buys. */
  readonly economy?: EconomyPolicy;
}

/**
 * The manager's economy settings (research brief §11): broad philosophy only, never item-by-item buying.
 * Their effects are game-design tuning hypotheses, not measured professional rates.
 */
export interface EconomyPolicy {
  /** Willingness to force or half-buy rather than save for a full buy. */
  readonly aggression: 'conservative' | 'balanced' | 'aggressive';
  /** How hard the team works to put the sniper in the AWPer's hands (drops, financing). */
  readonly awpPriority: 'low' | 'standard' | 'high';
  /** Where grenade money goes: attacking executes, defensive retakes, or an even split. */
  readonly utilityFocus: 'balanced' | 'execute' | 'retake';
  /** How readily players follow a save call in a lost round. */
  readonly saveDiscipline: 'loose' | 'standard' | 'strict';
}

export const DEFAULT_ECONOMY_POLICY: EconomyPolicy = { aggression: 'balanced', awpPriority: 'standard', utilityFocus: 'balanced', saveDiscipline: 'standard' };

export const DEFAULT_COACH: CoachSetup = { id: 'none', name: 'No coach', preparation: 35, reading: 35, adaptation: 35 };

export interface MapSimInput {
  readonly matchId: string;
  readonly mapIndex: number;
  readonly seed: string;
  readonly map: MapDefinition;
  readonly ruleset: Ruleset;
  readonly teams: readonly [TeamSetup, TeamSetup];
  /** Which team index attacks first. */
  readonly firstAttacker: 0 | 1;
  /** Manager stance calls by round (the input log of a played match). */
  readonly instructions?: readonly { readonly round: number; readonly team: 0 | 1; readonly stance: 'aggressive' | 'balanced' | 'passive' }[];
  /** Test scenarios: the first round starts from a set-up situation (see ScenarioSetup). */
  readonly scenario?: ScenarioSetup;
  /** Developer-only diagnostics hook; never affects the simulation. */
  readonly trace?: (kind: string, data: Record<string, unknown>) => void;
}

/**
 * Scenario harness (tests and tactical diagnostics). Applies to the first round only: players
 * beyond the given counts sit the round out, and `planted` starts the round with the bomb already
 * planted on that site, attackers on post-plant spots and defenders around the retake positions.
 */
export interface ScenarioSetup {
  readonly attackers?: number;
  readonly defenders?: number;
  readonly planted?: 'A' | 'B';
}

export const TICK_MS = 50;
export const PERCEPTION_EVERY_TICKS = 2;
/** Knife-out run speed, map units per second (5 m/s). */
export const RUN_SPEED = 50;
export const WALK_FACTOR = 0.52;
export const FOV_HALF_RAD = (60 * Math.PI) / 180;
export const CLOSE_AWARENESS = 220;
export const MAX_SIGHT = 2200;
export const PLANT_RADIUS = 30;
export const THROW_RANGE = 1100;
