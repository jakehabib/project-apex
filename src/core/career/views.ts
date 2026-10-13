/**
 * Career screen view-models: plain, serialisable data built in the worker. Player statistics come
 * only from the stat lines of maps the club played in the engine.
 */
import { conflictFor, levelOf, liveStandings, qualifierFit } from '../competition/ecosystem';
import { rosterRegion } from '../competition/lineage';
import { calendarView, financeView, forecastView, rankingsView, type CalendarEntry, type FinanceView, type ForecastEntry, type RankingsView } from '../competition/views';
import { TACTICS_PRESETS } from '../match/engine/tactics';
import type { EconomyPolicy } from '../match/engine/types';
import { dayOf, formatDate, toParts, type Day } from '../world/calendar';
import { marketValue } from '../world/contracts';
import { teamStrength } from '../world/evolution';
import { attrDisplay, ratingTier, toOvr } from '../world/ratings';
import { ageOn, REGION_NAMES, type Player, type PlayerRole, type Region } from '../world/types';
import { mapName, pendingSeries, type Career, type CareerSeries, type InboxItem } from './career';

export interface PlayerRow {
  readonly id: string;
  readonly nickname: string;
  readonly name: string;
  readonly nationality: string;
  readonly role: PlayerRole;
  readonly age: number;
  readonly ovr: number;
  readonly tier: string;
  /** Scouting-style band for hidden potential (never the exact ceiling). */
  readonly potential: string;
  readonly attrs: Readonly<Record<string, number>>;
  readonly starter: boolean;
  readonly monthly: number;
  readonly value: number;
  readonly contractUntil: string;
  readonly expiresSoon: boolean;
  readonly stats: { maps: number; kills: number; deaths: number; assists: number; adr: number; amr: number } | null;
}

export interface SeriesRow {
  readonly id: string;
  readonly date: string;
  readonly day: Day;
  readonly event: string;
  readonly stage: string;
  readonly opponent: string;
  readonly opponentId: string;
  readonly bestOf: number;
  readonly score: string;
  readonly won: boolean | null;
  readonly maps: readonly { readonly index: number; readonly map: string; readonly mapId: string; readonly score: string; readonly won: boolean; readonly watched: boolean; readonly mvp: string | null }[];
}

export interface PendingView {
  readonly id: string;
  readonly event: string;
  readonly stage: string;
  readonly round: string;
  readonly date: string;
  readonly bestOf: number;
  readonly opponent: { readonly id: string; readonly name: string; readonly tag: string; readonly ovr: number; readonly rank: number | null; readonly players: readonly { id: string; nickname: string; role: string; ovr: number }[] };
  readonly mapOrder: readonly { readonly map: string; readonly mapId: string; readonly pickedBy: string; readonly side: string }[];
  readonly played: readonly { readonly map: string; readonly score: string; readonly won: boolean }[];
  readonly score: readonly [number, number];
}

export interface QualifierRow {
  readonly id: string;
  readonly name: string;
  readonly parent: string;
  readonly date: string;
  readonly slots: number;
  readonly entered: boolean;
  readonly explicit: boolean;
  readonly open: boolean;
  /** Entry impossible (already in the main event, or a clash). */
  readonly blocked: boolean;
  readonly note: string;
}

export interface CareerView {
  readonly header: {
    readonly orgId: string; readonly orgName: string; readonly tag: string; readonly region: string;
    readonly date: string; readonly day: Day; readonly season: number; readonly cash: number;
    readonly worldRank: number | null; readonly regionRank: number | null; readonly ovr: number;
    readonly nextEvent: { readonly name: string; readonly date: string; readonly days: number } | null;
    readonly pending: boolean; readonly autoSim: boolean;
  };
  readonly inbox: readonly InboxItem[];
  readonly squad: readonly PlayerRow[];
  readonly freeAgents: readonly PlayerRow[];
  readonly tactics: { readonly current: string; readonly presets: readonly { id: string; name: string; summary: string; strengths: string; risks: string }[]; readonly economy: EconomyPolicy };
  readonly schedule: readonly CalendarEntry[];
  readonly qualifiers: readonly QualifierRow[];
  readonly rankings: RankingsView;
  readonly finance: FinanceView;
  readonly forecast: readonly ForecastEntry[];
  readonly results: readonly SeriesRow[];
  readonly pending: PendingView | null;
  readonly record: { readonly series: [number, number]; readonly maps: [number, number]; readonly trophies: readonly string[] };
}

