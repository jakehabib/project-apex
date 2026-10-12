/// <reference lib="webworker" />
import { HARBOR } from '../../core/match/maps/harbor';
import { runMovementProof } from '../../core/match/spike/movementProof';

export interface SimRequest {
  readonly id: number;
  readonly seed: string;
  readonly durationMs?: number;
}

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const { id, seed, durationMs } = e.data;
  const t0 = performance.now();
  try {
    const result = runMovementProof({ seed, map: HARBOR, ...(durationMs ? { durationMs } : {}) });
    self.postMessage({ id, ok: true, result, computeMs: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err as Error).message });
  }
};
