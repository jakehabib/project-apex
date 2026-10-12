import type { CalendarEntry, EventDetail, FinanceView, ForecastEntry, RankingsView } from '../../core/competition/views';
import type { WorldRequest } from './world.worker';

export interface WorldViews {
  readonly day: number;
  readonly rankings: RankingsView;
  readonly calendar: CalendarEntry[];
  readonly forecast: ForecastEntry[];
  readonly finance: FinanceView;
  readonly teams: { id: string; name: string; featured: boolean }[];
}

type Reply = { id: number; ok: true; views?: WorldViews; detail?: EventDetail; ms?: number } | { id: number; ok: false; error: string };
type Body<T> = T extends unknown ? Omit<T, 'id'> : never;

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, (r: Reply) => void>();

function call(msg: Body<WorldRequest>): Promise<Reply & { ok: true }> {
  if (!worker) {
    worker = new Worker(new URL('./world.worker.ts', import.meta.url), { type: 'module', name: 'apex-world' });
    worker.onmessage = (e: MessageEvent<Reply>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, (r) => (r.ok ? resolve(r) : reject(new Error(r.error))));
    worker!.postMessage({ ...msg, id });
  });
}

/** The world is simulated once per app session and shared by every screen. */
export function ensureWorld(): Promise<void> {
  ready ??= call({ kind: 'init', seed: 'apex-world-1' }).then(() => undefined);
  return ready;
}
export const getViews = async (orgId: string): Promise<WorldViews> => (await ensureWorld(), (await call({ kind: 'views', orgId })).views!);
export const getEvent = async (eventId: string, orgId: string): Promise<EventDetail> => (await ensureWorld(), (await call({ kind: 'event', eventId, orgId })).detail!);
export const advance = async (days: number): Promise<void> => {
  await ensureWorld();
  await call({ kind: 'advance', days });
};
