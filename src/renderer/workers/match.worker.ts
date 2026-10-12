/// <reference lib="webworker" />
/**
 * Match day worker: one live map at a time, played round by round with the
 * manager's stance calls as recorded inputs (same engine as instant sim).
 */
import type { MatchEvent } from '../../core/match/events';
import { MapSimulation, type Stance } from '../../core/match/engine/match';
import { MAP_POOL, mapById } from '../../core/match/maps';
import { MR12_STANDARD } from '../../core/match/rules/ruleset';
import { buildRecap, type MapRecap } from '../../core/match/stats/recap';
import { generateWorld } from '../../core/world/generate';
import { teamSetupFor } from '../../core/world/teamSetup';
import type { World } from '../../core/world/types';
import world from '../../shared/art/world.json';

export interface MatchPlayer {
  readonly id: string;
  readonly name: string;
  readonly fullName: string;
  readonly team: number;
  readonly role: string;
}
export interface MatchSetupInfo {
  readonly players: MatchPlayer[];
  readonly teamNames: [string, string];
  readonly teamIds: [string, string];
  readonly mapId: string;
}
export interface StepResult {
  readonly events: MatchEvent[];
  readonly done: boolean;
  readonly scores: [number, number];
  readonly nextRound: number;
}

export type MatchRequest =
  | { id: number; kind: 'teams' }
  | { id: number; kind: 'setup'; homeId: string; awayId: string; mapId: string; seed: string }
  | { id: number; kind: 'step' }
  | { id: number; kind: 'instruct'; team: 0 | 1; stance: Stance }
  | { id: number; kind: 'finish' }
  | { id: number; kind: 'recap' };

const ARCH: Record<string, 'elite' | 'contender' | 'developing'> = { northwind: 'elite', hollowcrown: 'elite', redkite: 'contender', ironvale: 'contender', sunline: 'contender', obsidiantide: 'contender', polararc: 'developing', atlasunion: 'developing' };
let w: World | null = null;
let sim: MapSimulation | null = null;
let sent = 0;
let info: MatchSetupInfo | null = null;

const getWorld = () =>
  (w ??= generateWorld({ seed: 'apex-world-1', featured: { teams: world.teams.map((t) => ({ ...t, archetype: ARCH[t.id] })), players: world.players, coaches: world.coaches } }));

function fresh(): MatchEvent[] {
  const ev = sim!.events.slice(sent) as MatchEvent[];
  sent = sim!.events.length;
  return ev;
}

self.onmessage = (e: MessageEvent<MatchRequest>) => {
  const m = e.data;
  try {
    if (m.kind === 'teams') {
      const wd = getWorld();
      const teams = world.teams.map((t) => ({ id: t.id, name: t.name, strength: Math.round(wd.orgs.get(t.id)!.roster.reduce((s, id) => s + wd.players.get(id)!.skill, 0) / 5) }));
      self.postMessage({ id: m.id, ok: true, teams, maps: MAP_POOL.map((x) => ({ id: x.id, name: x.name })) });
    } else if (m.kind === 'setup') {
      const wd = getWorld();
      const ids = MAP_POOL.map((x) => x.id);
      const home = wd.orgs.get(m.homeId)!;
      const away = wd.orgs.get(m.awayId)!;
      const teams = [teamSetupFor(wd, home, ids), teamSetupFor(wd, away, ids)] as const;
      sim = new MapSimulation({ matchId: `md-${m.seed}`, mapIndex: 0, seed: m.seed, map: mapById(m.mapId), ruleset: MR12_STANDARD, teams, firstAttacker: 0 });
      sent = 0;
      info = {
        players: [home, away].flatMap((o, ti) => o.roster.map((pid) => {
          const p = wd.players.get(pid)!;
          return { id: p.id, name: p.nickname, fullName: p.name, team: ti, role: p.role };
        })),
        teamNames: [home.name, away.name], teamIds: [home.id, away.id], mapId: m.mapId,
      };
      self.postMessage({ id: m.id, ok: true, info, events: fresh() });
    } else if (m.kind === 'step') {
      sim!.step();
      self.postMessage({ id: m.id, ok: true, step: { events: fresh(), done: sim!.done, scores: sim!.scores, nextRound: sim!.nextRound } satisfies StepResult });
    } else if (m.kind === 'instruct') {
      sim!.instruct(m.team, m.stance);
      self.postMessage({ id: m.id, ok: true });
    } else if (m.kind === 'finish') {
      sim!.result();
      self.postMessage({ id: m.id, ok: true, step: { events: fresh(), done: true, scores: sim!.scores, nextRound: sim!.nextRound } satisfies StepResult });
    } else {
      const r = sim!.result();
      const names = new Map(info!.players.map((p) => [p.id, p.name]));
      const recap: MapRecap = buildRecap(r.events, info!.teamNames, (id) => names.get(id) ?? id);
      self.postMessage({ id: m.id, ok: true, recap, events: fresh() });
    }
  } catch (err) {
    self.postMessage({ id: m.id, ok: false, error: (err as Error).message });
  }
};
