/**
 * The competitive ecosystem, advanced one day at a time:
 *
 * - month start: publish a frozen ARP snapshot (results up to the previous day);
 * - cutoff day: issue direct invitations from that snapshot, in rank order, with recorded skips;
 * - qualifier registration: AI (and later the user) decide entries;
 * - event start: verify roster continuity, fill places, play every series, record results and prizes;
 * - Jan 1 / Jul 1: roster windows (development, retirements, prospects, AI moves), then lineage sync.
 *
 * Everything is deterministic from the world seed and the resolver.
 */
import { Rng } from '../rng/prng';
import { dayOf, isMonthStart, snapshotLabel, toParts, type Day } from '../world/calendar';
import { addProspects, develop, monthlyFinances, retire, rosterWindow, teamStrength, type RosterMove } from '../world/evolution';
import { post, updateReputation } from '../world/contracts';
import type { Org, Region, World } from '../world/types';
import { computeStandings, type Standing } from './arp';
import type { Entrant, Resolver } from './formats';
import { createRegistry, rosterRegion, sharedCount, syncLineages, CONTINUITY_MIN, type LineageRegistry } from './lineage';
import { addPrize, addSeries, createStore, type RecordStore } from './records';
import { seasonCalendar } from './schedule';
import { runTournament, type TournamentConfig, type TournamentResult } from './tournaments';

export interface Snapshot {
  readonly day: Day;
  readonly label: string;
  readonly standings: readonly Standing[];
}

export type InviteStatus = 'accepted' | 'declined' | 'void';

export interface Invitation {
  readonly eventId: string;
  readonly lineageId: string;
  readonly orgId: string;
  /** Core at the time of invitation: continuity is checked against it at the event. */
  readonly core: readonly string[];
  readonly list: 'global' | Region;
  readonly rank: number;
  /** Roster region at the cutoff (must match a regional list). */
  readonly region: Region;
  readonly snapshotLabel: string;
  /** Day of the snapshot used (null = pre-season seeding). */
  readonly snapshotDay: Day | null;
  readonly entryStage: number;
  status: InviteStatus;
  explanation: string;
}

export interface InviteSkip {
  readonly eventId: string;
  readonly orgId: string;
  readonly lineageId: string;
  readonly list: 'global' | Region;
  readonly rank: number;
  readonly reason: string;
}

export interface Entry {
  readonly eventId: string;
  readonly lineageId: string;
  readonly orgId: string;
  readonly core: readonly string[];
  readonly via: 'invite' | 'qualifier' | 'open' | 'replacement';
  readonly entryStage: number;
  /** Rank used for seeding (null = unranked). */
  readonly seedRank: number | null;
  explanation: string;
}

export interface Commitment {
  readonly eventId: string;
  readonly start: Day;
  readonly end: Day;
}

export interface Ecosystem {
  readonly world: World;
  readonly reg: LineageRegistry;
  readonly store: RecordStore;
  readonly snapshots: Snapshot[];
  readonly events: Map<string, TournamentConfig>;
  readonly invitations: Invitation[];
  readonly skips: InviteSkip[];
  readonly entries: Map<string, Entry[]>;
  readonly results: Map<string, TournamentResult>;
  readonly commitments: Map<string, Commitment[]>;
  readonly moves: RosterMove[];
  readonly news: { day: Day; text: string }[];
  readonly resolver: Resolver;
  readonly rng: Rng;
  seasonsScheduled: Set<number>;
}

export function createEcosystem(world: World, resolver: Resolver, startDay: Day): Ecosystem {
  const eco: Ecosystem = {
    world, reg: createRegistry(), store: createStore(), snapshots: [], events: new Map(), invitations: [], skips: [], entries: new Map(),
    results: new Map(), commitments: new Map(), moves: [], news: [], resolver, rng: Rng.fromSeed(`eco:${world.seed}`), seasonsScheduled: new Set(),
  };
  world.day = startDay;
  syncLineages(eco.reg, world, startDay);
  const s = toParts(startDay).season;
  schedule(eco, s);
  schedule(eco, s + 1);
  return eco;
}

function schedule(eco: Ecosystem, season: number): void {
  if (eco.seasonsScheduled.has(season)) return;
  eco.seasonsScheduled.add(season);
  for (const e of seasonCalendar(season)) eco.events.set(e.id, e);
}

