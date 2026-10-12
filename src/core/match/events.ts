import type { Vec2 } from './maps/types';

/**
 * Canonical match event contract. Every statistic, recap line and viewer frame
 * is derived from a stream of these events. Events are append-only and ordered
 * by `seq`; within a round `tMs` never decreases.
 *
 * Movement contract (shared with replay/positions.ts): a `move` starts a linear
 * segment from `from` to `to` lasting `durationMs`; a later `stop` truncates the
 * active segment at its own position; a `kill` freezes the victim.
 */

export type Side = 'attacker' | 'defender';
export type SiteId = 'A' | 'B';
export type RoundOutcome = 'attackers_eliminated' | 'defenders_eliminated' | 'bomb_detonated' | 'bomb_defused' | 'time_expired';
export type BuyType = 'pistol' | 'full' | 'half' | 'force' | 'eco' | 'bonus';
export type UtilityKind = 'smoke' | 'flash' | 'frag' | 'fire';

interface Base {
  readonly seq: number;
  readonly roundIndex: number;
  /** Milliseconds since the round went live (end of freeze time). Negative during freeze/buy. */
  readonly tMs: number;
}

export interface PlayerLoadout {
  readonly playerId: string;
  readonly primary: string | null;
  readonly secondary: string;
  readonly armor: number;
  readonly helmet: boolean;
  readonly kit: boolean;
  readonly utility: readonly string[];
  readonly money: number;
  readonly bomb: boolean;
}

export type MatchEvent =
  | (Base & { type: 'map_start'; mapId: string; seed: string; engineVersion: string; teams: readonly [string, string]; firstAttacker: 0 | 1 })
  | (Base & { type: 'round_start'; attackerTeam: number; scores: readonly [number, number]; buyTypes: readonly [BuyType, BuyType]; plan: string })
  | (Base & { type: 'side_switch'; reason: 'half' | 'overtime_half'; money: number })
  | (Base & { type: 'spawn'; playerId: string; team: number; side: Side; nodeId: string; pos: Vec2 })
  | (Base & { type: 'buy'; playerId: string; items: readonly string[]; spent: number; moneyAfter: number })
  | (Base & { type: 'drop'; fromPlayerId: string; toPlayerId: string; itemId: string })
  /** A round winner collects a fallen player's primary after the round (carried into the next round). */
  | (Base & { type: 'pickup'; playerId: string; fromPlayerId: string; itemId: string })
  | (Base & { type: 'loadout'; loadouts: readonly PlayerLoadout[] })
  | (Base & { type: 'move'; playerId: string; from: Vec2; to: Vec2; toNode: string; durationMs: number; walking: boolean })
  | (Base & { type: 'stop'; playerId: string; pos: Vec2 })
  | (Base & { type: 'spotted'; observerId: string; targetId: string; observerPos: Vec2; targetPos: Vec2 })
  | (Base & { type: 'utility'; playerId: string; utility: UtilityKind; from: Vec2; target: Vec2; detonateMs: number; durationMs: number })
  | (Base & { type: 'flashed'; playerId: string; byPlayerId: string; durationMs: number })
  | (Base & { type: 'damage'; attackerId: string; victimId: string; weaponId: string; amount: number; armorAfter: number; headshot: boolean; hpAfter: number; attackerPos: Vec2; victimPos: Vec2 })
  | (Base & { type: 'kill'; attackerId: string; victimId: string; weaponId: string; headshot: boolean; tradeOfPlayerId: string | null; assisterIds: readonly string[]; victimPos: Vec2 })
  | (Base & { type: 'bomb_drop'; playerId: string; pos: Vec2 })
  | (Base & { type: 'bomb_pickup'; playerId: string })
  | (Base & { type: 'plant_start'; playerId: string; site: SiteId })
  | (Base & { type: 'plant_abort'; playerId: string })
  | (Base & { type: 'plant'; playerId: string; site: SiteId; pos: Vec2 })
  | (Base & { type: 'defuse_start'; playerId: string; withKit: boolean })
  | (Base & { type: 'defuse_abort'; playerId: string })
  | (Base & { type: 'defuse'; playerId: string })
  | (Base & { type: 'detonate'; site: SiteId })
  | (Base & { type: 'call'; team: number; text: string })
  | (Base & { type: 'timeout'; team: number; reason: string })
  | (Base & { type: 'save'; playerId: string })
  | (Base & { type: 'round_end'; winnerTeam: number; reason: RoundOutcome; scores: readonly [number, number] })
  | (Base & { type: 'money'; playerId: string; delta: number; reason: 'kill' | 'round_win' | 'round_loss' | 'plant' | 'defuse' | 'plant_loss_bonus' | 'reset'; moneyAfter: number })
  | (Base & { type: 'map_end'; winnerTeam: number | null; scores: readonly [number, number] })
  | (Base & { type: 'proof_end' });

export type MatchEventType = MatchEvent['type'];
export type EventOf<T extends MatchEventType> = Extract<MatchEvent, { type: T }>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An event before the emitter assigns its sequence number and round index. */
export type MatchEventInput = DistributiveOmit<MatchEvent, 'seq' | 'roundIndex'>;
