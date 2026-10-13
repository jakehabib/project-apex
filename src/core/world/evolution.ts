/**
 * World evolution between competitions: ageing and development, retirements,
 * new prospects, simple finances and AI roster moves. v1: the full attribute,
 * coach and scouting model replaces `develop` later (see HANDOFF backlog);
 * development is automatic (no chores), per the design non-negotiables in CLAUDE.md.
 */
import type { Rng } from '../rng/prng';
import { toParts, type Day } from './calendar';
import { compactLedger, financialState, marketValue, monthlyRevenue, negotiate, post, rollMotives, signContract, staffPayroll, terminationCost, transferFee, wageRoom } from './contracts';
import { NATIONS, NAMES, NICK_PARTS } from './names';
import { ATTRIBUTE_KEYS } from '../match/engine/types';
import { ageGrowth, MECHANICAL, overallFor } from './attributes';
import { assignAttributes } from './generate';
import { ageOn, REGIONS, type Archetype, type Contract, type Org, type Player, type PlayerRole, type Staff, type World } from './types';

const ROLES: readonly PlayerRole[] = ['AWPer', 'In-game leader', 'Star rifler', 'Entry fragger', 'Anchor', 'Support', 'Lurker'];

/** The org's head coach (first coach on staff), if any. */
export function headCoach(world: World, orgId: string | null): Staff | null {
  if (!orgId) return null;
  const org = world.orgs.get(orgId);
  const id = org?.staff.find((sid) => world.staff.get(sid)?.role === 'coach');
  return id ? world.staff.get(id)! : null;
}

const LEVEL_GROWTH: Record<Archetype, number> = { elite: 1.1, contender: 1.05, developing: 1.0, grassroots: 0.95 };

/**
 * Automatic development for a fraction of a year (no training chores). Each attribute moves
 * toward its hidden ceiling at a speed set by age (mechanical skills peak early, tactical ones
 * late), the head coach's Development rating, playing time and the level of competition.
 * Past their peak, attributes decline and ceilings come down with them.
 */
export function develop(world: World, rng: Rng, day: Day, fraction: number): void {
  for (const p of world.players.values()) {
    if (p.retired) continue;
    const age = ageOn(p, day);
    const org = p.orgId ? world.orgs.get(p.orgId) : undefined;
    const coach = headCoach(world, p.orgId);
    const coachF = coach ? 0.6 + 0.8 * (coach.development / 100) : 0.5;
    const minutesF = org ? (org.roster.includes(p.id) ? 1 : 0.65) : 0.55;
    const levelF = org ? LEVEL_GROWTH[org.archetype] : 0.9;
    for (const k of ATTRIBUTE_KEYS) {
      const g = ageGrowth(MECHANICAL.includes(k) ? 'mechanical' : 'tactical', age);
      let delta: number;
      if (g > 0) {
        const gap = p.ceiling[k] - p.attrs[k];
        if (gap <= 0) continue;
        delta = Math.min(7, gap * 0.28 * g * coachF * minutesF * levelF * rng.range(0.6, 1.4)) * fraction;
      } else {
        delta = g * rng.range(0.6, 1.4) * 1.3 * fraction;
        p.ceiling[k] = Math.max(p.attrs[k] + delta, p.ceiling[k] + delta * 0.8);
      }
      p.attrs[k] = Math.round(Math.max(5, Math.min(99, p.attrs[k] + delta)) * 10) / 10;
    }
    p.skill = overallFor(p.attrs, p.role);
    p.potential = Math.max(p.skill, overallFor(p.ceiling, p.role));
  }
}

