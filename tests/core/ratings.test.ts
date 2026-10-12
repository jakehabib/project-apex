import { describe, expect, it } from 'vitest';
import { generateWorld } from '../../src/core/world/generate';
import { ratingTier, toOvr } from '../../src/core/world/ratings';

describe('Madden-style OVR scale', () => {
  it('is monotonic, bounded 1..99 and hits the anchor tiers', () => {
    let prev = 0;
    for (let s = 0; s <= 100; s += 0.5) {
      const o = toOvr(s);
      expect(o).toBeGreaterThanOrEqual(prev);
      expect(o).toBeGreaterThanOrEqual(1);
      expect(o).toBeLessThanOrEqual(99);
      prev = o;
    }
    expect(toOvr(75)).toBe(80);
    expect(toOvr(95)).toBe(99);
    expect(ratingTier(99)).toBe('Generational');
    expect(ratingTier(82)).toBe('Tier 1');
  });
  it('every generated world has generational talents and a believable spread', () => {
    const w = generateWorld({ seed: 'ovr' });
    const ovr = [...w.players.values()].map((p) => toOvr(p.skill));
    expect(ovr.filter((o) => o >= 99).length).toBeGreaterThanOrEqual(2);
    const elite = ovr.filter((o) => o >= 90).length;
    expect(elite).toBeGreaterThan(5);
    expect(elite).toBeLessThan(60);
    const sorted = [...ovr].sort((a, b) => a - b);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeGreaterThan(55);
    expect(sorted[Math.floor(sorted.length / 2)]).toBeLessThan(78);
  });
});
