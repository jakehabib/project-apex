/**
 * Team beliefs: what a team has actually learned about the enemy, with age and confidence.
 *
 * Sources:
 * - sightings, from perception (`team.intel`, exact when seen);
 * - footsteps (approximate, lower confidence);
 * - gunfire heard;
 * - enemy utility seen or heard landing (implies enemies near where it came from or landed);
 * - kill-feed knowledge (deaths are public).
 *
 * Directors decide from *pressure* per area, never from the other team's plan. A fake works because
 * real utility and noise raise the defenders' belief about one site.
 */
import type { UtilityKind } from '../../events';
import { hasLineOfSight } from '../../maps/grid';
import { dist, type Vec2 } from '../../maps/types';
import type { RoundCtx } from '../state';
import { areaAt, type Area } from './tactical';

export interface Cue {
  readonly pos: Vec2;
  readonly t: number;
  readonly kind: 'utility' | 'gunfire';
  readonly conf: number;
  /** Plain-English description for the debug overlay. */
  readonly what: string;
}

/** Confidence that a contact is still where it was reported. */
function contactConf(age: number, seen: boolean): number {
  if (seen) return age <= 2500 ? 1 : Math.max(0.2, 1 - (age - 2500) / 9000);
  return Math.max(0, 0.55 * (1 - age / 7000));
}

export interface Pressure {
  readonly value: number;
  /** Counts behind the value (for reasons and tests). */
  readonly seen: number;
  readonly heard: number;
  readonly cues: number;
}

/** How strongly the team believes enemies are in `area` right now. */
export function pressure(ctx: RoundCtx, team: number, area: Area, horizon = 9000): Pressure {
  const t = ctx.teams[team]!;
  let value = 0;
  let seen = 0;
  let heard = 0;
  for (const [id, e] of t.intel) {
    const enemy = ctx.byId.get(id);
    if (!enemy || !enemy.alive) continue; // deaths are public
    const age = ctx.t - e.t;
    if (age > horizon) continue;
    if (areaAt(ctx, e.pos) !== area) continue;
    value += contactConf(age, e.seen);
    if (e.seen) seen++;
    else heard++;
  }
  let cueSum = 0;
  let cues = 0;
  for (const c of t.cues) {
    const age = ctx.t - c.t;
    if (age > horizon || age < 0) continue;
    if (areaAt(ctx, c.pos) !== area) continue;
    cueSum += c.conf * (1 - age / horizon);
    cues++;
  }
  value += Math.min(2, cueSum);
  return { value, seen, heard, cues };
}

export const describePressure = (p: Pressure): string =>
  `${p.seen} seen, ${p.heard} heard${p.cues ? `, ${p.cues} utility/gunfire cue${p.cues > 1 ? 's' : ''}` : ''}`;

function addCue(ctx: RoundCtx, team: number, cue: Cue): void {
  const t = ctx.teams[team]!;
  t.cues.push(cue);
  if (t.cues.length > 40) t.cues.splice(0, t.cues.length - 40);
}

const UTILITY_CONF: Record<UtilityKind, number> = { smoke: 0.55, flash: 0.35, fire: 0.45, frag: 0.4 };

/**
 * Enemy utility landing is information: the team notes it if any living member can see the
 * landing spot or is close enough to hear it.
 */
export function noteUtility(ctx: RoundCtx, ownerTeam: number, kind: UtilityKind, at: Vec2): void {
  const other = 1 - ownerTeam;
  const witness = ctx.agents.some((a) => a.alive && a.team === other && (dist(a.pos, at) < 900 || (dist(a.pos, at) < 1800 && hasLineOfSight(ctx.m.grid, a.pos, at))));
  if (!witness) return;
  addCue(ctx, other, { pos: at, t: ctx.t, kind: 'utility', conf: UTILITY_CONF[kind], what: `enemy ${kind} at ${areaAt(ctx, at)}` });
}

const lastShotCue = new WeakMap<RoundCtx, Map<string, number>>();

/** Gunfire is heard (with an approximate position) by enemies within range, at most once a second per shooter. */
export function noteGunfire(ctx: RoundCtx, shooterId: string, at: Vec2, shooterTeam: number): void {
  let m = lastShotCue.get(ctx);
  if (!m) lastShotCue.set(ctx, (m = new Map()));
  if ((m.get(shooterId) ?? -1e9) > ctx.t - 1000) return;
  m.set(shooterId, ctx.t);
  const other = 1 - shooterTeam;
  if (!ctx.agents.some((a) => a.alive && a.team === other && dist(a.pos, at) < 1500)) return;
  const pos = { x: at.x + ctx.rng.normal(0, 60), y: at.y + ctx.rng.normal(0, 60) };
  addCue(ctx, other, { pos, t: ctx.t, kind: 'gunfire', conf: 0.6, what: `gunfire near ${areaAt(ctx, at)}` });
}
