// Worker for scripts/sim-calibrate.mjs: simulates assigned maps and returns telemetry.
import { parentPort } from 'node:worker_threads';
import { emptyTelemetry, ingestMap } from '../src/core/calibration/telemetry';
import { Rng } from '../src/core/rng/prng';
import { syntheticTeam } from '../src/core/match/engine/fixtures';
import { simulateMap } from '../src/core/match/engine/match';
import { TACTICS_PRESETS } from '../src/core/match/engine/tactics';
import { MAP_POOL } from '../src/core/match/maps';
import { MR12_STANDARD } from '../src/core/match/rules/ruleset';
import { checkInvariants } from '../src/core/match/stats/invariants';

parentPort!.on('message', (job: { from: number; to: number; seedBase: string; check: number } | null) => {
  if (!job) process.exit(0);
  const t = emptyTelemetry();
  let violations = 0;
  for (let i = job.from; i < job.to; i++) {
    // Representative pro-like population: strengths around 62, matched within a few points.
    const rng = Rng.fromSeed(`${job.seedBase}:pop:${i}`);
    const base = Math.max(45, Math.min(80, rng.normal(62, 6)));
    const gap = rng.normal(0, 2.5);
    const presetA = rng.pick(TACTICS_PRESETS).id;
    const presetB = rng.pick(TACTICS_PRESETS).id;
    const map = MAP_POOL[i % MAP_POOL.length]!;
    const r = simulateMap({
      matchId: `cal-${i}`, mapIndex: 0, seed: `${job.seedBase}:${i}`, map, ruleset: MR12_STANDARD,
      teams: [syntheticTeam('ca', base + gap / 2, `${job.seedBase}:a:${i}`, presetA), syntheticTeam('cb', base - gap / 2, `${job.seedBase}:b:${i}`, presetB)],
      firstAttacker: (i % 2) as 0 | 1,
    });
    ingestMap(t, r.events);
    if (job.check > 0 && i % job.check === 0 && checkInvariants(r.events, map, MR12_STANDARD).length > 0) violations++;
  }
  parentPort!.postMessage({ t, violations });
});
