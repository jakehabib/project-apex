/// <reference lib="webworker" />
/**
 * Career worker: holds the live career (world, ecosystem, the club's series), plays the club's maps
 * round by round with the manager's calls, and saves to IndexedDB. Everything here runs the same
 * deterministic core as the tests; the worker only adds persistence and messaging.
 */
import { act, type CareerAction } from '../../core/career/actions';
import { advance, CAREER_VERSION, createCareer, loadCareer, nextMapInput, pendingSeries, recordMap, registerSimulator, saveCareer, summarize, autoPlay, type Career } from '../../core/career/career';
import { careerView } from '../../core/career/views';
import { MapSimulation, simulateMap, type Stance } from '../../core/match/engine/match';
import type { MapSimInput } from '../../core/match/engine/types';
import { mapById } from '../../core/match/maps';
import { MR12_STANDARD } from '../../core/match/rules/ruleset';
import { buildRecap } from '../../core/match/stats/recap';
import { teamStrength } from '../../core/world/evolution';
import { generateWorld } from '../../core/world/generate';
import { toOvr } from '../../core/world/ratings';
import { REGION_NAMES, type World } from '../../core/world/types';
import world from '../../shared/art/world.json';
import { deleteSave, exportSave, gunzip, listSaves, readSave, writeSave } from '../career/saves';
import type { MatchSetupInfo } from './match.worker';

registerSimulator(simulateMap);

export type CareerRequest =
  | { id: number; kind: 'teams'; seed: string }
  | { id: number; kind: 'create'; seed: string; orgId: string; slot: string }
  | { id: number; kind: 'saves' }
  | { id: number; kind: 'load'; slot: string }
  | { id: number; kind: 'delete'; slot: string }
  | { id: number; kind: 'save' }
  | { id: number; kind: 'view' }
  | { id: number; kind: 'advance'; days: number; untilEvent: boolean }
  | { id: number; kind: 'act'; action: CareerAction }
  | { id: number; kind: 'mapStart' }
  | { id: number; kind: 'step' }
  | { id: number; kind: 'instruct'; stance: Stance }
  | { id: number; kind: 'finish' }
  | { id: number; kind: 'mapEnd' }
  | { id: number; kind: 'simSeries' }
  | { id: number; kind: 'rewatch'; seriesId: string; mapIndex: number }
  | { id: number; kind: 'export' }
  | { id: number; kind: 'import'; data: Blob; slot: string };

export interface TeamPick {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly region: string;
  readonly archetype: string;
  readonly ovr: number;
  readonly money: number;
  readonly featured: boolean;
  readonly expectation: string;
  readonly stars: readonly string[];
}

const ARCHETYPES: Record<string, 'elite' | 'contender' | 'developing'> = {
  northwind: 'elite', hollowcrown: 'elite', redkite: 'contender', ironvale: 'contender', sunline: 'contender', obsidiantide: 'contender', polararc: 'developing', atlasunion: 'developing',
};
const EXPECT: Record<string, string> = {
  elite: 'Win titles. The board expects trophies.',
  contender: 'Reach Tier 1 playoffs and push for silverware.',
  developing: 'Climb the rankings and earn Tier 1 invitations.',
  grassroots: 'Survive, develop talent and grow the club.',
};

const newWorld = (seed: string): World => generateWorld({ seed, featured: { teams: world.teams.map((t) => ({ ...t, archetype: ARCHETYPES[t.id] })), players: world.players, coaches: world.coaches } });

let career: Career | null = null;
let slot = '';
let preview: { seed: string; world: World } | null = null;
let live: { input: MapSimInput; sim: MapSimulation; sent: number; watched: boolean; recorded: boolean } | null = null;

const need = (): Career => {
  if (!career) throw new Error('No career loaded');
  return career;
};

async function persist(): Promise<void> {
  const c = need();
  await writeSave(slot, saveCareer(c), summarize(c), CAREER_VERSION, Date.now());
}

function infoFor(input: MapSimInput, c: Career): MatchSetupInfo {
  const w = c.eco.world;
  return {
    players: input.teams.flatMap((t, ti) => t.players.map((p) => {
      const wp = w.players.get(p.id);
      return { id: p.id, name: p.name, fullName: wp?.name ?? p.name, team: ti, role: wp?.role ?? '', ovr: wp ? toOvr(wp.skill) : 0 };
    })),
    teamNames: [input.teams[0].name, input.teams[1].name], teamIds: [input.teams[0].id, input.teams[1].id], mapId: input.map.id,
  };
}

function fresh() {
  const l = live!;
  const ev = l.sim.events.slice(l.sent);
  l.sent = l.sim.events.length;
  return ev;
}

/** Records the live map once it is finished (idempotent). Autosaves when the series is decided. */
async function recordLive(): Promise<void> {
  const l = live!;
  if (l.recorded) return;
  const c = need();
  const s = pendingSeries(c)!;
  recordMap(c, s, l.input, l.sim.result(), l.sim.instructionLog, l.watched);
  l.recorded = true;
  if (s.outcome) await persist();
}

