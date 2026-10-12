import type { MatchEvent } from '../events';
import type { Vec2 } from '../maps/types';

/**
 * Pure event-log -> position reconstruction shared by the viewer and tests.
 * The viewer never invents movement: every rendered position comes from here.
 */
export interface Track {
  readonly playerId: string;
  /** Sorted keyframes: position is linearly interpolated within each segment. */
  readonly segments: readonly { t0: number; t1: number; from: Vec2; to: Vec2 }[];
  readonly spawn: Vec2;
}

export function buildTracks(events: readonly MatchEvent[]): Map<string, Track> {
  const tracks = new Map<string, { playerId: string; segments: { t0: number; t1: number; from: Vec2; to: Vec2 }[]; spawn: Vec2 }>();
  for (const e of events) {
    if (e.type === 'spawn') tracks.set(e.playerId, { playerId: e.playerId, segments: [], spawn: e.pos });
    else if (e.type === 'move') {
      const tr = tracks.get(e.playerId);
      if (!tr) throw new Error(`move before spawn for ${e.playerId}`);
      tr.segments.push({ t0: e.tMs, t1: e.tMs + e.durationMs, from: e.from, to: e.to });
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
      const len = Math.hypot(dx, dy) || 1;
      return { x: dx / len, y: dy / len };
    }
  }
  return null;
}