/** Retirements (older or out of work). Retired players leave their club's roster. */
export function retire(world: World, rng: Rng, day: Day): Player[] {
  const gone: Player[] = [];
  for (const p of world.players.values()) {
    if (p.retired) continue;
    const age = ageOn(p, day);
    const chance = age >= 36 ? 1 : age >= 34 ? 0.45 : age >= 32 ? 0.2 : age >= 30 ? 0.06 : !p.orgId && p.skill < 50 && age >= 23 ? 0.35 : 0;
    if (chance > 0 && rng.chance(chance)) {
      p.retired = true;
      if (p.orgId) {
        const o = world.orgs.get(p.orgId);
        if (o) {
          o.roster = o.roster.filter((x) => x !== p.id);
          o.bench = o.bench.filter((x) => x !== p.id);
        }
      }
      p.orgId = null;
      gone.push(p);
    }
  }
  return gone;
}

/** New young players entering the scene (the future scouting pool). A few are hidden gems. */
export function addProspects(world: World, rng: Rng, day: Day, count: number): void {
  const used = new Set([...world.players.values()].map((p) => p.nickname));
  for (let i = 0; i < count; i++) {
    const region = rng.weighted(REGIONS, [0.45, 0.32, 0.23]);
    const pool = NATIONS.filter((n) => n.region === region);
    const nation = rng.weighted(pool, pool.map((n) => n.weight));
    const names = NAMES[nation.culture];
    const age = rng.int(16, 18);
    const gem = rng.chance(0.06);
    const skill = rng.range(44, 63);
    let nick = rng.pick(NICK_PARTS);
    for (let k = 0; used.has(nick) && k < 20; k++) nick = `${rng.pick(NICK_PARTS)}${rng.pick(NICK_PARTS).slice(0, 2)}`;
    if (used.has(nick)) nick = `${nick}${world.nextPlayerSeq}`;
    used.add(nick);
    const id = `g${String(world.nextPlayerSeq++).padStart(4, '0')}`;
    const p: Player = {
      id,
      name: `${rng.pick(names.first)} ${rng.pick(names.last)}`,
      nickname: nick,
      nationality: nation.name,
      region: nation.region,
      role: rng.pick(ROLES),
      bornDay: day - age * 365 - rng.int(0, 364),
      attrs: { rifling: 0, awp: 0, opening: 0, positioning: 0, utility: 0, gameSense: 0, teamwork: 0, clutch: 0, calling: 0, adaptability: 0 },
      ceiling: { rifling: 0, awp: 0, opening: 0, positioning: 0, utility: 0, gameSense: 0, teamwork: 0, clutch: 0, calling: 0, adaptability: 0 },
      skill: Math.round(skill * 10) / 10,
      potential: Math.round(Math.min(96, gem ? rng.range(84, 95) : skill + rng.range(4, 24)) * 10) / 10,
      orgId: null,
      joinedDay: day,
      retired: false,
      contract: null,
      motives: rollMotives(world.seed, id),
      reputation: 0,
      careerEarnings: 0,
    };
    assignAttributes(p, rng);
    world.players.set(p.id, p);
  }
}

export const teamStrength = (world: World, org: Org): number => {
  const xs = org.roster.map((id) => world.players.get(id)?.skill ?? 40);
  return xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
};

export interface RosterMove {
  readonly day: Day;
  readonly orgId: string;
  readonly inId: string;
  readonly outId: string | null;
  readonly fromOrgId: string | null;
  readonly fee: number;
  readonly reason: string;
  /** Contract terms and negotiation summary, when a deal was signed. */
  readonly deal?: { readonly monthly: number; readonly years: number; readonly signingBonus: number; readonly notes: readonly string[] };
}

export interface RosterPolicy {
  /** Max changes allowed for this org this window (continuity protection). */
  readonly maxChanges: (org: Org) => number;
  /** Org wants a full rebuild (3+ changes) this window. */
  readonly rebuild: (org: Org) => boolean;
  /** Relative standing used to decide who can buy from whom (lower = stronger). */
  readonly level: (org: Org) => number;
}

/** Cash a club will commit to transfer fees this window (savings share plus explicit backing). */
const transferBudget = (org: Org, day: Day): number => {
  const b = org.finance.backer && org.finance.backer.untilDay > day ? org.finance.backer.monthlyCap * 3 : 0;
  return Math.max(0, org.money * 0.4 + b);
};

