/**
 * Presentation view-models for the rankings and calendar screens. Pure and
 * serializable: built in a worker from the ecosystem and posted to the UI.
 * Every status and explanation is derived from stored ecosystem data.
 */
import { formatDate, snapshotLabel, toParts, type Day } from '../world/calendar';
import { ageOn, type Region } from '../world/types';
import { financialForecast, marketValue, monthlyRevenue, wageRoom } from '../world/contracts';
import { toOvr } from '../world/ratings';
import { REGION_NAMES } from '../world/types';
import { explainStanding, type Standing } from './arp';
import { conflictFor, liveStandings, type Ecosystem, type Snapshot } from './ecosystem';
import { rosterRegion } from './lineage';
import type { TournamentConfig } from './tournaments';

export interface RankRow {
  readonly orgId: string;
  readonly name: string;
  readonly tag: string;
  readonly region: Region;
  readonly arp: number;
  readonly globalRank: number;
  readonly regionalRank: number;
  /** Positive = moved up since the previous snapshot; null = new entry. */
  readonly move: number | null;
  readonly peak: number;
  readonly wins: number;
  readonly losses: number;
  readonly explanation: string;
  readonly history: readonly { readonly label: string; readonly rank: number | null }[];
  readonly recent: readonly string[];
}

export interface CutoffNote {
  readonly eventId: string;
  readonly name: string;
  readonly tier: string;
  readonly cutoffLabel: string;
  readonly cutoffDate: string;
  readonly daysToCutoff: number;
  readonly list: string;
  readonly window: string;
}

export interface RankingsView {
  readonly today: string;
  readonly snapshotLabel: string;
  readonly nextSnapshot: string;
  readonly rows: readonly RankRow[];
  readonly cutoffs: readonly CutoffNote[];
}

export type EventStatus = 'Directly Invited' | 'Qualified' | 'Qualifier Available' | 'Invite Pending' | 'Below Cutoff' | 'Ineligible' | 'Declined' | 'Completed' | 'Not entered';

export interface CalendarEntry {
  readonly id: string;
  readonly name: string;
  readonly tier: string;
  readonly scope: string;
  readonly location: string;
  readonly lan: boolean;
  readonly prizePool: number;
  readonly winnerPrize: number;
  readonly announce: string;
  readonly cutoff: string | null;
  readonly start: string;
  readonly end: string;
  readonly startDay: number;
  readonly month: string;
  readonly status: EventStatus;
  readonly statusDetail: string;
  readonly winner: string | null;
  readonly teamPlacement: string | null;
}

export interface EventDetail {
  readonly id: string;
  readonly name: string;
  readonly facts: readonly [string, string][];
  readonly format: readonly string[];
  readonly invitations: readonly { readonly team: string; readonly rank: number; readonly list: string; readonly status: string; readonly explanation: string }[];
  readonly skips: readonly { readonly team: string; readonly rank: number; readonly list: string; readonly reason: string }[];
  readonly qualifiers: readonly { readonly name: string; readonly date: string; readonly entrants: number; readonly slots: number; readonly qualified: readonly string[] }[];
  readonly entrants: readonly { readonly team: string; readonly via: string; readonly explanation: string }[];
  readonly placements: readonly { readonly place: string; readonly team: string; readonly prize: number }[];
  readonly forTeam: string;
}

export interface ForecastEntry {
  readonly eventId: string;
  readonly name: string;
  readonly tier: string;
  readonly cutoffLabel: string;
  readonly daysToCutoff: number;
  readonly list: string;
  readonly window: string;
  readonly currentRank: number | null;
  readonly historical: readonly number[];
  readonly outlook: 'Likely' | 'On the edge' | 'Unlikely' | 'Out of reach';
  readonly text: string;
}

const tierLabel = (t: TournamentConfig['tier']) => (t === 'championship' ? 'World Championship' : `Tier ${t}`);
const listName = (l: 'global' | Region) => (l === 'global' ? 'Global' : REGION_NAMES[l]);

function orgName(eco: Ecosystem, id: string): string {
  return eco.world.orgs.get(id)?.name ?? id;
}

function rankIn(snap: Snapshot | undefined, orgId: string, list: 'global' | Region): number | null {
  const s = snap?.standings.find((x) => x.orgId === orgId);
  if (!s) return null;
  if (list === 'global') return s.globalRank;
  return s.region === list ? s.regionalRank : null;
}

