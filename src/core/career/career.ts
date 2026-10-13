/**
 * Career mode: one human-managed club inside the living ecosystem.
 *
 * The world advances day by day exactly as in the ecosystem tests. Series between AI clubs are
 * decided by the background resolver; every series involving the human club is played by the match
 * engine. When a tournament reaches the human club's next series, the day stops (`PendingSeries`)
 * and the career waits until each map has been played live or simulated. The event is then re-run
 * from the start with the stored results, so pairings and every later result are deterministic.
 *
 * Saved careers hold the inputs of every map the club played (team set-ups, seed, manager calls),
 * so any of them can be re-watched exactly.
 */
import { advanceTo, beginDay, compactEcosystem, createEcosystem, eventsStarting, runDayEvents, type Ecosystem } from '../competition/ecosystem';
import type { Resolver, SeriesOutcome, SeriesRequest } from '../competition/formats';
import { ACTIVE_POOL, POOL_IDS } from '../competition/mapPool';
import { quickResolver } from '../competition/quickResolver';
import type { MapScore } from '../competition/records';
import { mapsToWin, type BestOf } from '../competition/veto';
import type { ManagerInstruction, MapResult } from '../match/engine/match';
import { presetById } from '../match/engine/tactics';
import type { EconomyPolicy, MapSimInput, TeamSetup } from '../match/engine/types';
import { DEFAULT_ECONOMY_POLICY } from '../match/engine/types';
import { mapById } from '../match/maps';
import { MR12_STANDARD } from '../match/rules/ruleset';
import { buildRecap } from '../match/stats/recap';
import { Rng } from '../rng/prng';
import { dayOf, formatDate, toParts, type Day } from '../world/calendar';
import { teamSetupFor } from '../world/teamSetup';
import type { World } from '../world/types';
import { fromJson, toJson } from './codec';

export const CAREER_VERSION = 1;

/** Maps the engine can play today. Series use these until the full seven-map pool is built. */
export const PLAYABLE_MAPS: readonly string[] = ACTIVE_POOL.filter((m) => m.playable).map((m) => m.id);

export interface StatLine {
  readonly playerId: string;
  readonly name: string;
  readonly team: 0 | 1;
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly adr: number;
  readonly amr: number;
  readonly rounds: number;
}

/** One map of a career series, as played (everything needed to re-simulate it exactly). */
export interface CareerMap {
  readonly mapId: string;
  readonly seed: string;
  /** Engine team 0 is always the human club. */
  readonly teams: readonly [TeamSetup, TeamSetup];
  readonly firstAttacker: 0 | 1;
  readonly instructions: readonly ManagerInstruction[];
  /** [human club, opponent]. */
  readonly scores: readonly [number, number];
  readonly won: boolean;
  readonly lines: readonly StatLine[];
  /** Watched live (false: simulated straight to the result). */
  readonly watched: boolean;
  readonly mvpId: string | null;
}

export interface CareerSeries {
  readonly id: string;
  readonly eventId: string;
  readonly eventName: string;
  readonly stage: string;
  readonly round: string;
  readonly day: Day;
  readonly bestOf: BestOf;
  /** Whether the human club is side `a` of the series request. */
  readonly userIsA: boolean;
  readonly opponentOrgId: string;
  /** Map order decided at the series start (only the maps needed are played). */
  readonly mapOrder: readonly { readonly mapId: string; readonly pickedBy: 'user' | 'opponent' | 'decider'; readonly userAttacksFirst: boolean }[];
  readonly played: CareerMap[];
  outcome: SeriesOutcome | null;
}

export type InboxKind = 'match' | 'result' | 'invite' | 'qualifier' | 'window' | 'contract' | 'finance' | 'event' | 'welcome';

export interface InboxItem {
  readonly id: number;
  readonly day: Day;
  readonly kind: InboxKind;
  readonly title: string;
  readonly text: string;
}

export interface CareerSettings {
  /** Your series are simulated by the engine without stopping (fast-forward). */
  autoSim: boolean;
}

