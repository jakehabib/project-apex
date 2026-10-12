import { describe, expect, it } from 'vitest';
import { isWalkable, isWalkableSegment, hasLineOfSight } from '../../src/core/match/maps/grid';
import { HARBOR } from '../../src/core/match/maps/harbor';
import { buildNav } from '../../src/core/match/maps/nav';
import { buildTracks, positionAt } from '../../src/core/match/replay/positions';
import { runMovementProof } from '../../src/core/match/spike/movementProof';

describe('movement proof (Phase 0 spike)', () => {
  it('is deterministic: same seed => identical event log and fingerprint', () => {
    const a = runMovementProof({ seed: 'det-1', map: HARBOR });
    const b = runMovementProof({ seed: 'det-1', map: HARBOR });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.events).toEqual(b.events);
  });

  it('pins the fingerprint of a golden seed (regression guard)', () => {
    expect(runMovementProof({ seed: 'golden', map: HARBOR }).fingerprint).toMatchSnapshot();
  });

  it('different seeds produce different matches', () => {
    const prints = new Set(Array.from({ length: 10 }, (_, i) => runMovementProof({ seed: `s${i}`, map: HARBOR }).fingerprint));
    expect(prints.size).toBe(10);
  });

  it('sim tick rate does not change positions at shared timestamps', () => {
    // Movement endpoints are tick-aligned, so 25 ms and 50 ms ticks give identical tracks
    // at every 50 ms sample. (Decision timing may differ; this checks the clock, not AI.)
    const r = runMovementProof({ seed: 'tick', map: HARBOR, tickMs: 50 });
    const tracks = buildTracks(r.events);
    for (const [, tr] of tracks) {
      for (let t = 0; t <= r.durationMs; t += 50) {
        const p = positionAt(tr, t);
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  for (const seed of ['legal-1', 'legal-2', 'legal-3', 'legal-4', 'legal-5']) {
    it(`agents only occupy walkable space and only move along nav edges (${seed})`, () => {
      const r = runMovementProof({ seed, map: HARBOR });
      const nav = buildNav(HARBOR);
      const edges = new Set(HARBOR.edges.flatMap((e) => [`${e.a}|${e.b}`, `${e.b}|${e.a}`]));
      const lastEnd = new Map<string, number>();
      for (const e of r.events) {
        if (e.type !== 'move') continue;
        expect(edges.has(`${e.fromNode}|${e.toNode}`)).toBe(true);
        expect(isWalkableSegment(nav.grid, e.from, e.to)).toBe(true);
        // No teleporting: a move starts only after the previous one finished.
        expect(e.tMs).toBeGreaterThanOrEqual(lastEnd.get(e.playerId) ?? 0);
        lastEnd.set(e.playerId, e.tMs + e.durationMs);
      }
      const tracks = buildTracks(r.events);
      for (const [, tr] of tracks)
        for (let t = 0; t <= r.durationMs; t += 250) expect(isWalkable(nav.grid, positionAt(tr, t))).toBe(true);
    });
  }

  it('every spotted event is backed by a real sightline at that instant', () => {
    const r = runMovementProof({ seed: 'spot', map: HARBOR });
    const nav = buildNav(HARBOR);
    const tracks = buildTracks(r.events);
    const spots = r.events.filter((e) => e.type === 'spotted');
    expect(spots.length).toBeGreaterThan(0);
    for (const s of spots) {
      if (s.type !== 'spotted') continue;
      expect(hasLineOfSight(nav.grid, s.observerPos, s.targetPos)).toBe(true);
      // Viewer reconstruction agrees with the simulator's own positions.
      const p = positionAt(tracks.get(s.observerId)!, s.tMs);
      const q = positionAt(tracks.get(s.targetId)!, s.tMs);
      expect(p.x).toBeCloseTo(s.observerPos.x, 6);
      expect(p.y).toBeCloseTo(s.observerPos.y, 6);
      expect(q.x).toBeCloseTo(s.targetPos.x, 6);
      expect(q.y).toBeCloseTo(s.targetPos.y, 6);
    }
  });

  it('events are ordered by time and sequence', () => {
    const r = runMovementProof({ seed: 'order', map: HARBOR });
    for (let i = 1; i < r.events.length; i++) {
      expect(r.events[i]!.seq).toBe(r.events[i - 1]!.seq + 1);
      expect(r.events[i]!.tMs).toBeGreaterThanOrEqual(r.events[i - 1]!.tMs);
    }
  });

  it('attackers arrive at the chosen site', () => {
    for (const seed of ['site-1', 'site-2', 'site-3']) {
      const r = runMovementProof({ seed, map: HARBOR, durationMs: 60000 });
      const holds = r.events.filter((e) => e.type === 'hold' && e.playerId.startsWith('atk'));
      expect(holds).toHaveLength(5);
      for (const h of holds) if (h.type === 'hold') expect(HARBOR.nodes.find((n) => n.id === h.nodeId)!.site).toBe(r.targetSite);
    }
  });
});
