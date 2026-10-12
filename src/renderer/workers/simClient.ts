import type { ProofResult } from '../../core/match/spike/movementProof';
import type { SimRequest } from './sim.worker';

type Reply = { id: number; ok: true; result: ProofResult; computeMs: number } | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (r: Reply) => void>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./sim.worker.ts', import.meta.url), { type: 'module', name: 'apex-sim' });
    worker.onmessage = (e: MessageEvent<Reply>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
  }
  return worker;
}

/** Runs the authoritative simulation off the UI thread. */
export function simulate(seed: string, durationMs?: number): Promise<{ result: ProofResult; computeMs: number }> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, (r) => (r.ok ? resolve({ result: r.result, computeMs: r.computeMs }) : reject(new Error(r.error))));
    const req: SimRequest = { id, seed, ...(durationMs ? { durationMs } : {}) };
    getWorker().postMessage(req);
  });
}