export interface Career {
  readonly version: number;
  readonly seed: string;
  readonly userOrgId: string;
  readonly startDay: Day;
  readonly eco: Ecosystem;
  tactics: string;
  economy: EconomyPolicy;
  settings: CareerSettings;
  readonly series: Map<string, CareerSeries>;
  /** Day whose events are still to run (a series stopped them), or null. */
  pendingDay: Day | null;
  /** The human club's series waiting to be played, or null. */
  pendingSeriesId: string | null;
  readonly inbox: InboxItem[];
  nextInboxId: number;
  /** Progress markers for inbox generation. */
  seen: { invitations: number; moves: number; results: number };
}

/** Thrown by the career resolver: the human club's series must be played before the event continues. */
export class PendingSeries extends Error {
  constructor(readonly req: SeriesRequest) {
    super(`Series ${req.seriesId} is waiting to be played`);
  }
}

// ---------------------------------------------------------------------------------------------
// Creation

export interface NewCareerOptions {
  readonly seed: string;
  readonly world: World;
  readonly orgId: string;
  /** First day under human control (default 1 January of season 1, after the winter window). */
  readonly startDay?: Day;
}

/**
 * Builds a career: the world's history up to the start day is simulated with no human club, then
 * the chosen organisation is handed to the player.
 */
export function createCareer(o: NewCareerOptions): Career {
  const startDay = o.startDay ?? dayOf(1, 0, 1);
  const eco = createEcosystem(o.world, quickResolver(o.world, o.seed), dayOf(0, 0, 1) - 1);
  advanceTo(eco, startDay);
  const org = eco.world.orgs.get(o.orgId);
  if (!org) throw new Error(`Unknown organisation ${o.orgId}`);
  org.isUser = true;
  eco.userQualifiers = new Map();
  eco.played ??= new Set();
  const career: Career = {
    version: CAREER_VERSION, seed: o.seed, userOrgId: org.id, startDay, eco, tactics: 'balanced', economy: DEFAULT_ECONOMY_POLICY,
    settings: { autoSim: false }, series: new Map(), pendingDay: null, pendingSeriesId: null, inbox: [], nextInboxId: 1,
    seen: { invitations: eco.invitations.length, moves: eco.moves.length, results: eco.results.size },
  };
  attachResolver(career);
  note(career, 'welcome', `Welcome to ${org.name}`, `The board has handed you control on ${formatDate(startDay)}. Your squad, finances and schedule are on the dashboard; the next match day will stop the calendar so you can play it.`);
  return career;
}

/** The career resolver: background series by the validation resolver, the human club's series from the engine. */
export function attachResolver(career: Career): void {
  const quick = quickResolver(career.eco.world, career.seed);
  const resolver: Resolver = (req) => {
    if (req.a.orgId !== career.userOrgId && req.b.orgId !== career.userOrgId) return quick(req);
    const s = career.series.get(req.seriesId);
    if (s?.outcome) return s.outcome;
    throw new PendingSeries(req);
  };
  career.eco.resolver = resolver;
}

// ---------------------------------------------------------------------------------------------
// Advancing

export type StopReason = 'match' | 'window' | 'invite' | 'limit' | 'event';

export interface AdvanceResult {
  readonly days: number;
  readonly stop: StopReason;
  readonly day: Day;
}

/**
 * Advances up to `maxDays` days. Stops early when the human club has a series to play, on a roster
 * window, when an invitation arrives, or (with `untilEvent`) the day before the club's next event.
 */
export function advance(career: Career, maxDays: number, opts: { untilEvent?: boolean } = {}): AdvanceResult {
  const eco = career.eco;
  let days = 0;
  let stopAfter: StopReason | null = null;
  for (;;) {
    if (career.pendingDay !== null) {
      if (career.pendingSeriesId) {
        if (!career.settings.autoSim) return { days, stop: 'match', day: eco.world.day };
        autoPlay(career, career.pendingSeriesId);
      }
      if (!finishDay(career)) continue;
      if (stopAfter) return { days, stop: stopAfter, day: eco.world.day };
    }
    if (days >= maxDays) return { days, stop: 'limit', day: eco.world.day };
    const day = eco.world.day + 1;
    const invitesBefore = eco.invitations.length;
    beginDay(eco, day);
    days++;
    career.pendingDay = day;
    const p = toParts(day);
    const invited = eco.invitations.slice(invitesBefore).some((i) => i.orgId === career.userOrgId && i.status === 'accepted');
    const window = p.dayOfMonth === 1 && (p.month === 0 || p.month === 6);
    const eventTomorrow = !!opts.untilEvent && eventsStarting(eco, day + 1).some((ev) => (eco.entries.get(ev.id) ?? []).some((en) => en.orgId === career.userOrgId));
    // The day's own events still run (and may need the club) before the stop is reported.
    stopAfter = window ? 'window' : invited ? 'invite' : eventTomorrow ? 'event' : null;
  }
}

