import type { MatchEvent, Side } from '../events';
import type { Vec2 } from '../maps/types';
import { hypot } from '../maps/types';

/**
 * Pure event-log -> position reconstruction shared by the viewer and tests.
 * The viewer never invents movement: every rendered position comes from here,
 * using the same linear formula the engine uses (movement.ts `interp`).
 */
export interface Segment {
  readonly t0: number;
  /** Planned end; `cut` truncates it when a stop arrives. */
  t1: number;
  readonly from: Vec2;
  to: Vec2;
}

export interface Track {
  readonly playerId: string;
  readonly team: number;
  readonly side: Side;
  readonly spawn: Vec2;
  readonly segments: Segment[];
  diedAt: number | null;
}

/** Tracks for one round (events filtered to that round index). */
export function buildTracks(events: readonly MatchEvent[], roundIndex = 0): Map<string, Track> {
  const tracks = new Map<string, Track>();
  for (const e of events) {
    if (e.roundIndex !== roundIndex) continue;
    if (e.type === 'spawn') {
      tracks.set(e.playerId, { playerId: e.playerId, team: e.team, side: e.side, spawn: e.pos, segments: [], diedAt: null });
    } else if (e.type === 'move') {
      const tr = tracks.get(e.playerId);
      if (!tr) throw new Error(`move before spawn for ${e.playerId}`);
      tr.segments.push({ t0: e.tMs, t1: e.tMs + e.durationMs, from: e.from, to: e.to });
    } else if (e.type === 'stop') {
      const tr = tracks.get(e.playerId);
      const last = tr?.segments[tr.segments.length - 1];
      if (last && e.tMs < last.t1) {
        last.t1 = e.tMs;
        last.to = e.pos;
      }
    } else if (e.type === 'kill') {
      const tr = tracks.get(e.victimId);
      if (tr) {
        tr.diedAt = e.tMs;
        const last = tr.segments[tr.segments.length - 1];
        if (last && e.tMs < last.t1) {
          last.t1 = e.tMs;
          last.to = e.victimPos;
        }
      }
    }
  }
  return tracks;
}

export function positionAt(track: Track, tMs: number): Vec2 {
  let pos = track.spawn;
  for (const s of track.segments) {
    if (tMs < s.t0) break;
    if (tMs >= s.t1) {
      pos = s.to;
      continue;
    }
    const k = s.t1 === s.t0 ? 1 : (tMs - s.t0) / (s.t1 - s.t0);
    return { x: s.from.x + (s.to.x - s.from.x) * k, y: s.from.y + (s.to.y - s.from.y) * k };
  }
  return pos;
}

/** Unit heading at time t (movement direction), or null while stationary. */
export function headingAt(track: Track, tMs: number): Vec2 | null {
  for (const s of track.segments) {
    if (tMs >= s.t0 && tMs < s.t1) {
      const dx = s.to.x - s.from.x;
      const dy = s.to.y - s.from.y;
      const len = hypot(dx, dy) || 1;
      return { x: dx / len, y: dy / len };
    }
  }
  return null;
}
