/**
 * Save codec: turns live game state (Maps, Sets, seeded generators) into plain JSON and back.
 * Functions (the ecosystem's resolver) are dropped and re-attached by the loader.
 * Tags are `$map`, `$set` and `$rng`; no other object may use those keys.
 */
import { Rng, type RngState } from '../rng/prng';

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

export function encode(value: unknown): Json {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`Cannot save a non-finite number (${value})`);
    return value;
  }
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'function') return null;
  if (value instanceof Rng) return { $rng: value.getState() as unknown as Json };
  if (value instanceof Map) return { $map: [...value.entries()].map(([k, v]) => [encode(k), encode(v)]) };
  if (value instanceof Set) return { $set: [...value.values()].map(encode) };
  if (Array.isArray(value)) return value.map(encode);
  const out: { [k: string]: Json } = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined || typeof v === 'function') continue;
    out[k] = encode(v);
  }
  return out;
}

export function decode(json: Json): unknown {
  if (json === null || typeof json !== 'object') return json;
  if (Array.isArray(json)) return json.map(decode);
  if ('$map' in json) return new Map((json.$map as Json[][]).map(([k, v]) => [decode(k!), decode(v!)]));
  if ('$set' in json) return new Set((json.$set as Json[]).map(decode));
  if ('$rng' in json) return Rng.fromState(json.$rng as unknown as RngState);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(json)) out[k] = decode(v);
  return out;
}

export const toJson = (value: unknown): string => JSON.stringify(encode(value));
export const fromJson = (text: string): unknown => decode(JSON.parse(text) as Json);