/** Runs the pending day's events. False if they stopped on the club's series (now pending). */
function finishDay(career: Career): boolean {
  const eco = career.eco;
  try {
    runDayEvents(eco, career.pendingDay!);
  } catch (e) {
    if (!(e instanceof PendingSeries)) throw e;
    openSeries(career, e.req);
    return false;
  }
  const day = career.pendingDay!;
  career.pendingDay = null;
  collectInbox(career);
  if (toParts(day).dayOfMonth === 1) {
    compactEcosystem(eco, day, career.userOrgId);
    career.seen = { invitations: eco.invitations.length, moves: eco.moves.length, results: eco.results.size };
  }
  return true;
}

function openSeries(career: Career, req: SeriesRequest): void {
  if (!career.series.has(req.seriesId)) {
    // Series ids start with the event id (`<event>:s<stage>:<round>:...`).
    const ev = career.eco.events.get(req.seriesId.split(':')[0]!);
    const userIsA = req.a.orgId === career.userOrgId;
    const opp = userIsA ? req.b.orgId : req.a.orgId;
    const s: CareerSeries = {
      id: req.seriesId, eventId: ev?.id ?? '', eventName: ev?.name ?? 'Match', stage: req.stage, round: req.round, day: req.day, bestOf: req.bestOf,
      userIsA, opponentOrgId: opp, mapOrder: mapOrderFor(career, req, userIsA), played: [], outcome: null,
    };
    career.series.set(s.id, s);
    const oppName = career.eco.world.orgs.get(opp)?.name ?? opp;
    note(career, 'match', `Match day: vs ${oppName}`, `${s.eventName}, ${s.stage} (${s.round}), best of ${s.bestOf}. Play it live or simulate it.`, s.day);
  }
  career.pendingSeriesId = req.seriesId;
}

/**
 * Map order. Each side picks its most-practised map; the decider is drawn from the rest. Until all
 * seven maps are playable the engine pool has two maps, so longer series repeat maps (KI-17).
 */
function mapOrderFor(career: Career, req: SeriesRequest, userIsA: boolean): CareerSeries['mapOrder'] {
  const rng = Rng.fromSeed(`series:${career.seed}:${req.seriesId}`);
  const world = career.eco.world;
  const user = world.orgs.get(career.userOrgId)!;
  const opp = world.orgs.get(userIsA ? req.b.orgId : req.a.orgId)!;
  const prof = (orgId: string, m: string) => Rng.fromSeed(`pref:${orgId}:${m}`).normal(0, 1);
  const best = (orgId: string, avoid: readonly string[]) => {
    const pool = PLAYABLE_MAPS.filter((m) => !avoid.includes(m));
    return [...(pool.length ? pool : PLAYABLE_MAPS)].sort((a, b) => prof(orgId, b) - prof(orgId, a))[0]!;
  };
  const order: { mapId: string; pickedBy: 'user' | 'opponent' | 'decider'; userAttacksFirst: boolean }[] = [];
  if (req.bestOf === 1) {
    const rest = PLAYABLE_MAPS;
    order.push({ mapId: rest[rng.int(0, rest.length - 1)]!, pickedBy: 'decider', userAttacksFirst: rng.chance(0.5) });
    return order;
  }
  // The higher seed (side a) picks first.
  const firstPicker = userIsA ? 'user' : 'opponent';
  const pickers: ('user' | 'opponent')[] = [];
  for (let i = 0; i < req.bestOf - 1; i++) pickers.push(i % 2 === 0 ? firstPicker : firstPicker === 'user' ? 'opponent' : 'user');
  const used: string[] = [];
  for (const who of pickers) {
    const m = best(who === 'user' ? user.id : opp.id, used);
    used.push(m);
    // The team that did not pick the map chooses its starting side: it takes defence.
    order.push({ mapId: m, pickedBy: who, userAttacksFirst: who === 'user' });
  }
  const left = PLAYABLE_MAPS.filter((m) => !used.includes(m));
  const pool = left.length ? left : PLAYABLE_MAPS;
  order.push({ mapId: pool[rng.int(0, pool.length - 1)]!, pickedBy: 'decider', userAttacksFirst: rng.chance(0.5) });
  return order;
}