/** Ends a contract: the player becomes a free agent. A release before expiry settles half the remaining wages. */
export function releasePlayer(world: World, org: Org, p: Player, day: Day, moves: RosterMove[], reason: string): void {
  const cost = p.contract && p.contract.endDay > day ? terminationCost(p, day) : 0;
  if (cost > 0) {
    post(org, day, 'termination', -cost, `Released ${p.nickname}`);
    p.careerEarnings += cost;
  }
  org.roster = org.roster.filter((x) => x !== p.id);
  org.bench = org.bench.filter((x) => x !== p.id);
  p.orgId = null;
  p.contract = null;
  moves.push({ day, orgId: org.id, inId: p.id, outId: p.id, fromOrgId: null, fee: cost, reason });
}

/** The human club's expired contracts at a window: the players leave on a free (extensions are the manager's job). */
export function expireUserContracts(world: World, day: Day): RosterMove[] {
  const moves: RosterMove[] = [];
  for (const org of world.orgs.values()) {
    if (!org.isUser) continue;
    for (const id of [...org.roster, ...org.bench]) {
      const p = world.players.get(id)!;
      if (p.contract && p.contract.endDay <= day) releasePlayer(world, org, p, day, moves, `${p.nickname}'s contract expired and the player left ${org.name} on a free`);
    }
  }
  return moves;
}

/**
 * AI roster window (1 January and 1 July). In order:
 * 1. Expiring contracts: clubs extend the players they still want (a real negotiation; players may
 *    leave for a better career move), the rest leave on a free.
 * 2. Clubs in financial distress transfer-list their top earners.
 * 3. Empty slots are filled, then clubs try to upgrade their weakest players from free agency
 *    (no fee) or from weaker clubs (a fee the seller accepts, or the release clause), within the
 *    continuity limit, their transfer budget and their wage capacity.
 * Returns the moves for the news feed and tests.
 */
