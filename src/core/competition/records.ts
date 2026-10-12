/** Immutable competitive results. Ingest is idempotent by record ID; duplicates can never add points. */
import type { Day } from '../world/calendar';

export type Tier = 1 | 2 | 3 | 'championship';

export interface MapScore {
  readonly mapId: string;
  readonly a: number;
  readonly b: number;
}

export interface SeriesRecord {
  readonly id: string;
  readonly eventId: string;
  readonly stage: string;
  readonly day: Day;
  /** Exhibitions and showmatches are stored but never count toward ARP. */
  readonly ranked: boolean;
  readonly lan: boolean;
  readonly tier: Tier;
  readonly a: { readonly lineageId: string; readonly orgId: string };
  readonly b: { readonly lineageId: string; readonly orgId: string };
  readonly winner: 'a' | 'b';
  readonly maps: readonly MapScore[];
}

export interface PrizeRecord {
  readonly id: string;
  readonly eventId: string;
  readonly day: Day;
  readonly lineageId: string;
  readonly orgId: string;
  readonly amount: number;
  readonly placement: string;
}

export interface RecordStore {
  readonly series: Map<string, SeriesRecord>;
  readonly prizes: Map<string, PrizeRecord>;
}

export const createStore = (): RecordStore => ({ series: new Map(), prizes: new Map() });

function put<T extends { id: string }>(m: Map<string, T>, r: T): boolean {
  const prev = m.get(r.id);
  if (prev) {
    if (JSON.stringify(prev) !== JSON.stringify(r)) throw new Error(`conflicting record for ${r.id}`);
    return false;
  }
  m.set(r.id, r);
  return true;
}

/** Returns false if the record was already present (no effect). */
export const addSeries = (s: RecordStore, r: SeriesRecord): boolean => put(s.series, r);
export const addPrize = (s: RecordStore, r: PrizeRecord): boolean => put(s.prizes, r);
