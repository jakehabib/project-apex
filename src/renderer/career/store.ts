import { create } from 'zustand';
import type { ActionResult, CareerAction } from '../../core/career/actions';
import type { AdvanceResult } from '../../core/career/career';
import type { CareerView } from '../../core/career/views';
import { career } from '../workers/careerClient';

export type Page = 'dashboard' | 'inbox' | 'squad' | 'market' | 'tactics' | 'schedule' | 'rankings' | 'finances' | 'results' | 'settings' | 'match' | 'replay';

interface Toast {
  readonly id: number;
  readonly text: string;
  readonly tone: 'ok' | 'bad' | 'info';
  readonly notes?: readonly string[];
}

interface CareerState {
  view: CareerView | null;
  page: Page;
  busy: string | null;
  toast: Toast | null;
  lastStop: AdvanceResult | null;
  replay: { seriesId: string; mapIndex: number; label: string } | null;
  /** Full-screen broadcast (live map or replay): the sidebar is hidden. */
  immersive: boolean;
  watch: (seriesId: string, mapIndex: number, label: string) => void;
  setView: (v: CareerView) => void;
  go: (p: Page) => void;
  say: (text: string, tone?: Toast['tone'], notes?: readonly string[]) => void;
  refresh: () => Promise<void>;
  advance: (days: number, untilEvent: boolean) => Promise<AdvanceResult | null>;
  act: (a: CareerAction) => Promise<ActionResult | null>;
}

let toastSeq = 1;
const STOP_TEXT: Record<AdvanceResult['stop'], string> = {
  match: 'Match day: your next series is ready.',
  window: 'The roster window is open.',
  invite: 'An invitation has arrived.',
  event: 'Your next event starts tomorrow.',
  limit: '',
};

export const useCareer = create<CareerState>((set, get) => ({
  view: null,
  page: 'dashboard',
  busy: null,
  toast: null,
  lastStop: null,
  replay: null,
  immersive: false,
  watch: (seriesId, mapIndex, label) => set({ replay: { seriesId, mapIndex, label }, page: 'replay' }),
  setView: (view) => set({ view }),
  go: (page) => set({ page }),
  say: (text, tone = 'info', notes) => set({ toast: { id: toastSeq++, text, tone, ...(notes ? { notes } : {}) } }),
  refresh: async () => set({ view: await career.view() }),
  advance: async (days, untilEvent) => {
    if (get().busy) return null;
    set({ busy: 'Simulating the world…' });
    try {
      const r = await career.advance(days, untilEvent);
      set({ view: r.view, lastStop: r.result, ...(r.result.stop === 'match' ? { page: 'match' as Page } : {}) });
      if (STOP_TEXT[r.result.stop]) get().say(STOP_TEXT[r.result.stop], 'info');
      return r.result;
    } catch (e) {
      get().say((e as Error).message, 'bad');
      return null;
    } finally {
      set({ busy: null });
    }
  },
  act: async (a) => {
    if (get().busy) return null;
    set({ busy: 'Working…' });
    try {
      const r = await career.act(a);
      set({ view: r.view });
      get().say(r.result.message, r.result.ok ? 'ok' : 'bad', r.result.notes);
      return r.result;
    } catch (e) {
      get().say((e as Error).message, 'bad');
      return null;
    } finally {
      set({ busy: null });
    }
  },
}));
