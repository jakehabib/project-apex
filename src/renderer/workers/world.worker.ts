/// <reference lib="webworker" />
/**
 * Keeps the living world (organisations, rankings, calendar) off the UI thread.
 * PREVIEW: until career mode exists, background series are decided by the
 * validation resolver (see core/competition/quickResolver.ts), not the match engine.
 */
import { advanceTo, createEcosystem, type Ecosystem } from '../../core/competition/ecosystem';
import { quickResolver } from '../../core/competition/quickResolver';
import { calendarView, eventDetail, financeView, forecastView, rankingsView } from '../../core/competition/views';
import { dayOf } from '../../core/world/calendar';
import { generateWorld } from '../../core/world/generate';
import world from '../../shared/art/world.json';

export type WorldRequest =
  | { id: number; kind: 'init'; seed: string }
  | { id: number; kind: 'advance'; days: number }
  | { id: number; kind: 'views'; orgId: string }
  | { id: number; kind: 'event'; eventId: string; orgId: string };

const ARCHETYPES: Record<string, 'elite' | 'contender' | 'developing'> = {
  northwind: 'elite', hollowcrown: 'elite', redkite: 'contender', ironvale: 'contender', sunline: 'contender', obsidiantide: 'contender', polararc: 'developing', atlasunion: 'developing',
};

let eco: Ecosystem | null = null;

function views(orgId: string) {
  const e = eco!;
  const day = e.world.day;
  const teams = [...e.world.orgs.values()].map((o) => ({ id: o.id, name: o.name, featured: o.id in ARCHETYPES })).sort((a, b) => Number(b.featured) - Number(a.featured) || a.name.localeCompare(b.name));
  return { day, rankings: rankingsView(e), calendar: calendarView(e, orgId, day - 45, day + 150), forecast: forecastView(e, orgId), finance: financeView(e, orgId), teams };
}

self.onmessage = (ev: MessageEvent<WorldRequest>) => {
  const m = ev.data;
  try {
    const t0 = performance.now();
    if (m.kind === 'init') {
      const w = generateWorld({ seed: m.seed, featured: { teams: world.teams.map((t) => ({ ...t, archetype: ARCHETYPES[t.id] })), players: world.players, coaches: world.coaches } });
      eco = createEcosystem(w, quickResolver(w, m.seed), dayOf(0, 0, 1) - 1);
      // Simulated history: season 0 plus the first months of season 1.
      advanceTo(eco, dayOf(1, 2, 20));
      self.postMessage({ id: m.id, ok: true, ms: performance.now() - t0 });
    } else if (m.kind === 'advance') {
      advanceTo(eco!, eco!.world.day + m.days);
      self.postMessage({ id: m.id, ok: true, ms: performance.now() - t0 });
    } else if (m.kind === 'views') self.postMessage({ id: m.id, ok: true, views: views(m.orgId) });
    else self.postMessage({ id: m.id, ok: true, detail: eventDetail(eco!, m.eventId, m.orgId) });
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: (err as Error).message });
  }
};
