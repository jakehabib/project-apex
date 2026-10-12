import type { Stance } from '../../core/match/engine/match';
import type { MatchEvent } from '../../core/match/events';
import type { MapRecap } from '../../core/match/stats/recap';
import type { MatchRequest, MatchSetupInfo, StepResult } from './match.worker';

type Body<T> = T extends unknown ? Omit<T, 'id'> : never;
type Reply = { id: number; ok: true; [k: string]: unknown } | { id: number; ok: false; error: string };

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, (r: Reply) => void>();

function call<T>(msg: Body<MatchRequest>): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./match.worker.ts', import.meta.url), { type: 'module', name: 'apex-match' });
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

export interface TeamOption {
  readonly id: string;
  readonly name: string;
  readonly strength: number;
}
export const listTeams = () => call<{ teams: TeamOption[]; maps: { id: string; name: string }[] }>({ kind: 'teams' });
export const setupMatch = (homeId: string, awayId: string, mapId: string, seed: string) => call<{ info: MatchSetupInfo; events: MatchEvent[] }>({ kind: 'setup', homeId, awayId, mapId, seed });
export const stepRound = () => call<{ step: StepResult }>({ kind: 'step' }).then((r) => r.step);
export const instruct = (team: 0 | 1, stance: Stance) => call<unknown>({ kind: 'instruct', team, stance });
export const finishMatch = () => call<{ step: StepResult }>({ kind: 'finish' }).then((r) => r.step);
export const getRecap = () => call<{ recap: MapRecap; events: MatchEvent[] }>({ kind: 'recap' });
