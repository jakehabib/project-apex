/**
 * Squad coordination: groups of players that move, hold and hit together.
 *
 * - A squad moves as a file with trade spacing. The entry leads, and each follower waits until the
 *   player ahead has opened a trade gap; nobody runs past an entry who stopped to fight.
 * - At a destination, members take distinct slots (no stacking). The leader takes the forward slot.
 * - Roles inside a squad: entry, trade, support, AWP/rear and bomb carrier, ordered so the carrier
 *   never leads and the AWPer comes last.
 */
import { node } from '../../maps/nav';
import { dist, type Vec2 } from '../../maps/types';
import { emit, type Agent, type RoundCtx } from '../state';
import { assign, gotoTask } from '../tasks';
import { pressure } from './beliefs';
import { slotsAround } from './tactical';

export type SquadJob = 'main' | 'second' | 'lurk' | 'control' | 'fake' | 'anchor' | 'rotate' | 'retake' | 'info' | 'postplant';

export interface Squad {
  readonly id: string;
  readonly job: SquadJob;
  members: string[];
  /** Site route this squad uses (attackers). */
  route: string | null;
}

/** Trade spacing between players in a file (map units: about 7 m). */
export const TRADE_GAP = 140;

export const squadAlive = (ctx: RoundCtx, sq: Squad): Agent[] => sq.members.map((id) => ctx.byId.get(id)!).filter((a) => a.alive);

/** Entry order: entries lead, then the star (trade), supports and IGL; the AWPer last; the bomb carrier never first. */
export function entryOrder(agents: readonly Agent[]): Agent[] {
  const rank = (a: Agent) => {
    const r = a.roles[0];
    return (r === 'entry' ? 0 : r === 'star' ? 1 : r === 'support' ? 2 : r === 'lurker' ? 3 : r === 'igl' ? 3.5 : r === 'anchor' ? 4 : 6) + (a.bomb ? 1.5 : 0);
  };
  return [...agents].sort((x, y) => rank(x) - rank(y) || (x.id < y.id ? -1 : 1));
}

export function roleName(i: number, a: Agent): string {
  if (a.bomb) return 'bomb';
  if (a.roles[0] === 'awper') return 'awp';
  return i === 0 ? 'entry' : i === 1 ? 'trade' : 'support';
}

export interface MoveOpts {
  readonly reason: string;
  /** What the squad watches when it arrives. */
  readonly watch?: Vec2;
  /** Pass through this node first (an entry choke). */
  readonly via?: string;
  readonly walk?: boolean;
  /** Start walking within this distance of this point (silent approach). */
  readonly quietNear?: Vec2;
  /** Danger angles to check on the way. */
  readonly checks?: readonly Vec2[];
  /** Per-member final targets instead of slots around `dest` (e.g. different clear spots on a site). */
  readonly targets?: readonly string[];
  readonly gap?: number;
  readonly notBefore?: number;
}

/**
 * Sends a squad to `dest` as a spaced file. Members are ordered for entry; each follower trails the
 * player ahead by the trade gap and ends on its own slot.
 */
export function moveSquad(ctx: RoundCtx, sq: Squad, dest: string, opts: MoveOpts): void {
  const members = entryOrder(squadAlive(ctx, sq));
  if (members.length === 0) return;
  const slots = opts.targets ?? slotsAround(ctx, dest, members.length, opts.watch);
  const gap = opts.gap ?? TRADE_GAP;
  members.forEach((a, i) => {
    const target = slots[i % slots.length]!;
    assign(
      ctx,
      a,
      gotoTask(target, opts.reason, {
        ...(opts.watch ? { watch: opts.watch } : {}),
        ...(opts.via ? { via: opts.via } : {}),
        ...(opts.walk ? { walk: true } : {}),
        ...(opts.quietNear ? { quietNear: opts.quietNear } : {}),
        ...(opts.checks ? { checks: opts.checks } : {}),
        ...(opts.notBefore !== undefined ? { notBefore: opts.notBefore } : {}),
        ...(i > 0 ? { follow: { id: members[i - 1]!.id, gap } } : {}),
        squad: sq.id,
        role: roleName(i, a),
      }),
    );
  });
  sq.members = members.map((a) => a.id).concat(sq.members.filter((id) => !members.some((m) => m.id === id)));
}

/** All living members have arrived (holding) or are stopped within reach of their target. */
export function squadArrived(ctx: RoundCtx, sq: Squad): boolean {
  return squadAlive(ctx, sq).every((a) => a.task.kind === 'hold' || (a.task.kind === 'goto' && !a.motion && a.path.length === 0 && dist(a.pos, node(ctx.m.nav, a.task.node).pos) < 60));
}

/** Snapshot of a team's AI state for the developer overlay and tests. */
export function aiEvent(ctx: RoundCtx, team: number, plan: string, phase: string, note: string): void {
  const assignList = ctx.agents
    .filter((a) => a.alive && a.team === team)
    .map((a) => {
      const t = a.task;
      const dest = t.kind === 'goto' || t.kind === 'hold' || t.kind === 'plant' || t.kind === 'save' ? node(ctx.m.nav, t.node).pos : ctx.bomb.planted && t.kind === 'defuse' ? ctx.bomb.planted.pos : null;
      const squad = t.kind === 'goto' || t.kind === 'hold' ? t.squad ?? '' : '';
      const role = t.kind === 'goto' || t.kind === 'hold' ? t.role ?? '' : t.kind;
      const why = t.kind === 'goto' || t.kind === 'hold' ? t.reason : t.kind;
      return { playerId: a.id, squad, role, dest, why };
    });
  const p = (area: 'A' | 'mid' | 'B') => Math.round(pressure(ctx, team, area).value * 100) / 100;
  emit(ctx.m, { type: 'ai', tMs: ctx.t, team, plan, phase, note, assign: assignList, pressure: [{ area: 'A', value: p('A') }, { area: 'mid', value: p('mid') }, { area: 'B', value: p('B') }] });
}
