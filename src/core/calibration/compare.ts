/** Compares measured telemetry with the benchmark set and classifies each metric. */
import { GLOBAL_BENCHMARKS, MAP_CT_TARGETS, STATE_HYPOTHESES, type Benchmark } from './benchmarks';
import { wilson, type Ratio, type Telemetry } from './telemetry';

export type Status = 'ok' | 'watch' | 'deviation' | 'insufficient' | 'hypothesis-in' | 'hypothesis-out';

export interface ComparisonRow {
  readonly benchmark: Benchmark;
  readonly value: number;
  readonly lo: number;
  readonly hi: number;
  readonly n: number;
  readonly d: number;
  readonly status: Status;
}

const MIN_SAMPLE = 30;

function source(t: Telemetry, id: string): Ratio | undefined {
  const map: Record<string, Ratio | undefined> = {
    opening_kill_conversion: t.openingConversion,
    plant_frequency: t.plantRate,
    ct_win_after_plant: t.ctWinAfterPlant,
    pistol_ct_win: t.pistolCtWin,
    eco_vs_full: t.buyMatchups['eco>full'],
    force_vs_full: t.buyMatchups['force>full'],
    overtime_maps: t.overtime,
    retake_full_vs_full: t.retakeByTier['full>full'],
    retake_full_vs_force: t.retakeByTier['full>force'],
    retake_full_vs_eco: t.retakeByTier['full>eco'],
    retake_eco_vs_full: t.retakeByTier['eco>full'],
    retake_all_five_t_die: t.retakeAllFiveDead,
    lead_7_5_converts: t.halftime['7-5'],
    lead_8_4_converts: t.halftime['8-4'],
    lead_9_3_converts: t.halftime['9-3'],
  };
  if (id in map) return map[id];
  const mapTarget = Object.entries(MAP_CT_TARGETS).find(([, b]) => b.id === id);
  if (mapTarget) return t.byMap[mapTarget[0]]?.ctRoundWins;
  if (id.startsWith('state_')) return t.states[id.slice(6)];
  if (id.startsWith('solo_')) return t.clutches[id.slice(5)];
  return undefined;
}

export function compare(t: Telemetry): ComparisonRow[] {
  const all = [...Object.values(MAP_CT_TARGETS), ...GLOBAL_BENCHMARKS, ...STATE_HYPOTHESES];
  return all.map((b) => {
    const x = source(t, b.id) ?? { n: 0, d: 0 };
    const w = wilson(x);
    let status: Status;
    if (x.d < MIN_SAMPLE) status = 'insufficient';
    else if (b.provenance === 'hypothesis') {
      const [lo, hi] = b.soft ?? [b.target - b.tolerance, b.target + b.tolerance];
      status = w.pct >= lo && w.pct <= hi ? 'hypothesis-in' : 'hypothesis-out';
    } else {
      const lo = b.target - b.tolerance;
      const hi = b.target + b.tolerance;
      if (w.pct >= lo && w.pct <= hi) status = 'ok';
      else if (w.hi < lo || w.lo > hi) status = 'deviation';
      else status = 'watch';
    }
    return { benchmark: b, value: w.pct, lo: w.lo, hi: w.hi, n: x.n, d: x.d, status };
  });
}