export function rosterWindow(world: World, rng: Rng, day: Day, policy: RosterPolicy): RosterMove[] {
  const moves: RosterMove[] = [];
  const orgs = [...world.orgs.values()].filter((o) => !o.isUser).sort((a, b) => policy.level(a) - policy.level(b) || (a.id < b.id ? -1 : 1));
  const listed = new Set<string>();
  const amateurs = new Set<string>();

  // 1. Expiries.
  for (const org of orgs) {
    for (const id of [...org.roster, ...org.bench]) {
      const p = world.players.get(id)!;
      if (!p.contract || p.contract.endDay > day) continue;
      const starter = org.roster.includes(id);
      const avg = teamStrength(world, org);
      const wanted = (starter && p.skill >= avg - 3.5 && !(ageOn(p, day) >= 31 && p.skill < avg)) || (ageOn(p, day) <= 22 && p.potential - p.skill >= 6);
      if (!wanted) {
        releasePlayer(world, org, p, day, moves, `${p.nickname}'s contract expired; not renewed`);
        continue;
      }
      const n = negotiate(world, org, p, day, starter ? 'starter' : 'prospect', 1.1);
      if (n.ok && n.offer) {
        const c = signContract(world, org, p, n.offer, day);
        moves.push({ day, orgId: org.id, inId: p.id, outId: null, fromOrgId: org.id, fee: 0, reason: `Extended ${p.nickname} to ${toParts(c.endDay).season - 1 + 1}`, deal: { monthly: c.monthly, years: n.offer.years, signingBonus: c.signingBonus, notes: n.rounds } });
      } else releasePlayer(world, org, p, day, moves, `${p.nickname} left on a free: ${n.rounds[n.rounds.length - 1] ?? 'no agreement'}`);
    }
  }

  // 2. Distress: list the top earners so other clubs can buy them at a discount.
  for (const org of orgs) {
    if (financialState(world, org, day) !== 'distressed') continue;
    const earners = [...org.roster, ...org.bench].map((id) => world.players.get(id)!).sort((a, b) => (b.contract?.monthly ?? 0) - (a.contract?.monthly ?? 0));
    for (const p of earners.slice(0, 2)) listed.add(p.id);
  }

  const freeAgents = () => [...world.players.values()].filter((p) => !p.retired && !p.orgId);
  const sign = (org: Org, p: Player, outId: string | null, fee: number, from: Org | null, reason: string, status: Contract['status'], importance: number): boolean => {
    const n = negotiate(world, org, p, day, status, importance);
    if (!n.ok || !n.offer) return false;
    if (outId) {
      const out = world.players.get(outId)!;
      org.roster = org.roster.filter((x) => x !== outId);
      // Dropped starters are benched (still paid, transfer-listed) while the club can carry them; else released.
      if (org.bench.length < 2 && wageRoom(world, org, day) > n.offer.monthly) {
        org.bench.push(outId);
        listed.add(outId);
      } else releasePlayer(world, org, out, day, moves, `Released ${out.nickname} to make room`);
    }
    if (from) {
      from.roster = from.roster.filter((x) => x !== p.id);
      from.bench = from.bench.filter((x) => x !== p.id);
      post(from, day, 'transfer_out', fee, `Sold ${p.nickname} to ${org.name}`);
      post(org, day, 'transfer_in', -fee, `Bought ${p.nickname} from ${from.name}`);
    }
    const c = signContract(world, org, p, n.offer, day);
    p.orgId = org.id;
    p.joinedDay = day;
    listed.delete(p.id);
    org.bench = org.bench.filter((x) => x !== p.id);
    org.roster.push(p.id);
    moves.push({ day, orgId: org.id, inId: p.id, outId, fromOrgId: from?.id ?? null, fee, reason, deal: { monthly: c.monthly, years: n.offer.years, signingBonus: c.signingBonus, notes: n.rounds } });
    return true;
  };
  const fill = (org: Org) => {
    while (org.roster.length < 5 && org.bench.length > 0) {
      const b = org.bench.map((id) => world.players.get(id)!).sort((x, y) => y.skill - x.skill)[0]!;
      org.bench = org.bench.filter((x) => x !== b.id);
      listed.delete(b.id);
      org.roster.push(b.id);
      moves.push({ day, orgId: org.id, inId: b.id, outId: null, fromOrgId: null, fee: 0, reason: 'Promoted from the bench' });
    }
    // Free agents in order of quality; the first who agrees terms the club can afford signs.
    const fa = freeAgents().sort((a, b) => b.skill - a.skill || (a.id < b.id ? -1 : 1));
    for (const p of fa) {
      if (org.roster.length >= 5) break;
      sign(org, p, null, 0, null, 'Filled an empty roster spot', 'starter', 1.2);
    }
    // Still short: a minimum deal with the best free agent the club can actually pay (a club must field five).
    while (org.roster.length < 5) {
      const room = Math.max(400, wageRoom(world, org, day));
      const p = freeAgents()
        .filter((x) => amateurs.has(x.id) || marketValue(world, x, day, 0).monthly <= room)
        .sort((a, b) => b.skill - a.skill || (a.id < b.id ? -1 : 1))[0];
      if (!p) {
        // Nobody affordable: recruit an amateur from the open scene (the ladder pool; plays for almost nothing).
        addProspects(world, rng, day, 1);
        const fresh = world.players.get(`g${String(world.nextPlayerSeq - 1).padStart(4, '0')}`);
        if (!fresh) break;
        amateurs.add(fresh.id);
        continue;
      }
      // An amateur takes whatever a short-handed club can pay for a first professional contract.
      const monthly = amateurs.has(p.id) ? Math.min(marketValue(world, p, day, 0).monthly, room) : marketValue(world, p, day, 0).monthly;
      const c = signContract(world, org, p, { monthly, signingBonus: 0, years: ageOn(p, day) <= 23 ? 2 : 1, status: 'starter', prizeShare: 0.2 }, day);
      p.orgId = org.id;
      p.joinedDay = day;
      org.roster.push(p.id);
      moves.push({ day, orgId: org.id, inId: p.id, outId: null, fromOrgId: null, fee: 0, reason: 'Signed on a minimum deal', deal: { monthly: c.monthly, years: 1, signingBonus: 0, notes: ['Short-handed club; the player takes the only starting spot on offer'] } });
    }
  };
  for (const org of orgs) fill(org);
  for (const org of orgs) {
    if (financialState(world, org, day) === 'distressed') continue; // no buying while in distress
    const rebuild = policy.rebuild(org);
    const limit = rebuild ? 3 : policy.maxChanges(org);
    let changes = 0;
    const tried = new Set<string>();
    while (changes < limit) {
      const need = assessNeed(world, org, day, rebuild, rng, tried);
      if (!need) break;
      tried.add(need.out.id);
      const myLevel = policy.level(org);
      const budget = transferBudget(org, day);
      const room = wageRoom(world, org, day) + (need.out.contract?.monthly ?? 0);
      const pool = [
        ...freeAgents().map((p) => ({ p, from: null as Org | null, fee: 0 })),
        ...[...world.orgs.values()]
          .filter((o) => o.id !== org.id && !o.isUser && policy.level(o) > myLevel)
          // Clubs don't sell players they only just signed.
          .flatMap((o) => o.roster.filter((id) => day - world.players.get(id)!.joinedDay >= 180).map((id) => ({ p: world.players.get(id)!, from: o, fee: transferFee(world, world.players.get(id)!, day) }))),
        // Transfer-listed players (benched, or sold by clubs in distress) from any club, at a discount.
        ...[...world.orgs.values()]
          .filter((o) => o.id !== org.id)
          .flatMap((o) => [...o.roster, ...o.bench].filter((id) => listed.has(id)).map((id) => ({ p: world.players.get(id)!, from: o, fee: Math.round(transferFee(world, world.players.get(id)!, day) * 0.5) }))),
      ].filter((c) => roleGroup(c.p.role) === need.group && c.p.skill >= need.minSkill && c.fee <= budget && marketValue(world, c.p, day, 1).monthly <= room * 1.15);
      if (pool.length === 0) continue;
      // Ambitious clubs buy the best; developing clubs weigh youth and upside (and cheap contracts).
      // Clubs recruit mostly within their own scene (language, visas, comms); only top clubs import freely.
      const home = org.homeRegion;
      const score = (c: (typeof pool)[number]) =>
        c.p.skill + (org.archetype === 'developing' || org.archetype === 'grassroots' ? 0.3 * (c.p.potential - c.p.skill) : 0) - c.fee / 200_000 + rng.range(0, 1.5) - (c.p.region === home ? 0 : org.archetype === 'elite' ? 2 : 6);
      const ranked = pool.sort((a, b) => score(b) - score(a) || (a.p.id < b.p.id ? -1 : 1));
      // Try the best few: a player may turn the club down for career reasons.
      for (const best of ranked.slice(0, 3)) {
        const status = 'starter';
        if (sign(org, best.p, need.out.id, best.fee, best.from, need.reason, status, 1 + Math.max(0, best.p.skill - need.out.skill) / 10)) {
          changes++;
          if (best.from) fill(best.from);
          break;
        }
      }
    }
  }
  for (const org of orgs) {
    fill(org);
    // Clubs that can't carry their bench release it.
    for (const id of [...org.bench]) {
      if (wageRoom(world, org, day) < 0 || org.money < 0) releasePlayer(world, org, world.players.get(id)!, day, moves, 'Released from the bench');
    }
  }
  return moves;
}

