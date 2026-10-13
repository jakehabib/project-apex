import type { ActionResult, CareerAction } from '../../core/career/actions';
import type { AdvanceResult } from '../../core/career/career';
import type { CareerView } from '../../core/career/views';
import type { Stance } from '../../core/match/engine/match';
import type { MatchEvent } from '../../core/match/events';
import type { MapRecap } from '../../core/match/stats/recap';
import type { SaveMeta } from '../career/saves';
import type { CareerRequest, TeamPick } from './career.worker';
import type { MatchSetupInfo, StepResult } from './match.worker';

export type { TeamPick };
type Body<T> = T extends unknown ? Omit<T, 'id'> : never;
type Reply = { id: number; ok: true; [k: string]: unknown } | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (r: Reply) => void>();

function call<T>(msg: Body<CareerRequest>): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./career.worker.ts', import.meta.url), { type: 'module', name: 'apex-career' });
    worker.onmessage = (e: MessageEvent<Reply>) => {
      pending.get(e.data.id)?.(e.data);
      pending.delete(e.data.id);
    };
  }
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, (r) => (r.ok ? resolve(r as unknown as T) : reject(new Error(r.error))));
    worker!.postMessage({ ...msg, id });
  });
}

export const career = {
  teams: (seed: string) => call<{ teams: TeamPick[] }>({ kind: 'teams', seed }).then((r) => r.teams),
  create: (seed: string, orgId: string, slot: string) => call<{ view: CareerView }>({ kind: 'create', seed, orgId, slot }).then((r) => r.view),
  saves: () => call<{ saves: SaveMeta[] }>({ kind: 'saves' }).then((r) => r.saves),
  load: (slot: string) => call<{ view: CareerView; restoredFromBackup: boolean }>({ kind: 'load', slot }),
  remove: (slot: string) => call<{ saves: SaveMeta[] }>({ kind: 'delete', slot }).then((r) => r.saves),
  save: () => call<unknown>({ kind: 'save' }),
  view: () => call<{ view: CareerView }>({ kind: 'view' }).then((r) => r.view),
  advance: (days: number, untilEvent: boolean) => call<{ result: AdvanceResult; view: CareerView }>({ kind: 'advance', days, untilEvent }),
  act: (action: CareerAction) => call<{ result: ActionResult; view: CareerView }>({ kind: 'act', action }),
  mapStart: () => call<{ info: MatchSetupInfo; events: MatchEvent[]; mapIndex: number }>({ kind: 'mapStart' }),
  step: () => call<{ step: StepResult }>({ kind: 'step' }).then((r) => r.step),
  instruct: (stance: Stance) => call<unknown>({ kind: 'instruct', stance }),
  finish: () => call<{ step: StepResult }>({ kind: 'finish' }).then((r) => r.step),
  mapEnd: () => call<{ recap: MapRecap; info: MatchSetupInfo; view: CareerView }>({ kind: 'mapEnd' }),
  simSeries: () => call<{ view: CareerView }>({ kind: 'simSeries' }).then((r) => r.view),
  rewatch: (seriesId: string, mapIndex: number) => call<{ info: MatchSetupInfo; events: MatchEvent[]; recap: MapRecap; rounds: number }>({ kind: 'rewatch', seriesId, mapIndex }),
  exportSave: () => call<{ blob: Blob }>({ kind: 'export' }).then((r) => r.blob),
  importSave: (data: Blob, slot: string) => call<{ saves: SaveMeta[] }>({ kind: 'import', data, slot }).then((r) => r.saves),
};
