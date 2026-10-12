import type { Rng } from '../../rng/prng';
import type { MatchEvent, MatchEventInput, Side, SiteId, UtilityKind } from '../events';
import type { MapGrid } from '../maps/grid';
import type { NavGraph } from '../maps/nav';
import type { MapDefinition, Vec2 } from '../maps/types';
import type { Ruleset } from '../rules/ruleset';
import type { Attributes, CoachSetup, Role, Tactics, TeamSetup } from './types';

/** What an agent is currently trying to do. Assigned by team planners, executed per tick. */
export type Task =
  | { kind: 'idle' }
  | { kind: 'goto'; node: string; walk?: boolean; reason: string; notBefore?: number; via?: string; watch?: Vec2 }
  | { kind: 'hold'; node: string; watch: Vec2; reason: string }
  | { kind: 'plant'; node: string }
  | { kind: 'defuse' }
  | { kind: 'pickup' }
  | { kind: 'save'; node: string };

export interface Motion {
  readonly from: Vec2;
  readonly to: Vec2;
  readonly toNode: string;
  readonly t0: number;
  readonly dur: number;
}

export interface Agent {
  readonly id: string;
  readonly name: string;
  readonly team: number;
  readonly attrs: Attributes;
  readonly roles: readonly Role[];
  /** True for the team's in-game leader (pays a small aim cost for calling). */
  isIgl: boolean;
  /** Effective attribute multiplier for this map/side (proficiency, adaptability). 0.9..1.05 */
  formFactor: number;
  side: Side;
  alive: boolean;
  hp: number;
  armor: number;
  helmet: boolean;
  kit: boolean;
  money: number;
  primary: string | null;
  secondary: string;
  utility: string[];
  bomb: boolean;

  // Spatial
  node: string; // last node reached (or spawn)
  /** When stopped mid-edge: the node the agent was heading to. */
  edgeTo: string | null;
  pos: Vec2;
  motion: Motion | null;
  path: string[];
  walking: boolean;
  facing: Vec2;

  // Behaviour
  task: Task;
  taskSince: number;
  assignedNode: string | null;
  saving: boolean;

  // Combat
  target: string | null;
  readyAt: number;
  nextShotAt: number;
  burst: number;
  lastEngageAt: number;
  blindUntil: number;
  lastSeen: Map<string, number>;
  /** Enemies this agent saw in the latest perception pass. */
  seeing: Agent[];

  // Objective
  planting: { until: number } | null;
  defusing: { until: number; kit: boolean } | null;
}

export interface IntelEntry {
  pos: Vec2;
  t: number;
  /** True if from direct sight (vs. sound). */
  seen: boolean;
}

/** A coach/IGL adjustment applied for the rest of the half. */
export interface TacticalAdjustment {
  readonly biasA?: number;
  readonly pace?: number;
  readonly utilityUse?: number;
  readonly ctRotation?: number;
  readonly ctAggression?: number;
  readonly stack?: SiteId;
  readonly reason: string;
}

export interface RoundRecord {
  readonly won: boolean;
  readonly side: Side;
  /** Site where the round was decided (plant site, or the site the attack targeted). */
  readonly site: SiteId | null;
  readonly planted: boolean;
  readonly fast: boolean;
  readonly endMs: number;
}

export interface TeamState {
  readonly index: number;
  readonly setup: TeamSetup;
  tactics: Tactics;
  readonly coach: CoachSetup;
  timeoutsLeft: number;
  adjustment: TacticalAdjustment | null;
  history: RoundRecord[];
  side: Side;
  score: number;
  lossStreak: number;
  /** Shared, comms-level knowledge of enemy positions. Never the ground truth. */
  intel: Map<string, IntelEntry>;
  /** Cross-round memory: where this team met/used executes, by site (current half). */
  memory: { executes: Record<SiteId, number>; defendersSeen: Record<SiteId, number> };
  iglId: string;
  /** IGL calling blended with coach reading: used for reads of opponent tendencies. */
  calling: number;
}