export function rankingsView(eco: Ecosystem): RankingsView {
  const day = eco.world.day;
  const snap = eco.snapshots[eco.snapshots.length - 1];
  const prev = eco.snapshots[eco.snapshots.length - 2];
  const standings: readonly Standing[] = snap?.standings ?? liveStandings(eco, day);
  const hist = eco.snapshots.slice(-12);
  const peaks = new Map<string, number>();
  for (const s of eco.snapshots) for (const st of s.standings) peaks.set(st.orgId, Math.min(peaks.get(st.orgId) ?? 1e9, st.globalRank));
  const rows: RankRow[] = standings.map((s) => {
    const org = eco.world.orgs.get(s.orgId)!;
    const before = prev?.standings.find((x) => x.orgId === s.orgId);
    return {
      orgId: s.orgId, name: org.name, tag: org.tag, region: s.region, arp: s.arp, globalRank: s.globalRank, regionalRank: s.regionalRank,
      move: before ? before.globalRank - s.globalRank : null, peak: peaks.get(s.orgId) ?? s.globalRank, wins: s.wins, losses: s.losses,
      explanation: explainStanding(s),
      history: hist.map((h) => ({ label: h.label, rank: h.standings.find((x) => x.orgId === s.orgId)?.globalRank ?? null })),
      recent: recentResults(eco, s.orgId, 3),
    };
  });
  const next = toParts(day);
  const nextSnapDay = day + 1 + ((): number => {
    let d = 0;
    while (toParts(day + 1 + d).dayOfMonth !== 1) d++;
    return d;
  })();
  void next;
  return {
    today: formatDate(day), snapshotLabel: snap ? `${snap.label} snapshot` : 'Live (no snapshot yet)', nextSnapshot: `${formatDate(nextSnapDay)} (${snapshotLabel(nextSnapDay)})`,
    rows, cutoffs: upcomingCutoffs(eco, day, 100),
  };
}

function upcomingCutoffs(eco: Ecosystem, day: Day, horizon: number): CutoffNote[] {
  const out: CutoffNote[] = [];
  for (const e of eco.events.values()) {
    if (e.cutoffDay === null || e.cutoffDay <= day || e.cutoffDay - day > horizon || e.invites.length === 0 || e.tier === 3) continue;
    const r = e.invites[0]!;
    out.push({
      eventId: e.id, name: e.name, tier: tierLabel(e.tier), cutoffLabel: `${snapshotLabel(e.cutoffDay)} snapshot`, cutoffDate: formatDate(e.cutoffDay), daysToCutoff: e.cutoffDay - day,
      list: listName(r.list), window: e.invites.map((x) => `${listName(x.list)} #${x.fromRank}–#${x.fromRank + x.count - 1}`).join(', '),
    });
  }
  return out.sort((a, b) => a.daysToCutoff - b.daysToCutoff);
}

function recentResults(eco: Ecosystem, orgId: string, n: number): string[] {
  const out: { day: Day; text: string }[] = [];
  for (const r of eco.results.values()) {
    const e = eco.events.get(r.eventId)!;
    if (e.feeds) continue;
    const p = r.placements.find((x) => x.entrant.orgId === orgId);
    if (p && (p.place <= 4 || e.tier === 1 || e.tier === 'championship')) out.push({ day: e.endDay, text: `${p.label} · ${e.name}` });
  }
  return out.sort((a, b) => b.day - a.day).slice(0, n).map((x) => x.text);
}