/**
 * Monthly finances through the ledger: sponsor and content revenue, player and staff wages, and the
 * explicit backer's top-up of any operating loss (capped, time-limited). Tracks months in debt.
 */
export function monthlyFinances(world: World, day: Day = world.day): void {
  for (const org of world.orgs.values()) {
    const revenue = monthlyRevenue(org);
    post(org, day, 'revenue', revenue, 'Sponsors, content and merchandise');
    let wages = 0;
    for (const id of [...org.roster, ...org.bench]) {
      const p = world.players.get(id);
      if (!p?.contract) continue;
      wages += p.contract.monthly;
      p.careerEarnings += p.contract.monthly;
    }
    post(org, day, 'wages', -wages, 'Player wages');
    const staff = staffPayroll(world, org);
    post(org, day, 'staff_wages', -staff, 'Staff wages');
    const net = revenue - wages - staff;
    const b = org.finance.backer;
    if (b && b.untilDay > day && (net < 0 || org.money < 0)) {
      const top = Math.min(b.monthlyCap, Math.max(-net, -org.money));
      post(org, day, 'subsidy', top, `${b.name} covers the shortfall`);
    }
    org.finance.monthsInDebt = org.money < 0 ? org.finance.monthsInDebt + 1 : 0;
    compactLedger(org, day);
  }
}

