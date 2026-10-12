import { cyrb128 } from '../rng/prng';

/** JSON serialization with sorted object keys, so equal data always yields equal text. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(v as Record<string, unknown>).sort()) sorted[key] = (v as Record<string, unknown>)[key];
      return sorted;
    }
    return v;
  });
}

/** 128-bit content fingerprint (hex). Not cryptographic; used for determinism checks. */
export function fingerprint(value: unknown): string {
  return cyrb128(canonicalJson(value))
    .map((w) => w.toString(16).padStart(8, '0'))
    .join('');
}