// ---------------------------------------------------------------------------------------------
// Rankings

export function liveStandings(eco: Ecosystem, asOf: Day): Standing[] {
  return computeStandings(eco.store, asOf, {
    active: (id) => eco.reg.lineages.get(id)?.endedDay === null,
    orgOf: (id) => eco.reg.lineages.get(id)?.orgId ?? '',
    regionOf: (id) => {
      const org = eco.world.orgs.get(eco.reg.lineages.get(id)?.orgId ?? '');
      return org ? rosterRegion(eco.world, org) : 'EU';
    },
  });
}

/** The published snapshot for a cutoff day (the one released on that day), if any. */
export const snapshotOn = (eco: Ecosystem, day: Day): Snapshot | undefined => eco.snapshots.find((s) => s.day === day);

/**
 * Pre-ranking seeding used only before the first snapshot exists (world start):
 * clubs ordered by roster strength. Clearly labelled; replaced by real ARP after one month.
 */
function seedingList(eco: Ecosystem): Standing[] {
  const orgs = [...eco.world.orgs.values()].filter((o) => o.roster.length === 5).sort((a, b) => teamStrength(eco.world, b) - teamStrength(eco.world, a) || (a.id < b.id ? -1 : 1));
  const byRegion = new Map<Region, number>();
  return orgs.map((o, i) => {
    const region = rosterRegion(eco.world, o);
    const r = (byRegion.get(region) ?? 0) + 1;
    byRegion.set(region, r);
    return { lineageId: eco.reg.activeByOrg.get(o.id)!, orgId: o.id, region, arp: 0, components: { prize: 0, bounty: 0, network: 0, seed: 0, h2h: 0 }, rankedSeries: 0, wins: 0, losses: 0, globalRank: i + 1, regionalRank: r };
  });
}

const listOf = (standings: readonly Standing[], list: 'global' | Region): Standing[] =>
  list === 'global' ? [...standings].sort((a, b) => a.globalRank - b.globalRank) : standings.filter((s) => s.region === list).sort((a, b) => a.regionalRank - b.regionalRank);
const rankOn = (s: Standing, list: 'global' | Region) => (list === 'global' ? s.globalRank : s.regionalRank);
const listName = (list: 'global' | Region) => (list === 'global' ? 'Global' : list === 'EU' ? 'Europe' : list === 'AM' ? 'Americas' : 'Asia');

// ---------------------------------------------------------------------------------------------
// Commitments and AI choices

const overlaps = (a: Commitment, start: Day, end: Day) => !(end < a.start || start > a.end);
export function conflictFor(eco: Ecosystem, orgId: string, start: Day, end: Day): Commitment | undefined {
  return (eco.commitments.get(orgId) ?? []).find((c) => overlaps(c, start, end));
}
function commit(eco: Ecosystem, orgId: string, ev: TournamentConfig): void {
  const list = eco.commitments.get(orgId) ?? [];
  list.push({ eventId: ev.id, start: ev.startDay, end: ev.endDay });
  eco.commitments.set(orgId, list);
}
function release(eco: Ecosystem, orgId: string, eventId: string): void {
  eco.commitments.set(orgId, (eco.commitments.get(orgId) ?? []).filter((c) => c.eventId !== eventId));
}

/** Competitive level from the latest published global rank (archetype before the first snapshot). */
export function levelOf(eco: Ecosystem, org: Org): 0 | 1 | 2 | 3 {
  const snap = eco.snapshots[eco.snapshots.length - 1];
  const lid = eco.reg.activeByOrg.get(org.id);
  const s = snap?.standings.find((x) => x.lineageId === lid);
  if (s) return s.globalRank <= 12 ? 0 : s.globalRank <= 40 ? 1 : s.globalRank <= 90 ? 2 : 3;
  return org.archetype === 'elite' ? 0 : org.archetype === 'contender' ? 1 : org.archetype === 'developing' ? 2 : 3;
}

const tierRank = (t: TournamentConfig['tier']) => (t === 'championship' ? 0 : t === 1 ? 1 : t === 2 ? 2 : 3);