/** Status of an event for one organisation, with a plain-English reason. */
export function statusFor(eco: Ecosystem, ev: TournamentConfig, orgId: string): { status: EventStatus; detail: string } {
  const day = eco.world.day;
  const org = eco.world.orgs.get(orgId)!;
  const entry = (eco.entries.get(ev.id) ?? []).find((e) => e.orgId === orgId);
  const res = eco.results.get(ev.id);
  if (res) {
    const p = res.placements.find((x) => x.entrant.orgId === orgId);
    return p ? { status: 'Completed', detail: `Finished ${p.label}${p.prize ? ` ($${p.prize.toLocaleString('en-US')})` : ''}.` } : { status: 'Completed', detail: 'Did not take part.' };
  }
  if (entry) return { status: entry.via === 'qualifier' ? 'Qualified' : 'Directly Invited', detail: entry.explanation };
  const declined = eco.invitations.find((i) => i.eventId === ev.id && i.orgId === orgId && i.status === 'declined');
  if (declined) return { status: 'Declined', detail: declined.explanation };
  if (ev.scope !== 'global' && rosterRegion(eco.world, org) !== ev.scope) return { status: 'Ineligible', detail: `Regional event for ${REGION_NAMES[ev.scope]}; your roster competes in ${REGION_NAMES[rosterRegion(eco.world, org)]}.` };
  const quals = [...eco.events.values()].filter((q) => q.feeds?.eventId === ev.id && q.scope === rosterRegion(eco.world, org));
  const qualOpen = quals.find((q) => q.startDay > day);
  const conflict = conflictFor(eco, orgId, ev.startDay, ev.endDay);
  if (ev.cutoffDay !== null && ev.cutoffDay > day && ev.invites.length) {
    const snap = eco.snapshots[eco.snapshots.length - 1];
    for (const r of ev.invites) {
      const rank = rankIn(snap, orgId, r.list);
      if (rank !== null && rank >= r.fromRank && rank <= r.fromRank + r.count - 1)
        return { status: 'Invite Pending', detail: `Currently #${rank} on the ${listName(r.list)} list, inside the invitation range #${r.fromRank}–#${r.fromRank + r.count - 1}. Invitations use the ${snapshotLabel(ev.cutoffDay)} snapshot (${formatDate(ev.cutoffDay)}); not guaranteed until then.` };
    }
  }
  if (conflict) return { status: 'Ineligible', detail: `Schedule conflict with ${eco.events.get(conflict.eventId)?.name ?? 'another event'}.` };
  if (qualOpen) return { status: 'Qualifier Available', detail: `${qualOpen.name} on ${formatDate(qualOpen.startDay)} awards ${qualOpen.feeds!.slots} place${qualOpen.feeds!.slots > 1 ? 's' : ''}.` };
  if (ev.invites.length) {
    const snap = ev.cutoffDay !== null && ev.cutoffDay <= day ? eco.snapshots.find((s) => s.day === ev.cutoffDay) : eco.snapshots[eco.snapshots.length - 1];
    const r = ev.invites[0]!;
    const rank = rankIn(snap, orgId, r.list);
    const last = eco.invitations.filter((i) => i.eventId === ev.id && i.list === r.list && i.status === 'accepted').reduce((m, i) => Math.max(m, i.rank), 0);
    const gap = rank !== null && last ? rank - last : null;
    return { status: 'Below Cutoff', detail: rank === null ? 'Not ranked on the invitation list.' : `Ranked #${rank} on the ${listName(r.list)} list${gap !== null && gap > 0 ? `; missed the last invitation by ${gap} place${gap > 1 ? 's' : ''}` : ''}.${quals.length ? ' The qualifier for your region has already been played.' : ''}` };
  }
  return { status: 'Not entered', detail: 'Open event; your club did not register.' };
}

export function calendarView(eco: Ecosystem, orgId: string, fromDay: Day, toDay: Day): CalendarEntry[] {
  return [...eco.events.values()]
    .filter((e) => !e.feeds && e.endDay >= fromDay && e.startDay <= toDay)
    .sort((a, b) => a.startDay - b.startDay || (a.id < b.id ? -1 : 1))
    .map((e) => {
      const st = statusFor(eco, e, orgId);
      const res = eco.results.get(e.id);
      const mine = res?.placements.find((p) => p.entrant.orgId === orgId);
      return {
        id: e.id, name: e.name, tier: tierLabel(e.tier), scope: e.scope === 'global' ? 'International' : REGION_NAMES[e.scope], location: e.location, lan: e.lan,
        prizePool: e.prizePool, winnerPrize: Math.round(e.prizePool * (e.prizeSplit[0] ?? 0)), announce: formatDate(e.announceDay), cutoff: e.cutoffDay !== null ? `${formatDate(e.cutoffDay)} (${snapshotLabel(e.cutoffDay)} snapshot)` : null,
        start: formatDate(e.startDay), end: formatDate(e.endDay), startDay: e.startDay, month: `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][toParts(e.startDay).month]} · Season ${toParts(e.startDay).season}`,
        status: st.status, statusDetail: st.detail, winner: res ? orgName(eco, res.placements[0]!.entrant.orgId) : null, teamPlacement: mine ? mine.label : null,
      };
    });
}