const POT_BANDS: [number, string][] = [[90, 'World class'], [84, 'Elite'], [78, 'Top tier'], [72, 'Professional'], [66, 'Solid pro'], [0, 'Limited']];
function potentialBand(p: Player): string {
  // A coarse band around the hidden ceiling, blurred so it cannot be read exactly.
  const est = toOvr(p.potential) + ((p.id.charCodeAt(p.id.length - 1) % 5) - 2);
  return POT_BANDS.find(([min]) => est >= min)![1];
}

function playerRow(career: Career, p: Player, starter: boolean, stats: Map<string, PlayerRow['stats']>): PlayerRow {
  const w = career.eco.world;
  const day = w.day;
  const t = toParts(day);
  const nextWindow = t.month < 6 ? dayOf(t.season, 6, 1) : dayOf(t.season + 1, 0, 1);
  return {
    id: p.id, nickname: p.nickname, name: p.name, nationality: p.nationality, role: p.role, age: ageOn(p, day), ovr: toOvr(p.skill), tier: ratingTier(toOvr(p.skill)),
    potential: potentialBand(p), attrs: Object.fromEntries(Object.entries(p.attrs).map(([k, v]) => [k, attrDisplay(v)])), starter,
    monthly: p.contract?.monthly ?? 0, value: marketValue(w, p, day).monthly, contractUntil: p.contract ? formatDate(p.contract.endDay) : '—',
    expiresSoon: !!p.contract && p.contract.endDay <= nextWindow, stats: stats.get(p.id) ?? null,
  };
}

function statTotals(career: Career): Map<string, PlayerRow['stats']> {
  const acc = new Map<string, { maps: number; kills: number; deaths: number; assists: number; dmg: number; rounds: number; amr: number }>();
  for (const s of career.series.values())
    for (const m of s.played)
      for (const l of m.lines) {
        const a = acc.get(l.playerId) ?? { maps: 0, kills: 0, deaths: 0, assists: 0, dmg: 0, rounds: 0, amr: 0 };
        a.maps++;
        a.kills += l.kills;
        a.deaths += l.deaths;
        a.assists += l.assists;
        a.dmg += l.adr * l.rounds;
        a.rounds += l.rounds;
        a.amr += l.amr * l.rounds;
        acc.set(l.playerId, a);
      }
  return new Map([...acc].map(([id, a]) => [id, { maps: a.maps, kills: a.kills, deaths: a.deaths, assists: a.assists, adr: a.rounds ? Math.round((a.dmg / a.rounds) * 10) / 10 : 0, amr: a.rounds ? Math.round((a.amr / a.rounds) * 100) / 100 : 0 }]));
}

function seriesRow(career: Career, s: CareerSeries): SeriesRow {
  const w = career.eco.world;
  const won = s.played.filter((m) => m.won).length;
  const lines = new Map(s.played.flatMap((m) => m.lines.map((l) => [l.playerId, l.name] as const)));
  return {
    id: s.id, date: formatDate(s.day), day: s.day, event: s.eventName, stage: `${s.stage} · ${s.round}`, opponent: w.orgs.get(s.opponentOrgId)?.name ?? s.opponentOrgId, opponentId: s.opponentOrgId,
    bestOf: s.bestOf, score: `${won}–${s.played.length - won}`, won: s.outcome ? (s.outcome.winner === 'a') === s.userIsA : null,
    maps: s.played.map((m, i) => ({ index: i, map: mapName(m.mapId), mapId: m.mapId, score: `${m.scores[0]}–${m.scores[1]}`, won: m.won, watched: m.watched, mvp: m.mvpId ? lines.get(m.mvpId) ?? null : null })),
  };
}