/** The team's current caller: the IGL if alive, otherwise the best remaining caller at reduced effectiveness. */
export function currentCalling(ctx: RoundCtx, team: TeamState): { calling: number; caller: Agent | null } {
  const igl = ctx.byId.get(team.iglId);
  if (igl && igl.alive) return { calling: team.calling, caller: igl };
  const backups = ctx.agents.filter((a) => a.alive && a.team === team.index).sort((x, y) => y.attrs.calling - x.attrs.calling || (x.id < y.id ? -1 : 1));
  const b = backups[0];
  return { calling: b ? b.attrs.calling * 0.75 : 0, caller: b ?? null };
}

export interface Smoke {
  readonly pos: Vec2;
  readonly from: number;
  readonly until: number;
  readonly radius: number;
}

export interface Fire {
  readonly pos: Vec2;
  readonly from: number;
  until: number;
  readonly radius: number;
  readonly ownerId: string;
  readonly utilityId: string;
}

export interface PendingUtility {
  readonly kind: UtilityKind;
  readonly utilityId: string;
  readonly ownerId: string;
  readonly target: Vec2;
  readonly at: number;
  readonly quality: number;
}

export interface BombState {
  carrierId: string | null;
  dropped: { pos: Vec2; node: string } | null;
  planted: { site: SiteId; pos: Vec2; node: string; at: number } | null;
  defused: boolean;
}

export interface MapCtx {
  readonly map: MapDefinition;
  readonly nav: NavGraph;
  readonly grid: MapGrid;
  readonly rules: Ruleset;
  readonly rng: Rng;
  readonly events: MatchEvent[];
  seq: number;
  roundIndex: number;
  readonly trace?: ((kind: string, data: Record<string, unknown>) => void) | undefined;
}

export interface RoundCtx {
  readonly m: MapCtx;
  readonly teams: readonly [TeamState, TeamState];
  readonly agents: Agent[];
  readonly byId: Map<string, Agent>;
  readonly rng: Rng;
  readonly attackerTeam: number;
  t: number;
  smokes: Smoke[];
  fires: Fire[];
  pending: PendingUtility[];
  bomb: BombState;
  /** Damage dealt this round: victim -> attacker -> amount (for assists). */
  damageLog: Map<string, Map<string, number>>;
  /** Recent kills for trade detection. */
  recentKills: { t: number; killerId: string; victimId: string }[];
  ended: boolean;
  plan: AttackPlan | null;
  defense: DefenseState | null;
  isLastRoundOfHalf: boolean;
  isMatchPointFor: [boolean, boolean];
  /** Last situation each team evaluated a save for (see save.ts). */
  saveCheck: [string, string];
}

export type PlanKind = 'execute' | 'rush' | 'default' | 'split';

export interface AttackPlan {
  kind: PlanKind;
  site: SiteId;
  /** Per attacker: route id they use. */
  routeOf: Map<string, string>;
  lurkerId: string | null;
  /** Earliest time the team commits into the site. */
  executeAt: number;
  phase: 'setup' | 'execute' | 'postplant' | 'retreat';
  utilityThrown: boolean;
  /** For defaults: when the IGL makes the late call. */
  callAt: number;
  entryOrder: string[];
  postPlantOf: Map<string, string>;
  description: string;
  /** Max defenders the attackers had seen around each site during setup. */
  earlySeen: Record<SiteId, number>;
}

export interface DefenseState {
  /** Base position assigned to each defender. */
  baseOf: Map<string, string>;
  /** Which area each defender covers: 'A' | 'B' | 'mid'. */
  areaOf: Map<string, SiteId | 'mid'>;
  rotatedTo: SiteId | null;
  rotateCalledAt: number;
  retake: { site: SiteId; pushAt: number; pushing: boolean } | null;
  infoUntil: number;
  delayThrown: Set<string>;
}

export function emit(m: MapCtx, e: MatchEventInput): void {
  m.events.push({ ...e, seq: m.seq++, roundIndex: m.roundIndex } as MatchEvent);
}

export const alive = (ctx: RoundCtx, side: Side): Agent[] => ctx.agents.filter((a) => a.alive && a.side === side);
