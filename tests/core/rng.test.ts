import { describe, expect, it } from 'vitest';
import { RNG_ALGORITHM_VERSION, Rng } from '../../src/core/rng/prng';

describe('Rng', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = Rng.fromSeed('apex');
    const b = Rng.fromSeed('apex');
    for (let i = 0; i < 1000; i++) expect(a.nextUint32()).toBe(b.nextUint32());
  });

  it('produces different sequences for different seeds', () => {
    const a = Rng.fromSeed('apex-1');
    const b = Rng.fromSeed('apex-2');
    const sa = Array.from({ length: 20 }, () => a.nextUint32());
    const sb = Array.from({ length: 20 }, () => b.nextUint32());
    expect(sa).not.toEqual(sb);
  });

  it('pins the algorithm output (golden values) so silent changes are caught', () => {
    const r = Rng.fromSeed('golden');
    const out = Array.from({ length: 5 }, () => r.nextUint32());
    expect(RNG_ALGORITHM_VERSION).toBe('apex-rng/1');
    expect(out).toMatchSnapshot();
  });

  it('round-trips state exactly', () => {
    const a = Rng.fromSeed('state');
    for (let i = 0; i < 37; i++) a.next();
    const restored = Rng.fromState(JSON.parse(JSON.stringify(a.getState())));
    for (let i = 0; i < 100; i++) expect(restored.next()).toBe(a.next());
  });

  it('rejects state from an unknown algorithm', () => {
    const s = { ...Rng.fromSeed('x').getState(), algorithm: 'other' };
    expect(() => Rng.fromState(s as never)).toThrow(/Unsupported RNG/);
  });

  it('fork does not advance the parent and is stable', () => {
    const a = Rng.fromSeed('fork');
    const b = Rng.fromSeed('fork');
    const child1 = a.fork('combat');
    expect(a.nextUint32()).toBe(b.nextUint32());
    expect(child1.nextUint32()).toBe(Rng.fromSeed('fork').fork('combat').nextUint32());
    expect(a.fork('combat').nextUint32()).not.toBe(a.fork('economy').nextUint32());
  });

  it('int() stays within bounds and covers the range uniformly', () => {
    const r = Rng.fromSeed('uniform');
    const counts = new Array(6).fill(0) as number[];
    const n = 60000;
    for (let i = 0; i < n; i++) {
      const v = r.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      counts[v - 1]!++;
    }
    for (const c of counts) expect(Math.abs(c - n / 6)).toBeLessThan(n * 0.01);
  });

  it('next() mean and normal() moments are sane', () => {
    const r = Rng.fromSeed('moments');
    let sum = 0;
    let nsum = 0;
    let nsq = 0;
    const n = 50000;
    for (let i = 0; i < n; i++) {
      const x = r.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      sum += x;
      const z = r.normal();
      nsum += z;
      nsq += z * z;
    }
    expect(sum / n).toBeCloseTo(0.5, 2);
    expect(nsum / n).toBeCloseTo(0, 1);
    expect(nsq / n).toBeCloseTo(1, 1);
  });

  it('weighted() respects weights and rejects invalid input', () => {
    const r = Rng.fromSeed('weights');
    let hits = 0;
    for (let i = 0; i < 20000; i++) if (r.weighted(['a', 'b'], [3, 1]) === 'a') hits++;
    expect(hits / 20000).toBeCloseTo(0.75, 1);
    expect(() => r.weighted(['a'], [0])).toThrow();
    expect(() => r.weighted(['a'], [-1])).toThrow();
    expect(() => r.int(5, 1)).toThrow();
  });

  it('shuffle is a deterministic permutation', () => {
    const items = Array.from({ length: 20 }, (_, i) => i);
    const s1 = Rng.fromSeed('sh').shuffle(items);
    const s2 = Rng.fromSeed('sh').shuffle(items);
    expect(s1).toEqual(s2);
    expect([...s1].sort((a, b) => a - b)).toEqual(items);
  });
});