// ---------------------------------------------------------------------------------------------
// Playing series

export function pendingSeries(career: Career): CareerSeries | null {
  return career.pendingSeriesId ? career.series.get(career.pendingSeriesId) ?? null : null;
}

/** Engine input for the next map of a series. Team 0 is the human club. */
export function nextMapInput(career: Career, s: CareerSeries): MapSimInput {
  if (s.outcome) throw new Error('Series already decided');
  const k = s.played.length;
  const plan = s.mapOrder[k]!;
  const world = career.eco.world;
  const user = world.orgs.get(career.userOrgId)!;
  const opp = world.orgs.get(s.opponentOrgId)!;
  const userSetup: TeamSetup = { ...teamSetupFor(world, user, POOL_IDS, career.tactics), economy: career.economy };
  const oppSetup = teamSetupFor(world, opp, POOL_IDS, 'balanced');
  return {
    matchId: s.id, mapIndex: k, seed: `${career.seed}|${s.id}|${k}`, map: mapById(plan.mapId), ruleset: MR12_STANDARD,
    teams: [userSetup, oppSetup], firstAttacker: plan.userAttacksFirst ? 0 : 1,
  };
}

/** Records a finished map of the pending series; decides the series once a side has enough maps. */
export function recordMap(career: Career, s: CareerSeries, input: MapSimInput, result: MapResult, instructions: readonly ManagerInstruction[], watched: boolean): void {
  if (s.outcome) throw new Error('Series already decided');
  if (input.mapIndex !== s.played.length) throw new Error('Map played out of order');
  const names = new Map(input.teams.flatMap((t) => t.players.map((p) => [p.id, p.name] as const)));
  const recap = buildRecap(result.events, [input.teams[0].name, input.teams[1].name], (id) => names.get(id) ?? id);
  const rounds = result.rounds.length;
  const lines: StatLine[] = recap.players.map((p) => ({
    playerId: p.id, name: names.get(p.id) ?? p.id, team: p.team as 0 | 1, kills: p.kills, deaths: p.deaths, assists: p.assists,
    adr: Math.round(p.amr.adr * 10) / 10, amr: Math.round(p.amr.amr * 100) / 100, rounds,
  }));
  s.played.push({
    mapId: input.map.id, seed: input.seed, teams: input.teams, firstAttacker: input.firstAttacker, instructions: [...instructions],
    scores: [result.scores[0], result.scores[1]], won: result.winnerTeam === 0, lines, watched, mvpId: recap.mvpId,
  });
  const need = mapsToWin(s.bestOf);
  const won = s.played.filter((m) => m.won).length;
  const lost = s.played.length - won;
  if (won < need && lost < need) return;
  const maps: MapScore[] = s.played.map((m) => (s.userIsA ? { mapId: m.mapId, a: m.scores[0], b: m.scores[1] } : { mapId: m.mapId, a: m.scores[1], b: m.scores[0] }));
  s.outcome = { winner: (won >= need) === s.userIsA ? 'a' : 'b', maps };
  const opp = career.eco.world.orgs.get(s.opponentOrgId)?.name ?? s.opponentOrgId;
  note(career, 'result', `${won >= need ? 'Win' : 'Loss'} vs ${opp} (${won}–${lost})`, `${s.eventName}, ${s.stage}: ${s.played.map((m) => `${mapName(m.mapId)} ${m.scores[0]}–${m.scores[1]}`).join(', ')}.`, s.day);
  if (career.pendingSeriesId === s.id) career.pendingSeriesId = null;
}

/** Simulates the rest of a series with no calls (instant sim uses the same engine). */
export function autoPlay(career: Career, seriesId: string, simulate: (input: MapSimInput) => MapResult = defaultSim): void {
  const s = career.series.get(seriesId)!;
  while (!s.outcome) {
    const input = nextMapInput(career, s);
    recordMap(career, s, input, simulate(input), [], false);
  }
}