export function eventDetail(eco: Ecosystem, eventId: string, orgId: string): EventDetail {
  const e = eco.events.get(eventId)!;
  const res = eco.results.get(eventId);
  const quals = [...eco.events.values()].filter((q) => q.feeds?.eventId === eventId);
  const st = statusFor(eco, e, orgId);
  return {
    id: e.id, name: e.name,
    facts: [
      ['Tier', tierLabel(e.tier)], ['Scope', e.scope === 'global' ? 'International' : REGION_NAMES[e.scope]], ['Location', `${e.location}${e.lan ? ' (LAN)' : ' (online)'}`],
      ['Prize pool', `$${e.prizePool.toLocaleString('en-US')}`], ['Teams', String(e.maxEntrants)], ['Announced', formatDate(e.announceDay)],
      ['Invitation cutoff', e.cutoffDay !== null ? `${formatDate(e.cutoffDay)} · ${snapshotLabel(e.cutoffDay)} snapshot` : 'Open entry'],
      ['Dates', `${formatDate(e.startDay)} – ${formatDate(e.endDay)}`],
      ['Direct invitations', e.invites.map((r) => `${r.count} from ${listName(r.list)} #${r.fromRank}+${e.stages.length > 2 ? (r.entryStage ? ' (Stage 2)' : ' (Stage 1)') : ''}`).join('; ') || 'None'],
      ['Qualifier places', e.qualifierSlots.map((q) => `${q.count} via ${eco.events.get(q.qualifierId)?.name.split(': ')[1] ?? q.qualifierId}`).join('; ') || 'None'],
    ],
    format: e.stages.map((s) => `${s.name}: ${s.kind === 'gsl' ? 'GSL groups' : s.kind === 'swiss' ? `Swiss (${s.winsNeeded ?? 3} wins advance, ${s.lossesOut ?? 3} losses out)` : s.kind === 'double' ? 'Double elimination' : s.kind === 'single' ? 'Single elimination' : 'Round robin'}, BO${s.bestOf}${s.finalBestOf && s.finalBestOf !== s.bestOf ? `, final BO${s.finalBestOf}` : ''}${s.decidingBestOf ? `, deciding matches BO${s.decidingBestOf}` : ''}`),
    invitations: eco.invitations.filter((i) => i.eventId === eventId).sort((a, b) => a.rank - b.rank).map((i) => ({ team: orgName(eco, i.orgId), rank: i.rank, list: listName(i.list), status: i.status, explanation: i.explanation })),
    skips: eco.skips.filter((k) => k.eventId === eventId).map((k) => ({ team: orgName(eco, k.orgId), rank: k.rank, list: listName(k.list), reason: k.reason })),
    qualifiers: quals.map((q) => ({
      name: q.name, date: formatDate(q.startDay), entrants: (eco.entries.get(q.id) ?? []).length, slots: q.feeds!.slots,
      qualified: (eco.entries.get(eventId) ?? []).filter((x) => x.via === 'qualifier' && x.explanation.includes(q.name)).map((x) => orgName(eco, x.orgId)),
    })),
    entrants: (eco.entries.get(eventId) ?? []).map((x) => ({ team: orgName(eco, x.orgId), via: x.via, explanation: x.explanation })),
    placements: res ? res.placements.map((p) => ({ place: p.label, team: orgName(eco, p.entrant.orgId), prize: p.prize })) : [],
    forTeam: `${orgName(eco, orgId)}: ${st.status}. ${st.detail}`,
  };
}

/** Cautious invitation outlook for upcoming cutoffs: never presented as a guarantee. */
export function forecastView(eco: Ecosystem, orgId: string): ForecastEntry[] {
  const day = eco.world.day;
  const snap = eco.snapshots[eco.snapshots.length - 1];
  const out: ForecastEntry[] = [];
  for (const e of eco.events.values()) {
    if (e.cutoffDay === null || e.cutoffDay <= day || e.cutoffDay - day > 120 || e.invites.length === 0 || e.tier === 3) continue;
    const org = eco.world.orgs.get(orgId)!;
    const rule = e.invites.find((r) => r.list === 'global' || r.list === rosterRegion(eco.world, org));
    if (!rule) continue;
    if (e.scope !== 'global' && e.scope !== rosterRegion(eco.world, org)) continue;
    const rank = rankIn(snap, orgId, rule.list);
    // Historical threshold: the lowest-ranked team that received this kind of invitation recently.
    const past = [...eco.events.values()].filter((p) => p.tier === e.tier && p.scope === e.scope && p.startDay < day && p.id !== e.id && p.invites.some((r) => r.list === rule.list && r.fromRank === rule.fromRank)).sort((a, b) => b.startDay - a.startDay).slice(0, 4);
    const historical = past.map((p) => eco.invitations.filter((i) => i.eventId === p.id && i.list === rule.list && i.status === 'accepted' && i.entryStage === rule.entryStage).reduce((m, i) => Math.max(m, i.rank), 0)).filter((x) => x > 0);
    const threshold = historical.length ? Math.round(historical.reduce((s, x) => s + x, 0) / historical.length) : rule.fromRank + rule.count - 1;
    const outlook: ForecastEntry['outlook'] = rank === null ? 'Out of reach' : rank <= threshold - 3 ? 'Likely' : rank <= threshold + 2 ? 'On the edge' : rank <= threshold + 10 ? 'Unlikely' : 'Out of reach';
    out.push({
      eventId: e.id, name: e.name, tier: tierLabel(e.tier), cutoffLabel: `${snapshotLabel(e.cutoffDay)} snapshot`, daysToCutoff: e.cutoffDay - day, list: listName(rule.list),
      window: `#${rule.fromRank}–#${rule.fromRank + rule.count - 1}`, currentRank: rank, historical, outlook,
      text: `${rank === null ? 'Unranked' : `#${rank}`} on the ${listName(rule.list)} list now. ${threshold > rule.fromRank + rule.count - 1 ? `Invitations have recently reached about #${threshold}${historical.length ? ` (last ${historical.length}: ${historical.map((h) => `#${h}`).join(', ')})` : ''} because some teams declined or were ineligible.` : `Recent editions filled exactly to #${rule.fromRank + rule.count - 1}; nobody above declined.`} Cutoff in ${e.cutoffDay - day} days; results before then still move the ranking. Estimate only, not a guarantee.`,
    });
  }
  return out.sort((a, b) => a.daysToCutoff - b.daysToCutoff);
}

