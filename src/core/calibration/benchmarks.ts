/**
 * Calibration benchmarks (dataset `apex-cs2-2026-10-12`, see data/calibration/).
 *
 * These are *targets for the aggregate behaviour* of the event simulation —
 * never per-round dice. Provenance is explicit:
 *   measured   — published professional aggregate (source URL kept)
 *   derived    — arithmetic on a measured figure
 *   hypothesis — design seed, NOT a researched fact; reported, never gated
 *   design     — our own target for an original map, chosen inside the measured pro range
 *
 * tests/core/calibration.test.ts checks these constants against the vendored CSV/JSON.
 */

export type Provenance = 'measured' | 'derived' | 'hypothesis' | 'design';

export interface Benchmark {
  readonly id: string;
  readonly label: string;
  /** Target rate in percent. */
  readonly target: number;
  /** Acceptable deviation in percentage points (engineering criterion, adjustable). */
  readonly tolerance: number;
  /** Soft bounds for hypotheses (percent). */
  readonly soft?: readonly [number, number];
  readonly provenance: Provenance;
  readonly source?: string;
  readonly note?: string;
}

export const DATASET_ID = 'apex-cs2-2026-10-12';

const RETAKES = 'https://esportsodds.gg/learn/cs2-retakes';
const COMEBACKS = 'https://esportsodds.gg/learn/cs2-comebacks';
const ECONOMY = 'https://esportsodds.gg/learn/cs2-economy';
const NEURO = 'https://neurostats.net/cs2/map/';

/** Published CT round-share range across the 7 pro maps in the pack (49.1–55.7%). */
export const PRO_MAP_CT_SHARE = {
  nuke: 55.7, mirage: 54.5, ancient: 52.7, cache: 52.7, inferno: 51.5, dust2: 51.1, anubis: 49.1,
} as const;

/** Original-map design targets, chosen inside the measured range. */
export const MAP_CT_TARGETS: Readonly<Record<string, Benchmark>> = {
  harbor: { id: 'ct_share_harbor', label: 'Harbor CT round share', target: 53.0, tolerance: 2.0, provenance: 'design', note: 'Original map; target inside measured pro range 49.1–55.7% (CT-leaning, Ancient/Cache-like).' },
  switchyard: { id: 'ct_share_switchyard', label: 'Switchyard CT round share', target: 51.5, tolerance: 2.0, provenance: 'design', note: 'Original map; target inside measured pro range (Inferno/Dust2-like).' },
};

export const GLOBAL_BENCHMARKS: readonly Benchmark[] = [
  { id: 'opening_kill_conversion', label: 'Round won by team with opening kill', target: 71.8, tolerance: 2.5, provenance: 'measured', source: COMEBACKS },
  { id: 'plant_frequency', label: 'Bomb planted (share of rounds)', target: 53.9, tolerance: 3.0, provenance: 'measured', source: RETAKES },
  { id: 'ct_win_after_plant', label: 'CT win after plant', target: 23.1, tolerance: 3.0, provenance: 'measured', source: RETAKES },
  { id: 'pistol_ct_win', label: 'Pistol rounds won by CT', target: 50.3, tolerance: 2.0, provenance: 'measured', source: ECONOMY },
  { id: 'eco_vs_full', label: 'Eco wins vs opponent full buy', target: 2.0, tolerance: 2.0, provenance: 'measured', source: NEURO, note: 'NeuroStats map cohort 1.7–2.3%; definitions vary, wide tolerance.' },
  { id: 'force_vs_full', label: 'Force wins vs opponent full buy', target: 22.3, tolerance: 4.0, provenance: 'measured', source: NEURO, note: 'NeuroStats map cohort 21.0–23.8%.' },
  { id: 'overtime_maps', label: 'Maps reaching overtime', target: 11.9, tolerance: 2.5, provenance: 'measured', source: COMEBACKS },
  { id: 'retake_full_vs_full', label: 'CT retake, full vs full', target: 23.9, tolerance: 4.0, provenance: 'measured', source: RETAKES },
  { id: 'retake_full_vs_force', label: 'CT retake, full vs T force', target: 36.9, tolerance: 6.0, provenance: 'measured', source: RETAKES },
  { id: 'retake_full_vs_eco', label: 'CT retake, full vs T eco', target: 59.0, tolerance: 8.0, provenance: 'measured', source: RETAKES },
  { id: 'retake_eco_vs_full', label: 'CT retake, eco vs T full', target: 3.9, tolerance: 4.0, provenance: 'measured', source: RETAKES },
  { id: 'retake_all_five_t_die', label: 'Successful retakes where all 5 T died', target: 89.5, tolerance: 5.0, provenance: 'measured', source: RETAKES },
  { id: 'lead_7_5_converts', label: 'Map win when leading 7–5 at half', target: 65.8, tolerance: 6.0, provenance: 'measured', source: COMEBACKS },
  { id: 'lead_8_4_converts', label: 'Map win when leading 8–4 at half', target: 80.2, tolerance: 6.0, provenance: 'measured', source: COMEBACKS },
  { id: 'lead_9_3_converts', label: 'Map win when leading 9–3 at half', target: 90.1, tolerance: 5.0, provenance: 'measured', source: COMEBACKS },
];

/** Man-advantage conversion seeds: reported against soft bounds, never used as pass/fail gates. */
export const STATE_HYPOTHESES: readonly Benchmark[] = [
  { id: 'state_5v3', label: '5v3 → favoured team wins', target: 90, tolerance: 4, soft: [86, 94], provenance: 'hypothesis' },
  { id: 'state_5v2', label: '5v2 → favoured team wins', target: 97, tolerance: 3, soft: [94, 99], provenance: 'hypothesis' },
  { id: 'state_4v3', label: '4v3 → favoured team wins', target: 78, tolerance: 5, soft: [73, 84], provenance: 'hypothesis' },
  { id: 'state_4v2', label: '4v2 → favoured team wins', target: 90, tolerance: 5, soft: [85, 94], provenance: 'hypothesis' },
  { id: 'state_3v2', label: '3v2 → favoured team wins', target: 78, tolerance: 7, soft: [70, 85], provenance: 'hypothesis' },
  { id: 'state_2v1', label: '2v1 → favoured team wins', target: 77, tolerance: 8, soft: [68, 85], provenance: 'hypothesis' },
  { id: 'state_1v1', label: '1v1 → either side (CT share)', target: 50, tolerance: 10, soft: [40, 60], provenance: 'hypothesis', note: 'Symmetry assumption, not a pro clutch stat.' },
  { id: 'solo_1v2', label: 'Solo 1v2 clutch won', target: 22, tolerance: 7, soft: [15, 30], provenance: 'hypothesis' },
  { id: 'solo_1v3', label: 'Solo 1v3 clutch won', target: 6, tolerance: 4, soft: [3, 10], provenance: 'hypothesis' },
  { id: 'solo_1v4', label: 'Solo 1v4 clutch won', target: 1.5, tolerance: 1.5, soft: [0.5, 3], provenance: 'hypothesis' },
  { id: 'solo_1v5', label: 'Solo 1v5 clutch won', target: 0.3, tolerance: 0.7, soft: [0.05, 1], provenance: 'hypothesis' },
];