let defaultSim: (input: MapSimInput) => MapResult = () => {
  throw new Error('No map simulator registered');
};
/** The engine entry point (registered by the host to keep this module light for tests that stub it). */
export function registerSimulator(sim: (input: MapSimInput) => MapResult): void {
  defaultSim = sim;
}

export const mapName = (id: string): string => ACTIVE_POOL.find((m) => m.id === id)?.name ?? id;

// ---------------------------------------------------------------------------------------------
// Inbox

function note(career: Career, kind: InboxKind, title: string, text: string, day: Day = career.eco.world.day): void {
  career.inbox.push({ id: career.nextInboxId++, day, kind, title, text });
  if (career.inbox.length > 300) career.inbox.splice(0, career.inbox.length - 300);
}

/** Turns what happened to the human club since the last call into inbox messages. */
function collectInbox(career: Career): void {
  const eco = career.eco;
  const me = career.userOrgId;
  const day = eco.world.day;
  for (const inv of eco.invitations.slice(career.seen.invitations)) {
    if (inv.orgId !== me) continue;
    const ev = eco.events.get(inv.eventId);
    note(career, 'invite', `Invited to ${ev?.name ?? inv.eventId}`, inv.explanation);
  }
  career.seen.invitations = eco.invitations.length;
  for (const m of eco.moves.slice(career.seen.moves)) {
    if (m.orgId !== me && m.fromOrgId !== me) continue;
    const p = eco.world.players.get(m.inId);
    const who = p?.nickname ?? 'A player';
    const title = m.outId === m.inId ? `${who} has left` : m.fromOrgId === me && m.orgId !== me ? `${who} sold to ${eco.world.orgs.get(m.orgId)?.name ?? 'a rival'}` : `${who} joins the squad`;
    note(career, 'window', title, m.reason);
  }
  career.seen.moves = eco.moves.length;
  if (eco.results.size !== career.seen.results) {
    for (const [id, res] of [...eco.results.entries()].slice(career.seen.results)) {
      const pl = res.placements.find((x) => x.entrant.orgId === me);
      if (!pl) continue;
      const ev = eco.events.get(id);
      note(career, 'event', `${ev?.name ?? id}: ${pl.label}`, pl.prize > 0 ? `Prize money: $${pl.prize.toLocaleString('en-US')}.` : 'No prize money this time.');
    }
    career.seen.results = eco.results.size;
  }
  const p = toParts(day);
  // Contract reminders two months before each window.
  if (p.dayOfMonth === 1 && (p.month === 4 || p.month === 10)) {
    const window = dayOf(p.month === 4 ? p.season : p.season + 1, p.month === 4 ? 6 : 0, 1);
    const org = eco.world.orgs.get(me)!;
    const expiring = [...org.roster, ...org.bench].map((id) => eco.world.players.get(id)!).filter((pl) => pl.contract && pl.contract.endDay <= window);
    if (expiring.length) note(career, 'contract', 'Contracts expiring', `${expiring.map((x) => x.nickname).join(', ')} ${expiring.length > 1 ? 'are' : 'is'} out of contract on ${formatDate(window)}. Offer extensions from the Squad screen or they leave on a free.`);
  }
}

// ---------------------------------------------------------------------------------------------
// Saving

export interface CareerSummary {
  readonly orgId: string;
  readonly orgName: string;
  readonly day: Day;
  readonly date: string;
  readonly season: number;
}

export function summarize(career: Career): CareerSummary {
  const org = career.eco.world.orgs.get(career.userOrgId)!;
  return { orgId: org.id, orgName: org.name, day: career.eco.world.day, date: formatDate(career.eco.world.day), season: toParts(career.eco.world.day).season };
}

export function saveCareer(career: Career): string {
  return toJson({ format: 'apex-career', ...career });
}

/** Loads a saved career (migrating older versions) and re-attaches the resolver. */
export function loadCareer(text: string): Career {
  const raw = fromJson(text) as Career & { format?: string };
  if (raw.format !== 'apex-career') throw new Error('Not a Project Apex career save');
  if (raw.version > CAREER_VERSION) throw new Error(`This save was made by a newer version (career v${raw.version})`);
  const career = migrateCareer(raw);
  attachResolver(career);
  return career;
}

function migrateCareer(raw: Career): Career {
  // v1 is the first format; future versions add steps here.
  return raw;
}