type RoleGroup = 'awp' | 'igl' | 'rifle';
const roleGroup = (r: PlayerRole): RoleGroup => (r === 'AWPer' ? 'awp' : r === 'In-game leader' ? 'igl' : 'rifle');

interface Need {
  readonly out: Player;
  readonly group: RoleGroup;
  /** Replacement must be at least this good. */
  readonly minSkill: number;
  readonly reason: string;
}

/**
 * Why (if at all) a club wants to replace someone this window. Settled, balanced
 * rosters make no moves. Players signed within ~6 months are protected; only a
 * severe, rare case cuts a recent signing.
 */
export function assessNeed(world: World, org: Org, day: Day, rebuild: boolean, rng: Rng, skip: ReadonlySet<string>): Need | null {
  const roster = org.roster.map((id) => world.players.get(id)!).filter((p) => !skip.has(p.id));
  if (roster.length === 0) return null;
  const all = org.roster.map((id) => world.players.get(id)!);
  const avg = all.reduce((s, p) => s + p.skill, 0) / all.length;
  const tenure = (p: Player) => day - p.joinedDay;
  const settled = (p: Player) => tenure(p) >= 180 || (rebuild && tenure(p) >= 90);
  // 1. Missing a specialist: no AWPer or no in-game leader.
  for (const g of ['awp', 'igl'] as const) {
    if (all.some((p) => roleGroup(p.role) === g)) continue;
    const spare = roster.filter((p) => roleGroup(p.role) === 'rifle' && settled(p)).sort((a, b) => a.skill - b.skill)[0];
    if (spare) return { out: spare, group: g, minSkill: spare.skill - 3, reason: g === 'awp' ? 'Signed a dedicated AWPer' : 'Signed an in-game leader' };
  }
  const ranked = [...roster].sort((a, b) => a.skill - b.skill || (a.id < b.id ? -1 : 1));
  for (const p of ranked) {
    const gap = avg - p.skill;
    const age = ageOn(p, day);
    if (rebuild && settled(p)) return { out: p, group: roleGroup(p.role), minSkill: p.skill + 0.5, reason: 'Roster rebuild' };
    if (!settled(p)) {
      // Rare: a recent signing who is clearly not working out.
      if (gap >= 8 && tenure(p) >= 60 && rng.chance(0.15)) return { out: p, group: roleGroup(p.role), minSkill: p.skill + 4, reason: `Benched ${p.nickname} early: not working out` };
      continue;
    }
    if (gap >= 3.5) return { out: p, group: roleGroup(p.role), minSkill: p.skill + 3, reason: `Upgrade over ${p.nickname} (below the team's level)` };
    if (age >= 30 && gap >= 1.5) return { out: p, group: roleGroup(p.role), minSkill: p.skill + 2.5, reason: `Replaced veteran ${p.nickname}` };
  }
  return null;
}