export function careerView(career: Career): CareerView {
  const eco = career.eco;
  const w = eco.world;
  const day = w.day;
  const org = w.orgs.get(career.userOrgId)!;
  const region = rosterRegion(w, org);
  const standings = eco.snapshots[eco.snapshots.length - 1]?.standings ?? liveStandings(eco, day);
  const me = standings.find((s) => s.lineageId === eco.reg.activeByOrg.get(org.id));
  const stats = statTotals(career);
  const squad = [...org.roster.map((id) => [id, true] as const), ...org.bench.map((id) => [id, false] as const)].map(([id, st]) => playerRow(career, w.players.get(id)!, st, stats));
  const freeAgents = [...w.players.values()]
    .filter((p) => !p.retired && !p.orgId)
    .sort((a, b) => b.skill - a.skill)
    .slice(0, 40)
    .map((p) => playerRow(career, p, false, stats));
  const myEvents = [...eco.events.values()]
    .filter((e) => e.startDay > day && !e.feeds && (eco.entries.get(e.id) ?? []).some((x) => x.orgId === org.id))
    .sort((a, b) => a.startDay - b.startDay);
  const next = myEvents[0];
  const qualifiers: QualifierRow[] = [...eco.events.values()]
    .filter((q) => q.feeds && q.scope === region && q.startDay > day && q.startDay - day <= 120)
    .sort((a, b) => a.startDay - b.startDay)
    .map((q) => {
      const parent = eco.events.get(q.feeds!.eventId)!;
      const explicit = eco.userQualifiers?.has(q.id) ?? false;
      const inParent = (eco.entries.get(parent.id) ?? []).some((e) => e.orgId === org.id);
      const conflict = conflictFor(eco, org.id, q.startDay, parent.endDay);
      const entered = (eco.entries.get(q.id) ?? []).some((e) => e.orgId === org.id) || (!inParent && !conflict && (eco.userQualifiers?.get(q.id) ?? qualifierFit(eco, org, parent) >= 0.5));
      const open = q.startDay - 7 > day;
      return {
        id: q.id, name: q.name, parent: parent.name, date: formatDate(q.startDay), slots: q.feeds!.slots, entered, explicit, open, blocked: inParent || !!conflict,
        note: inParent ? 'Already in the main event.' : conflict ? `Clashes with ${eco.events.get(conflict.eventId)?.name ?? 'another event'}.` : explicit ? 'Your choice.' : `Default for a club of your level (${['elite', 'contender', 'developing', 'grassroots'][levelOf(eco, org)]}).`,
      };
    });
  const results = [...career.series.values()].filter((s) => s.played.length > 0).sort((a, b) => b.day - a.day || (a.id < b.id ? 1 : -1)).slice(0, 60).map((s) => seriesRow(career, s));
  const done = [...career.series.values()].filter((s) => s.outcome);
  const sw = done.filter((s) => (s.outcome!.winner === 'a') === s.userIsA).length;
  const allMaps = done.flatMap((s) => s.played);
  const trophies = [...eco.results.entries()]
    .filter(([id, r]) => !eco.events.get(id)?.feeds && r.placements[0]?.entrant.orgId === org.id && (eco.events.get(id)?.endDay ?? 0) >= career.startDay)
    .map(([id]) => eco.events.get(id)!.name);
  const ps = pendingSeries(career);
  let pending: PendingView | null = null;
  if (ps) {
    const opp = w.orgs.get(ps.opponentOrgId)!;
    const oppRank = standings.find((s) => s.lineageId === eco.reg.activeByOrg.get(opp.id))?.globalRank ?? null;
    const won = ps.played.filter((m) => m.won).length;
    pending = {
      id: ps.id, event: ps.eventName, stage: ps.stage, round: ps.round, date: formatDate(ps.day), bestOf: ps.bestOf,
      opponent: { id: opp.id, name: opp.name, tag: opp.tag, ovr: toOvr(teamStrength(w, opp)), rank: oppRank, players: opp.roster.map((id) => w.players.get(id)!).map((p) => ({ id: p.id, nickname: p.nickname, role: p.role, ovr: toOvr(p.skill) })) },
      mapOrder: ps.mapOrder.map((m) => ({ map: mapName(m.mapId), mapId: m.mapId, pickedBy: m.pickedBy === 'user' ? org.name : m.pickedBy === 'opponent' ? opp.name : 'Decider', side: m.userAttacksFirst ? 'You start on attack' : 'You start on defence' })),
      played: ps.played.map((m) => ({ map: mapName(m.mapId), score: `${m.scores[0]}–${m.scores[1]}`, won: m.won })),
      score: [won, ps.played.length - won],
    };
  }
  return {
    header: {
      orgId: org.id, orgName: org.name, tag: org.tag, region: REGION_NAMES[region as Region], date: formatDate(day), day, season: toParts(day).season, cash: org.money,
      worldRank: me?.globalRank ?? null, regionRank: me?.regionalRank ?? null, ovr: toOvr(teamStrength(w, org)),
      nextEvent: next ? { name: next.name, date: formatDate(next.startDay), days: next.startDay - day } : null, pending: !!ps, autoSim: career.settings.autoSim,
    },
    inbox: career.inbox.slice(-60).reverse(),
    squad, freeAgents,
    tactics: { current: career.tactics, presets: TACTICS_PRESETS.map((p) => ({ id: p.id, name: p.name, summary: p.summary, strengths: p.strengths, risks: p.risks })), economy: career.economy },
    schedule: calendarView(eco, org.id, day - 21, day + 200),
    qualifiers,
    rankings: rankingsView(eco),
    finance: financeView(eco, org.id),
    forecast: forecastView(eco, org.id),
    results,
    pending,
    record: { series: [sw, done.length - sw], maps: [allMaps.filter((m) => m.won).length, allMaps.filter((m) => !m.won).length], trophies },
  };
}
