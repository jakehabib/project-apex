import type { MapResult } from '../../core/match/engine/match';
import type { SimRequest } from './sim.worker';

export interface SimPlayer {
  readonly id: string;
  readonly name: string;
  readonly team: number;
  readonly role: string | undefined;
}
export interface SimResponse {
  readonly result: MapResult;
  readonly players: SimPlayer[];
  readonly teamNames: [string, string];
  readonly computeMs: number;
}
type Reply = ({ id: number; ok: true } & SimResponse) | { id: number; ok: false; error: string };

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

/** Runs the authoritative match simulation off the UI thread. */
export function simulate(seed: string, mapId: string): Promise<SimResponse> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, (r) => (r.ok ? resolve(r) : reject(new Error(r.error))));
    const req: SimRequest = { id, seed, mapId };
    getWorker().postMessage(req);
  });
}
