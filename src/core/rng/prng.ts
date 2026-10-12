/**
 * Deterministic pseudorandom number generation for all gameplay simulation.
 *
 * Algorithm (version `apex-rng/1`):
 *   - Seeding: cyrb128 string hash -> four 32-bit words.
 *   - Generator: sfc32 (Small Fast Counting, Chris Doty-Humphrey), 128-bit state.
 *   - Floats: 32-bit output / 2^32, range [0, 1).
 *
 * Rules:
 *   - Core gameplay must never use the platform's ambient random source; use an Rng instance.
 *   - State is plain data (`RngState`) so it can be saved, restored and forked.
 *   - `fork(label)` derives an independent child stream from the parent's seed and
 *     a label WITHOUT advancing the parent, so adding a new consumer in one
 *     subsystem does not shift the random sequence of another.
 *   - Visual/animation randomness lives in the presentation layer and never
 *     touches these streams.
 *
 * Changing anything here changes match outcomes: bump RNG_ALGORITHM_VERSION.
 */

export const RNG_ALGORITHM_VERSION = 'apex-rng/1';

export interface RngState {
  readonly algorithm: typeof RNG_ALGORITHM_VERSION;
  readonly seed: string;
  readonly words: readonly [number, number, number, number];
}

/** cyrb128 — fast, well-distributed 128-bit string hash (public domain). */
export function cyrb128(input: string): [number, number, number, number] {
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < input.length; i++) {
    const k = input.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;
  readonly seed: string;

  private constructor(seed: string, words: readonly [number, number, number, number]) {
    this.seed = seed;
    [this.a, this.b, this.c, this.d] = words;
  }

  static fromSeed(seed: string): Rng {
    const rng = new Rng(seed, cyrb128(seed));
    // Discard the first outputs; sfc32 benefits from a short warm-up.
    for (let i = 0; i < 15; i++) rng.nextUint32();
    return rng;
  }

  static fromState(state: RngState): Rng {
    if (state.algorithm !== RNG_ALGORITHM_VERSION) {
      throw new Error(`Unsupported RNG algorithm ${state.algorithm}; expected ${RNG_ALGORITHM_VERSION}`);
    }
    return new Rng(state.seed, state.words);
  }

  /** Independent child stream; does not advance this generator. */
  fork(label: string): Rng {
    return Rng.fromSeed(`${this.seed}::${label}`);
  }

  getState(): RngState {
    return { algorithm: RNG_ALGORITHM_VERSION, seed: this.seed, words: [this.a, this.b, this.c, this.d] };
  }

  nextUint32(): number {
    this.a >>>= 0;
    this.b >>>= 0;
    this.c >>>= 0;
    this.d >>>= 0;
    let t = (this.a + this.b) | 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) | 0;
    this.c = (this.c << 21) | (this.c >>> 11);
    this.d = (this.d + 1) | 0;
    t = (t + this.d) | 0;
    this.c = (this.c + t) | 0;
    return t >>> 0;
  }

  /** Uniform float in [0, 1). */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  /** Uniform integer in [min, max] inclusive, unbiased via rejection sampling. */
  int(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`Invalid int range [${min}, ${max}]`);
    }
    const span = max - min + 1;
    if (span > 4294967296) throw new RangeError('Range too large');
    const limit = 4294967296 - (4294967296 % span);
    let x = this.nextUint32();
    while (x >= limit) x = this.nextUint32();
    return min + (x % span);
  }

  chance(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new RangeError('Cannot pick from empty list');
    return items[this.int(0, items.length - 1)] as T;
  }

  /** Weighted choice; weights must be finite and non-negative with a positive sum. */
  weighted<T>(items: readonly T[], weights: readonly number[]): T {
    if (items.length !== weights.length || items.length === 0) throw new RangeError('Weighted pick size mismatch');
    let total = 0;
    for (const w of weights) {
      if (!Number.isFinite(w) || w < 0) throw new RangeError(`Invalid weight ${w}`);
      total += w;
    }
    if (total <= 0) throw new RangeError('Weights sum to zero');
    let roll = this.next() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i] as number;
      if (roll < 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** Standard normal sample (Box–Muller), scaled. */
  normal(mean = 0, stdDev = 1): number {
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  /** Deterministic Fisher–Yates shuffle returning a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [out[i], out[j]] = [out[j] as T, out[i] as T];
    }
    return out;
  }
}
