import type { Vec2 } from './maps/types';

/**
 * Canonical match event contract. Every statistic, recap line and viewer frame
 * is derived from a stream of these events. Events are append-only and ordered
 * by (roundIndex, tMs, seq). `seq` is globally increasing within one map.
 *
 * Phase 0 emits the movement/spotting subset; the remaining variants are the
 * agreed contract for the Phase 1 round engine.
 */

export type Side = 'attacker' | 'defender';
export type RoundOutcome =
  | 'attack_elimination'
  | 'defense_elimination'
  | 'objective_detonated'
  | 'objective_defused'
  | 'time_expired';

interface Base {
  readonly seq: number;
  readonly roundIndex: number;
  /** Milliseconds since round start (freeze end = 0). */
  readonly tMs: number;
}

export type MatchEvent =
  | (Base & { type: 'map_start'; mapId: string; seed: string; engineVersion: string; teams: readonly [string, string] })
  | (Base & { type: 'round_start'; attackerTeam: string; defenderTeam: string; scores: readonly [number, number] })
  | (Base & { type: 'side_switch'; reason: 'half' | 'overtime_half' | 'overtime_start' })
  | (Base & { type: 'spawn'; playerId: string; team: string; side: Side; nodeId: string; pos: Vec2 })
  | (Base & { type: 'buy'; playerId: string; items: readonly string[]; spent: number; moneyAfter: number })
  | (Base & { type: 'drop'; fromPlayerId: string; toPlayerId: string; itemId: string })
  | (Base & { type: 'move'; playerId: string; fromNode: string; toNode: string; from: Vec2; to: Vec2; durationMs: number })
  | (Base & { type: 'hold'; playerId: string; nodeId: string; facing: Vec2 })
  | (Base & { type: 'spotted'; observerId: string; targetId: string; observerPos: Vec2; targetPos: Vec2 })
  | (Base & { type: 'utility'; playerId: string; utility: 'smoke' | 'flash' | 'frag' | 'fire'; target: Vec2; durationMs: number })
  | (Base & { type: 'damage'; attackerId: string; victimId: string; weaponId: string; amount: number; armorAbsorbed: number; headshot: boolean; hpAfter: number })
  | (Base & { type: 'kill'; attackerId: string; victimId: string; weaponId: string; headshot: boolean; tradeOfPlayerId?: string; assisterIds: readonly string[] })
  | (Base & { type: 'plant_start'; playerId: string; site: 'A' | 'B' })
  | (Base & { type: 'plant'; playerId: string; site: 'A' | 'B'; pos: Vec2 })
  | (Base & { type: 'defuse_start'; playerId: string; withKit: boolean })
  | (Base & { type: 'defuse'; playerId: string })
  | (Base & { type: 'detonate'; site: 'A' | 'B' })
  | (Base & { type: 'timeout'; team: string; policyId: string })
  | (Base & { type: 'round_end'; winnerTeam: string; reason: RoundOutcome; scores: readonly [number, number] })
  | (Base & { type: 'money'; team: string; playerId: string; delta: number; reason: string; moneyAfter: number })
  | (Base & { type: 'map_end'; winnerTeam: string | null; scores: readonly [number, number] })
  | (Base & { type: 'proof_end' });

export type MatchEventType = MatchEvent['type'];

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** An event before the emitter assigns its sequence number and round index. */
export type MatchEventInput = DistributiveOmit<MatchEvent, 'seq' | 'roundIndex'>;
