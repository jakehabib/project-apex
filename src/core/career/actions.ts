/**
 * The manager's decisions. Each returns a plain-English outcome. Squad changes are refused while a
 * series is waiting to be played (the event's line-up is fixed once it starts).
 */
import { syncLineages } from '../competition/lineage';
import { presetById, TACTICS_PRESETS } from '../match/engine/tactics';
import type { EconomyPolicy } from '../match/engine/types';
import { marketValue, negotiate, signContract, terminationCost } from '../world/contracts';
import { releasePlayer, type RosterMove } from '../world/evolution';
import type { Contract } from '../world/types';
import type { Career } from './career';

export interface ActionResult {
  readonly ok: boolean;
  readonly message: string;
  readonly notes?: readonly string[];
}

export type CareerAction =
  | { kind: 'tactics'; presetId: string }
  | { kind: 'economy'; policy: EconomyPolicy }
  | { kind: 'autoSim'; on: boolean }
  | { kind: 'swap'; starterId: string; benchId: string }
  | { kind: 'bench'; playerId: string }
  | { kind: 'promote'; playerId: string }
  | { kind: 'extend'; playerId: string }
  | { kind: 'release'; playerId: string }
  | { kind: 'sign'; playerId: string }
  | { kind: 'qualifier'; eventId: string; enter: boolean };

const BENCH_MAX = 3;

export function act(career: Career, a: CareerAction): ActionResult {
  const eco = career.eco;
  const w = eco.world;
  const day = w.day;
  const org = w.orgs.get(career.userOrgId)!;
  const squadLocked = (): ActionResult | null => (career.pendingSeriesId || career.pendingDay !== null ? { ok: false, message: 'Your squad is locked while a match is waiting to be played.' } : null);
  const resync = () => syncLineages(eco.reg, w, day);
  switch (a.kind) {
    case 'tactics': {
      if (!TACTICS_PRESETS.some((p) => p.id === a.presetId)) return { ok: false, message: 'Unknown game plan.' };
      career.tactics = a.presetId;
      return { ok: true, message: `Game plan set to ${presetById(a.presetId).name}.` };
    }
    case 'economy':
      career.economy = a.policy;
      return { ok: true, message: 'Economy philosophy updated.' };
    case 'autoSim':
      career.settings.autoSim = a.on;
      return { ok: true, message: a.on ? 'Your matches will be simulated automatically.' : 'The calendar will stop for your matches.' };
    case 'swap': {
      const locked = squadLocked();
      if (locked) return locked;
      if (!org.roster.includes(a.starterId) || !org.bench.includes(a.benchId)) return { ok: false, message: 'Pick one starter and one bench player.' };
      org.roster = org.roster.map((id) => (id === a.starterId ? a.benchId : id));
      org.bench = org.bench.map((id) => (id === a.benchId ? a.starterId : id));
      resync();
      return { ok: true, message: `${w.players.get(a.benchId)!.nickname} starts; ${w.players.get(a.starterId)!.nickname} moves to the bench.` };
    }
    case 'bench': {
      const locked = squadLocked();
      if (locked) return locked;
      if (!org.roster.includes(a.playerId)) return { ok: false, message: 'Not in the starting five.' };
      org.roster = org.roster.filter((id) => id !== a.playerId);
      org.bench.push(a.playerId);
      resync();
      return { ok: true, message: `${w.players.get(a.playerId)!.nickname} moved to the bench. You need five starters to compete.` };
    }
    case 'promote': {
      const locked = squadLocked();
      if (locked) return locked;
      if (!org.bench.includes(a.playerId)) return { ok: false, message: 'Not on the bench.' };
      if (org.roster.length >= 5) return { ok: false, message: 'The starting five is full: swap a starter out instead.' };
      org.bench = org.bench.filter((id) => id !== a.playerId);
      org.roster.push(a.playerId);
      resync();
      return { ok: true, message: `${w.players.get(a.playerId)!.nickname} joins the starting five.` };
    }
    case 'extend': {
      const p = w.players.get(a.playerId);
      if (!p || p.orgId !== org.id) return { ok: false, message: 'Not your player.' };
      const status: Contract['status'] = org.roster.includes(p.id) ? 'starter' : p.contract?.status ?? 'rotation';
      const n = negotiate(w, org, p, day, status, 1.1);
      if (!n.ok || !n.offer) return { ok: false, message: `${p.nickname} did not agree an extension.`, notes: n.rounds };
      const c = signContract(w, org, p, n.offer, day);
      eco.moves.push({ day, orgId: org.id, inId: p.id, outId: null, fromOrgId: org.id, fee: 0, reason: `Extended ${p.nickname}`, deal: { monthly: c.monthly, years: n.offer.years, signingBonus: c.signingBonus, notes: n.rounds } });
      return { ok: true, message: `${p.nickname} extended: $${c.monthly.toLocaleString('en-US')}/month for ${n.offer.years} year${n.offer.years > 1 ? 's' : ''}.`, notes: n.rounds };
    }
    case 'release': {
      const locked = squadLocked();
      if (locked) return locked;
      const p = w.players.get(a.playerId);
      if (!p || p.orgId !== org.id) return { ok: false, message: 'Not your player.' };
      const cost = terminationCost(p, day);
      const moves: RosterMove[] = [];
      releasePlayer(w, org, p, day, moves, `Released ${p.nickname}`);
      eco.moves.push(...moves);
      resync();
      return { ok: true, message: `${p.nickname} released${cost ? ` (settlement $${cost.toLocaleString('en-US')})` : ''}.` };
    }
    case 'sign': {
      const locked = squadLocked();
      if (locked) return locked;
      const p = w.players.get(a.playerId);
      if (!p || p.retired || p.orgId) return { ok: false, message: 'That player is not a free agent.' };
      const starter = org.roster.length < 5;
      if (!starter && org.bench.length >= BENCH_MAX) return { ok: false, message: `Your bench is full (${BENCH_MAX}). Release someone first.` };
      const n = negotiate(w, org, p, day, starter ? 'starter' : 'rotation', 1);
      if (!n.ok || !n.offer) return { ok: false, message: `${p.nickname} turned you down.`, notes: n.rounds };
      const c = signContract(w, org, p, n.offer, day);
      p.orgId = org.id;
      p.joinedDay = day;
      (starter ? org.roster : org.bench).push(p.id);
      eco.moves.push({ day, orgId: org.id, inId: p.id, outId: null, fromOrgId: null, fee: 0, reason: `Signed ${p.nickname} as a free agent`, deal: { monthly: c.monthly, years: n.offer.years, signingBonus: c.signingBonus, notes: n.rounds } });
      resync();
      return { ok: true, message: `${p.nickname} signed: $${c.monthly.toLocaleString('en-US')}/month for ${n.offer.years} year${n.offer.years > 1 ? 's' : ''}${starter ? ', straight into the starting five' : ', on the bench'}.`, notes: n.rounds };
    }
    case 'qualifier': {
      const q = eco.events.get(a.eventId);
      if (!q?.feeds) return { ok: false, message: 'Not a qualifier.' };
      if (q.startDay - 7 <= day) return { ok: false, message: 'Registration for this qualifier has closed.' };
      (eco.userQualifiers ??= new Map()).set(q.id, a.enter);
      return { ok: true, message: a.enter ? `Registered interest in ${q.name}.` : `You will skip ${q.name}.` };
    }
  }
}

/** Asking price shown on the free-agent list (what an offer would roughly need to meet). */
export const askingWage = (career: Career, playerId: string): number => {
  const w = career.eco.world;
  return marketValue(w, w.players.get(playerId)!, w.day).monthly;
};