async function handle(m: CareerRequest): Promise<Record<string, unknown>> {
  switch (m.kind) {
    case 'teams': {
      if (preview?.seed !== m.seed) preview = { seed: m.seed, world: newWorld(m.seed) };
      const w = preview.world;
      const teams: TeamPick[] = [...w.orgs.values()].map((o) => {
        const roster = o.roster.map((id) => w.players.get(id)!).sort((a, b) => b.skill - a.skill);
        return {
          id: o.id, name: o.name, tag: o.tag, region: REGION_NAMES[o.homeRegion], archetype: o.archetype, ovr: toOvr(teamStrength(w, o)), money: o.money, featured: o.id in ARCHETYPES,
          expectation: EXPECT[o.archetype]!, stars: roster.slice(0, 2).map((p) => `${p.nickname} (${toOvr(p.skill)})`),
        };
      }).sort((a, b) => Number(b.featured) - Number(a.featured) || b.ovr - a.ovr);
      return { teams };
    }
    case 'create': {
      const w = preview?.seed === m.seed ? preview.world : newWorld(m.seed);
      preview = null;
      career = createCareer({ seed: m.seed, world: w, orgId: m.orgId });
      slot = m.slot;
      live = null;
      await persist();
      return { view: careerView(career) };
    }
    case 'saves':
      return { saves: await listSaves() };
    case 'load': {
      const r = await readSave(m.slot);
      career = loadCareer(r.text);
      slot = m.slot;
      live = null;
      return { view: careerView(career), restoredFromBackup: r.restoredFromBackup };
    }
    case 'delete':
      await deleteSave(m.slot);
      if (slot === m.slot) {
        career = null;
        slot = '';
      }
      return { saves: await listSaves() };
    case 'save':
      await persist();
      return {};
    case 'view':
      return { view: careerView(need()) };
    case 'advance': {
      const c = need();
      const r = advance(c, m.days, { untilEvent: m.untilEvent });
      await persist();
      return { result: r, view: careerView(c) };
    }
    case 'act': {
      const c = need();
      const result = act(c, m.action);
      if (result.ok) await persist();
      return { result, view: careerView(c) };
    }
    case 'mapStart': {
      const c = need();
      const s = pendingSeries(c);
      if (!s) throw new Error('No match is waiting');
      const input = nextMapInput(c, s);
      live = { input, sim: new MapSimulation(input), sent: 0, watched: true, recorded: false };
      return { info: infoFor(input, c), events: fresh(), mapIndex: input.mapIndex };
    }
    case 'step': {
      const l = live!;
      l.sim.step();
      return { step: { events: fresh(), done: l.sim.done, scores: l.sim.scores, nextRound: l.sim.nextRound } };
    }
    case 'instruct':
      live!.sim.instruct(0, m.stance);
      return {};
    case 'finish': {
      const l = live!;
      l.sim.result();
      return { step: { events: fresh(), done: true, scores: l.sim.scores, nextRound: l.sim.nextRound } };
    }
    case 'mapEnd': {
      const l = live!;
      const c = need();
      const result = l.sim.result();
      const info = infoFor(l.input, c);
      const names = new Map(info.players.map((p) => [p.id, p.name]));
      await recordLive();
      const recap = buildRecap(result.events, info.teamNames, (id) => names.get(id) ?? id);
      return { recap, info, view: careerView(c) };
    }
    case 'simSeries': {
      const c = need();
      const s = pendingSeries(c);
      if (!s) throw new Error('No match is waiting');
      if (live && !live.recorded && live.input.matchId === s.id && live.input.mapIndex === s.played.length) {
        live.watched = false;
        await recordLive();
      }
      live = null;
      autoPlay(c, s.id);
      await persist();
      return { view: careerView(c) };
    }
    case 'rewatch': {
      const c = need();
      const s = c.series.get(m.seriesId);
      const pm = s?.played[m.mapIndex];
      if (!s || !pm) throw new Error('Map not found');
      const input: MapSimInput = { matchId: s.id, mapIndex: m.mapIndex, seed: pm.seed, map: mapById(pm.mapId), ruleset: MR12_STANDARD, teams: pm.teams as MapSimInput['teams'], firstAttacker: pm.firstAttacker, instructions: pm.instructions };
      const result = simulateMap(input);
      const info = infoFor(input, c);
      const names = new Map(info.players.map((p) => [p.id, p.name]));
      return { info, events: result.events, recap: buildRecap(result.events, info.teamNames, (id) => names.get(id) ?? id), rounds: result.rounds.length };
    }
    case 'export':
      return { blob: await exportSave(slot) };
    case 'import': {
      const text = await gunzip(m.data);
      const c = loadCareer(text);
      await writeSave(m.slot, text, summarize(c), CAREER_VERSION, Date.now());
      return { saves: await listSaves() };
    }
  }
}

let queue: Promise<unknown> = Promise.resolve();
self.onmessage = (e: MessageEvent<CareerRequest>) => {
  const m = e.data;
  // One request at a time: saves and simulation never interleave.
  queue = queue.then(async () => {
    try {
      self.postMessage({ id: m.id, ok: true, ...(await handle(m)) });
    } catch (err) {
      self.postMessage({ id: m.id, ok: false, error: (err as Error).message });
    }
  });
};