/** Does an AI org accept a direct invitation? Returns a reason if it declines. */
function aiDeclines(eco: Ecosystem, org: Org, ev: TournamentConfig): string | null {
  const level = levelOf(eco, org);
  const clash = conflictFor(eco, org.id, ev.startDay, ev.endDay);
  if (clash) return `schedule conflict with ${eco.events.get(clash.eventId)?.name ?? clash.eventId}`;
  if (ev.tier === 3 && level <= 1) return 'prioritising higher-tier events';
  if (ev.tier === 2 && level === 0 && eco.rng.chance(0.75)) return 'prioritising Tier 1 preparation';
  if (ev.lan && ev.scope === 'global' && org.money < 25_000) return 'cannot fund international travel';
  return null;
}

/** Does an AI org register for a qualifier? Strong teams target prestige; developing teams seek access. */
function aiEntersQualifier(eco: Ecosystem, org: Org, q: TournamentConfig, parent: TournamentConfig): boolean {
  const level = levelOf(eco, org);
  const pt = tierRank(parent.tier);
  const fit = [
    [1, 1, 0, 0], // elite: championship, T1
    [1, 1, 0.8, 0], // contender
    [1, 0.5, 1, 0.6], // developing
    [0.7, 0.15, 0.5, 1], // grassroots
  ][level]![pt]!;
  if (fit <= 0) return false;
  if (conflictFor(eco, org.id, q.startDay, parent.endDay)) return false;
  return eco.rng.chance(fit);
}

// ---------------------------------------------------------------------------------------------
// Invitations

function issueInvitations(eco: Ecosystem, ev: TournamentConfig, day: Day): void {
  const snap = snapshotOn(eco, ev.cutoffDay!);
  const standings = snap ? snap.standings : seedingList(eco);
  const label = snap ? `${snap.label} ${'ARP snapshot'}` : 'pre-season seeding (no ranking published yet)';
  const taken = new Set<string>((eco.entries.get(ev.id) ?? []).map((e) => e.orgId));
  const entries = eco.entries.get(ev.id) ?? [];
  for (const rule of ev.invites) {
    let filled = 0;
    for (const s of listOf(standings, rule.list)) {
      if (filled >= rule.count) break;
      const rank = rankOn(s, rule.list);
      if (rank < rule.fromRank) continue;
      const org = eco.world.orgs.get(s.orgId);
      const skip = (reason: string) => eco.skips.push({ eventId: ev.id, orgId: s.orgId, lineageId: s.lineageId, list: rule.list, rank, reason });
      if (!org) continue;
      if (taken.has(org.id)) continue; // already invited via another rule
      // The ranking belongs to the lineage; the club must still field ≥3 of that core.
      const lin = eco.reg.lineages.get(s.lineageId);
      if (!lin || lin.endedDay !== null || lin.orgId !== org.id) {
        skip('ranked roster no longer exists (lost continuity)');
        continue;
      }
      if (org.roster.length < 5) {
        skip('no valid five-player roster');
        continue;
      }
      if (ev.scope !== 'global' && rosterRegion(eco.world, org) !== ev.scope) {
        skip(`roster is not in the ${listName(ev.scope)} region`);
        continue;
      }
      if (eco.invitations.some((i) => i.eventId === ev.id && i.orgId === org.id && i.status === 'declined')) {
        skip('already declined this event');
        continue;
      }
      const decline = org.isUser ? null : aiDeclines(eco, org, ev);
      const inv: Invitation = {
        eventId: ev.id, lineageId: s.lineageId, orgId: org.id, core: [...org.roster], list: rule.list, rank, region: rosterRegion(eco.world, org), snapshotLabel: label, snapshotDay: snap ? snap.day : null, entryStage: rule.entryStage,
        status: decline ? 'declined' : 'accepted',
        explanation: `${org.name} ${decline ? 'was offered' : 'received'} a direct invitation because it was ranked #${rank} on the ${label} (${listName(rule.list)} list), within the event's invitation positions #${rule.fromRank}–#${rule.fromRank + rule.count - 1 + countSkipsBefore(eco, ev.id, rule.list)}.`,
      };
      eco.invitations.push(inv);
      if (decline) {
        inv.explanation += ` It declined: ${decline}.`;
        skip(`declined (${decline})`);
        continue;
      }
      taken.add(org.id);
      commit(eco, org.id, ev);
      entries.push({ eventId: ev.id, lineageId: s.lineageId, orgId: org.id, core: [...org.roster], via: 'invite', entryStage: rule.entryStage, seedRank: s.globalRank, explanation: inv.explanation });
      filled++;
    }
  }
  eco.entries.set(ev.id, entries);
  eco.news.push({ day, text: `${ev.name}: ${entries.filter((e) => e.via === 'invite').length} direct invitations issued from the ${label}.` });
}