// ---------------------------------------------------------------------------------------------
// Club finances (contracts, forecast, ledger, recent deals)

export interface FinanceView {
  readonly club: string;
  readonly cash: number;
  readonly state: string;
  readonly revenue: number;
  readonly prestige: number;
  readonly backer: string | null;
  readonly payroll: number;
  readonly wageRoom: number;
  readonly commitments: readonly { season: number; amount: number }[];
  readonly transfers12m: { paid: number; received: number };
  readonly projection: readonly { label: string; cash: number; payroll: number; subsidy: number }[];
  readonly contracts: readonly { nickname: string; role: string; ovr: number; age: number; monthly: number; value: number; until: string; status: string; buyout: number | null; bench: boolean }[];
  readonly ledger: readonly { date: string; kind: string; amount: number; memo: string }[];
  readonly deals: readonly { date: string; text: string; notes: readonly string[] }[];
}

export function financeView(eco: Ecosystem, orgId: string): FinanceView {
  const w = eco.world;
  const org = w.orgs.get(orgId)!;
  const day = w.day;
  const f = financialForecast(w, org, day, 24);
  const b = org.finance.backer;
  return {
    club: org.name,
    cash: org.money,
    state: f.state,
    revenue: monthlyRevenue(org),
    prestige: Math.round(org.finance.prestige),
    backer: b && b.untilDay > day ? `${b.name}: covers losses up to $${b.monthlyCap.toLocaleString('en-US')}/month until ${formatDate(b.untilDay)}` : null,
    payroll: f.monthlyPayroll,
    wageRoom: wageRoom(w, org, day),
    commitments: f.commitmentsBySeason,
    transfers12m: f.transfers12m,
    projection: f.months.filter((_, i) => i % 3 === 2).map((m) => ({ label: snapshotLabel(m.day), cash: m.cash, payroll: m.payroll, subsidy: m.subsidy })),
    contracts: [...org.roster, ...org.bench].map((id) => w.players.get(id)!).map((p) => ({
      nickname: p.nickname, role: p.role, ovr: toOvr(p.skill), age: ageOn(p, day), monthly: p.contract?.monthly ?? 0, value: marketValue(w, p, day).monthly,
      until: p.contract ? formatDate(p.contract.endDay) : '—', status: p.contract?.status ?? '—', buyout: p.contract?.buyout ?? null, bench: org.bench.includes(p.id),
    })),
    ledger: org.finance.ledger.slice(-14).reverse().map((e) => ({ date: formatDate(e.day), kind: e.kind, amount: e.amount, memo: e.memo })),
    deals: eco.moves.filter((m) => m.orgId === orgId && m.deal).slice(-6).reverse().map((m) => ({
      date: formatDate(m.day), text: `${m.reason} · $${m.deal!.monthly.toLocaleString('en-US')}/month, ${m.deal!.years}y${m.fee ? ` · fee $${m.fee.toLocaleString('en-US')}` : ''}${m.deal!.signingBonus ? ` · bonus $${m.deal!.signingBonus.toLocaleString('en-US')}` : ''}`, notes: m.deal!.notes,
    })),
  };
}