const countSkipsBefore = (eco: Ecosystem, eventId: string, list: 'global' | Region) => eco.skips.filter((s) => s.eventId === eventId && s.list === list).length;

// ---------------------------------------------------------------------------------------------
// Qualifier registration and events

function registerQualifier(eco: Ecosystem, q: TournamentConfig): void {
  const parent = eco.events.get(q.feeds!.eventId)!;
  const inParent = new Set((eco.entries.get(parent.id) ?? []).map((e) => e.orgId));
  const snap = eco.snapshots[eco.snapshots.length - 1];
  const rankOf = (orgId: string) => snap?.standings.find((s) => s.lineageId === eco.reg.activeByOrg.get(orgId))?.globalRank ?? null;
  const cands = [...eco.world.orgs.values()]
    .filter((o) => o.roster.length === 5 && !inParent.has(o.id) && rosterRegion(eco.world, o) === q.scope)
    .filter((o) => (o.isUser ? false : aiEntersQualifier(eco, o, q, parent)))
    // Over-subscribed opens take ranked teams first, then unranked in a seeded order.
    .map((o) => ({ o, r: rankOf(o.id), tie: eco.rng.next() }))
    .sort((a, b) => (a.r ?? 1e9) - (b.r ?? 1e9) || a.tie - b.tie)
    .slice(0, q.maxEntrants);
  const entries = cands.map(({ o, r }) => ({
    eventId: q.id, lineageId: eco.reg.activeByOrg.get(o.id)!, orgId: o.id, core: [...o.roster], via: 'open' as const, entryStage: 0, seedRank: r,
    explanation: `Registered for the open qualifier${r ? ` (ranked #${r})` : ' (unranked)'}.`,
  }));
  for (const e of entries) commit(eco, e.orgId, q);
  eco.entries.set(q.id, entries);
}

function toEntrant(e: Entry, i: number): Entrant {
  return { lineageId: e.lineageId, orgId: e.orgId, seed: (e.seedRank ?? 10_000) * 10 + i };
}

function runEvent(eco: Ecosystem, ev: TournamentConfig, day: Day): void {
  const entries = (eco.entries.get(ev.id) ?? []).filter((e) => {
    // Continuity check at the event: ≥3 of the core that earned the place.
    const org = eco.world.orgs.get(e.orgId)!;
    if (org.roster.length === 5 && sharedCount(e.core, org.roster) >= CONTINUITY_MIN) return true;
    e.explanation += ` Place voided at the event: the roster kept only ${sharedCount(e.core, org.roster)} of the qualifying core.`;
    const inv = eco.invitations.find((i) => i.eventId === ev.id && i.orgId === e.orgId);
    if (inv) inv.status = 'void';
    release(eco, e.orgId, ev.id);
    eco.news.push({ day, text: `${org.name} lost its place at ${ev.name}: roster continuity broken.` });
    return false;
  });
  // Lineage ids are refreshed (a continued core keeps its lineage id; a moved core follows its players).
  const live = entries.map((e) => ({ ...e, lineageId: eco.reg.activeByOrg.get(e.orgId) ?? e.lineageId }));
  // Unfilled main-event places go to the next eligible teams on the cutoff list (late replacements).
  if (!ev.open) {
    const need = ev.maxEntrants - live.length;
    if (need > 0) fillReplacements(eco, ev, live, need);
  }
  if (live.length < 2) return;
  const byStage: Entrant[][] = [];
  live.forEach((e, i) => {
    (byStage[e.entryStage] ??= []).push(toEntrant(e, i));
  });
  const res = runTournament(ev, byStage, eco.resolver);
  eco.results.set(ev.id, res);
  for (const p of res.series) {
    addSeries(eco.store, {
      id: p.req.seriesId, eventId: ev.id, stage: `${p.req.stage}: ${p.req.round}`, day: p.req.day, ranked: true, lan: ev.lan, tier: ev.tier,
      a: { lineageId: p.req.a.lineageId, orgId: p.req.a.orgId }, b: { lineageId: p.req.b.lineageId, orgId: p.req.b.orgId }, winner: p.out.winner, maps: p.out.maps,
    });
  }
  for (const pl of res.placements) {
    if (pl.prize > 0) {
      addPrize(eco.store, { id: `${ev.id}:${pl.entrant.lineageId}`, eventId: ev.id, day: ev.endDay, lineageId: pl.entrant.lineageId, orgId: pl.entrant.orgId, amount: pl.prize, placement: pl.label });
      const org = eco.world.orgs.get(pl.entrant.orgId)!;
      post(org, ev.endDay, 'prize', pl.prize, `${ev.name}: ${pl.label}`);
      // Players' contractual share of prize money, split across the five who played.
      const starters = org.roster.map((id) => eco.world.players.get(id)!).filter((p) => p.contract);
      const share = Math.round(starters.reduce((s, p) => s + pl.prize * p.contract!.prizeShare / 5, 0));
      if (share > 0) {
        post(org, ev.endDay, 'prize_share', -share, `${ev.name}: players' prize share`);
        for (const p of starters) p.careerEarnings += Math.round(pl.prize * p.contract!.prizeShare / 5);
      }
    }
  }
  for (const e of live) release(eco, e.orgId, ev.id);
  // Qualifier: top finishers take the parent's slots.
  if (ev.feeds) {
    const parent = eco.events.get(ev.feeds.eventId)!;
    const slot = parent.qualifierSlots.find((s) => s.qualifierId === ev.id);
    const pe = eco.entries.get(parent.id) ?? [];
    const already = new Set(pe.map((e) => e.orgId));
    let n = 0;
    for (const pl of res.placements) {
      if (n >= ev.feeds.slots) break;
      const org = eco.world.orgs.get(pl.entrant.orgId)!;
      if (already.has(org.id) || conflictFor(eco, org.id, parent.startDay, parent.endDay)) continue;
      const src = live.find((e) => e.orgId === org.id)!;
      pe.push({ eventId: parent.id, lineageId: pl.entrant.lineageId, orgId: org.id, core: [...src.core], via: 'qualifier', entryStage: slot?.entryStage ?? 0, seedRank: src.seedRank,
        explanation: `${org.name} qualified through ${ev.name} (${pl.label}).` });
      commit(eco, org.id, parent);
      n++;
    }
    eco.entries.set(parent.id, pe);
  } else {
    const champ = res.placements[0];
    if (champ) eco.news.push({ day: ev.endDay, text: `${eco.world.orgs.get(champ.entrant.orgId)!.name} won ${ev.name} ($${champ.prize.toLocaleString('en-US')}).` });
  }
}

function fillReplacements(eco: Ecosystem, ev: TournamentConfig, live: Entry[], need: number): void {
  const snap = ev.cutoffDay !== null ? snapshotOn(eco, ev.cutoffDay) : undefined;
  const list: 'global' | Region = ev.invites[0]?.list ?? ev.scope;
  const standings = snap ? snap.standings : seedingList(eco);
  const label = snap ? snap.label : 'pre-season seeding';
  const inEvent = new Set(live.map((e) => e.orgId));
  for (const s of listOf(standings, list)) {
    if (need <= 0) break;
    const org = eco.world.orgs.get(s.orgId);
    if (!org || inEvent.has(org.id) || org.roster.length < 5 || org.isUser) continue;
    const lin = eco.reg.lineages.get(s.lineageId);
    if (!lin || lin.orgId !== org.id || lin.endedDay !== null) continue;
    if (ev.scope !== 'global' && rosterRegion(eco.world, org) !== ev.scope) continue;
    if (conflictFor(eco, org.id, ev.startDay, ev.endDay)) continue;
    if (eco.invitations.some((i) => i.eventId === ev.id && i.orgId === org.id && i.status === 'declined')) continue;
    live.push({ eventId: ev.id, lineageId: s.lineageId, orgId: org.id, core: [...org.roster], via: 'replacement', entryStage: 0, seedRank: snap ? s.globalRank : null,
      explanation: `${org.name} received a late replacement invitation (#${rankOn(s, list)} on the ${label} list).` });
    inEvent.add(org.id);
    need--;
  }
}

// ---------------------------------------------------------------------------------------------
// Roster windows

/** Current global rank of an org's active lineage (999 if unranked). */
function rankOfOrg(eco: Ecosystem): (orgId: string) => number {
  const snap = eco.snapshots[eco.snapshots.length - 1];
  const ranks = new Map<string, number>();
  for (const s of snap?.standings ?? []) ranks.set(s.lineageId, s.globalRank);
  return (orgId) => ranks.get(eco.reg.activeByOrg.get(orgId) ?? '') ?? 999;
}

function rosterPolicy(eco: Ecosystem, day: Day) {
  const snap = eco.snapshots[eco.snapshots.length - 1];
  const rankOf = (o: Org) => snap?.standings.find((s) => s.lineageId === eco.reg.activeByOrg.get(o.id))?.globalRank ?? 999;
  return {
    level: (o: Org) => rankOf(o),
    // Clubs holding places in events within ~3 months protect continuity (max 2 changes).
    maxChanges: (o: Org) => ((eco.entries.size && [...eco.entries.values()].some((es) => es.some((e) => e.orgId === o.id && (eco.events.get(e.eventId)?.startDay ?? 0) - day < 100 && (eco.events.get(e.eventId)?.startDay ?? 0) >= day))) ? 1 : 2),
    // Rebuilds: clubs far below the level their money suggests occasionally reset (and lose continuity).
    rebuild: (o: Org) => {
      const r = rankOf(o);
      const expect = o.archetype === 'elite' ? 15 : o.archetype === 'contender' ? 45 : 999;
      return r > expect * 1.8 && eco.rng.chance(0.25);
    },
  };
}

function rosterWindowStep(eco: Ecosystem, day: Day, full: boolean): void {
  const rng = eco.rng.fork(`window:${day}`);
  develop(eco.world, rng, day, 0.5);
  const retired = retire(eco.world, rng, day);
  if (full) addProspects(eco.world, rng, day, 100);
  const moves = rosterWindow(eco.world, rng, day, rosterPolicy(eco, day));
  eco.moves.push(...moves);
  syncLineages(eco.reg, eco.world, day);
  const snapNow = eco.snapshots[eco.snapshots.length - 1];
  if (full && snapNow) {
    // Club ambition follows results (needs a ranking snapshot; the very first window has none).
    const snap = snapNow;
    for (const o of eco.world.orgs.values()) {
      const s = snap?.standings.find((x) => x.lineageId === eco.reg.activeByOrg.get(o.id));
      const r = s?.globalRank ?? 999;
      o.archetype = r <= 12 ? 'elite' : r <= 40 ? 'contender' : r <= 100 || o.money > 600_000 ? 'developing' : 'grassroots';
      // Prestige (sponsor appeal) follows results slowly.
      const score = Math.max(0, Math.min(100, 100 * (1 - Math.log(Math.max(1, r)) / Math.log(300))));
      o.finance.prestige = Math.round((0.7 * o.finance.prestige + 0.3 * score) * 10) / 10;
    }
    updateReputation(eco.world, day, rankOfOrg(eco));
  }
  eco.news.push({ day, text: `Roster window: ${moves.length} moves, ${retired.length} retirements.` });
}

// ---------------------------------------------------------------------------------------------
// Main loop

export function advanceTo(eco: Ecosystem, target: Day): void {
  for (let day = eco.world.day + 1; day <= target; day++) {
    eco.world.day = day;
    const p = toParts(day);
    if (p.month === 8 && p.dayOfMonth === 1) schedule(eco, p.season + 1);
    if (p.dayOfMonth === 1 && (p.month === 0 || p.month === 6)) rosterWindowStep(eco, day, p.month === 0);
    if (isMonthStart(day)) {
      monthlyFinances(eco.world, day);
      eco.snapshots.push({ day, label: snapshotLabel(day), standings: liveStandings(eco, day - 1) });
    }
    const todays = [...eco.events.values()].filter((e) => e.cutoffDay === day || e.startDay === day || (e.open && e.startDay - 7 === day));
    for (const ev of todays.sort((a, b) => a.startDay - b.startDay || (a.id < b.id ? -1 : 1))) {
      if (ev.cutoffDay === day && ev.invites.length > 0) issueInvitations(eco, ev, day);
      if (ev.open && ev.startDay - 7 === day) registerQualifier(eco, ev);
    }
    for (const ev of todays.filter((e) => e.startDay === day).sort((a, b) => (a.feeds ? 0 : 1) - (b.feeds ? 0 : 1) || (a.id < b.id ? -1 : 1))) runEvent(eco, ev, day);
  }
}

export const seasonStart = (season: number): Day => dayOf(season, 0, 1);
