/**
 * Player salary and contract market.
 *
 * Reference market: professional tactical-shooter esports, 2025–26 (owner brief, HANDOFF #34).
 * Starting monthly salary bands (targets, not caps):
 *   Amateur $0–750 · Emerging prospect $750–2,500 · Tier 3 pro $1,500–4,000 · Established Tier 2 $3,000–10,000 ·
 *   Tier 1 newcomer $8,000–17,500 · Established Tier 1 $15,000–30,000 · Elite superstar $30,000–60,000 ·
 *   Exceptional marquee superstar $60,000–100,000+.
 *
 * Principles:
 * - A player's market value is NOT a function of OVR alone. Ability, potential, reputation, demand
 *   from other clubs, age, role scarcity, home scene and financial ambition all enter, and each factor
 *   is reported so every number explains itself.
 * - A current salary can differ a lot from market value (cheap young players on long deals are a
 *   genuine roster-building opportunity).
 * - Negotiations are deterministic and motivated: every counteroffer and refusal carries a reason.
 * - Cash only changes through ledger entries (`post`); `org.money` is the ledger balance.
 * - Contracted players leave only through expiry, a paid transfer (fee or release clause) or a paid
 *   release. Free agents cost no fee.
 */
import { Rng } from '../rng/prng';
import { dayOf, toParts, type Day } from './calendar';
import { toOvr } from './ratings';
import { ageOn, type Archetype, type Backer, type CareerMotives, type Contract, type LedgerKind, type Org, type OrgFinance, type Player, type Region, type Staff, type World } from './types';

// ---------------------------------------------------------------------------------------------
// Ledger

const LEDGER_KEEP_DAYS = 730;

/** The only way club cash changes. Keeps `org.money === ledgerOpening + sum(ledger)`. */
export function post(org: Org, day: Day, kind: LedgerKind, amount: number, memo: string): void {
  const a = Math.round(amount);
  if (a === 0) return;
  org.finance.ledger.push({ day, kind, amount: a, memo });
  org.money += a;
}

/** Folds entries older than the retention window into the opening balance (bounded memory). */
export function compactLedger(org: Org, day: Day): void {
  const f = org.finance;
  const cut = day - LEDGER_KEEP_DAYS;
  let i = 0;
  while (i < f.ledger.length && f.ledger[i]!.day < cut) f.ledgerOpening += f.ledger[i++]!.amount;
  if (i > 0) f.ledger.splice(0, i);
}

export const ledgerBalance = (org: Org): number => org.finance.ledgerOpening + org.finance.ledger.reduce((s, e) => s + e.amount, 0);

export function newFinance(archetype: Archetype, money: number): OrgFinance {
  return {
    prestige: PRESTIGE_START[archetype],
    backer: null,
    wageAmbition: WAGE_AMBITION[archetype],
    ledgerOpening: money,
    ledger: [],
    monthsInDebt: 0,
  };
}

const PRESTIGE_START: Record<Archetype, number> = { elite: 80, contender: 58, developing: 34, grassroots: 14 };
const WAGE_AMBITION: Record<Archetype, number> = { elite: 0.72, contender: 0.68, developing: 0.6, grassroots: 0.55 };

// ---------------------------------------------------------------------------------------------
// Personality

export function rollMotives(seed: string, playerId: string): CareerMotives {
  const r = Rng.fromSeed(`motives:${seed}:${playerId}`);
  const w = () => Math.round(Math.max(0.05, Math.min(1, r.normal(0.5, 0.2))) * 100) / 100;
  return { money: w(), winning: w(), playingTime: w(), prestige: w(), loyalty: w() };
}

// ---------------------------------------------------------------------------------------------
// Market value

/** OVR → monthly wage anchors calibrated to the brief's bands. */
const WAGE_ANCHORS: readonly [number, number][] = [
  [40, 0], [50, 500], [58, 1200], [64, 2200], [70, 3800], [75, 6500], [80, 11000], [85, 18000], [88, 26000], [90, 34000], [93, 48000], [96, 68000], [99, 95000],
];

function interp(anchors: readonly [number, number][], x: number): number {
  if (x <= anchors[0]![0]) return anchors[0]![1];
  for (let i = 1; i < anchors.length; i++) {
    const [x1, y1] = anchors[i]!;
    if (x <= x1) {
      const [x0, y0] = anchors[i - 1]!;
      // Geometric interpolation between positive anchors (wages grow multiplicatively).
      if (y0 > 0) return y0 * (y1 / y0) ** ((x - x0) / (x1 - x0));
      return y0 + ((x - x0) * (y1 - y0)) / (x1 - x0);
    }
  }
  const [xl, yl] = anchors[anchors.length - 1]!;
  return yl * 1.08 ** (x - xl);
}

/** Salary levels differ by scene: sponsor markets and living costs (design hypothesis). */
export const REGION_WAGE: Record<Region, number> = { EU: 1, AM: 0.88, AS: 0.58 };

export interface ValueFactor {
  readonly label: string;
  readonly mult: number;
}

export interface MarketValue {
  /** Monthly wage the open market would pay (USD). */
  readonly monthly: number;
  readonly factors: readonly ValueFactor[];
}

/** Demand is a market-level signal: computed once per player per day (deterministic call order). */
const demandMemo = new WeakMap<World, { day: Day; byPlayer: Map<string, number> }>();

/** Clubs that would want this player now: a starter in the same role group clearly worse, and wage room. */
export function interestedClubs(world: World, p: Player, day: Day): number {
  let memo = demandMemo.get(world);
  if (!memo || memo.day !== day) demandMemo.set(world, (memo = { day, byPlayer: new Map() }));
  const hit = memo.byPlayer.get(p.id);
  if (hit !== undefined) return hit;
  const n = countInterested(world, p, day);
  memo.byPlayer.set(p.id, n);
  return n;
}

function countInterested(world: World, p: Player, day: Day): number {
  let n = 0;
  for (const o of world.orgs.values()) {
    if (o.id === p.orgId || o.isUser) continue;
    const same = o.roster.map((id) => world.players.get(id)!).filter((x) => roleGroupOf(x) === roleGroupOf(p));
    const worst = same.length ? Math.min(...same.map((x) => x.skill)) : 0;
    if (worst > p.skill - 2) continue;
    if (wageRoom(world, o, day) < marketBase(p) * 0.6) continue;
    n++;
    if (n >= 8) break;
  }
  return n;
}

const roleGroupOf = (p: Player) => (p.role === 'AWPer' ? 'awp' : p.role === 'In-game leader' ? 'igl' : 'rifle');
const marketBase = (p: Player) => interp(WAGE_ANCHORS, toOvr(p.skill)) * REGION_WAGE[p.region];

export function marketValue(world: World, p: Player, day: Day, demand = interestedClubs(world, p, day)): MarketValue {
  const ovr = toOvr(p.skill);
  const pot = toOvr(p.potential);
  const age = ageOn(p, day);
  const base = interp(WAGE_ANCHORS, ovr);
  const factors: ValueFactor[] = [];
  const f = (label: string, mult: number) => {
    if (Math.abs(mult - 1) >= 0.01) factors.push({ label, mult: Math.round(mult * 100) / 100 });
  };
  f(`Scene (${p.region})`, REGION_WAGE[p.region]);
  if (age <= 23 && pot > ovr) f('Potential', Math.min(1.35, 1 + 0.012 * (pot - ovr)));
  f('Reputation', 0.85 + 0.3 * (p.reputation / 100));
  f(`Demand (${demand} interested club${demand === 1 ? '' : 's'})`, demand === 0 ? 0.9 : 1 + 0.04 * Math.min(5, demand));
  if (age >= 30) f('Age', Math.max(0.6, 1 - 0.06 * (age - 29)));
  if (p.role === 'AWPer') f('Role scarcity (AWPer)', 1.1);
  if (p.role === 'In-game leader') f('Role scarcity (IGL)', 1.06);
  f('Financial ambition', 0.9 + 0.2 * p.motives.money);
  const monthly = factors.reduce((v, x) => v * x.mult, base);
  return { monthly: roundWage(monthly), factors: [{ label: `Ability (OVR ${ovr})`, mult: Math.round(base) }, ...factors] };
}

const roundWage = (x: number) => (x < 1000 ? Math.round(x / 50) * 50 : Math.round(x / 250) * 250);

// ---------------------------------------------------------------------------------------------
// Club economics

/** Expected monthly sponsor, content and merchandise revenue (USD) from prestige and scene. */
export function monthlyRevenue(org: Org): number {
  const pr = org.finance.prestige / 100;
  return Math.round((4000 + 520_000 * pr ** 2.4) * REGION_WAGE[org.homeRegion] / 100) * 100;
}

export const staffMonthly = (s: Staff): number =>
  roundWage(s.role === 'coach' ? 800 + 260 * Math.max(0, (s.development + s.preparation + s.reading + s.adaptation) / 4 - 25) : 500 + 70 * Math.max(0, (s.judging + s.potentialEye + s.reach) / 3 - 25));

export const playerPayroll = (world: World, org: Org): number =>
  [...org.roster, ...org.bench].reduce((s, id) => s + (world.players.get(id)?.contract?.monthly ?? 0), 0);

export const staffPayroll = (world: World, org: Org): number => org.staff.reduce((s, id) => s + (world.staff.get(id) ? staffMonthly(world.staff.get(id)!) : 0), 0);

const backerActive = (org: Org, day: Day): Backer | null => (org.finance.backer && org.finance.backer.untilDay > day ? org.finance.backer : null);

/**
 * Monthly wage bill the club can sustain: its ambition share of revenue, explicit backing, and
 * savings spread over three years. Debt removes the savings term.
 */
export function wageCapacity(world: World, org: Org, day: Day): number {
  const b = backerActive(org, day);
  const savings = Math.max(0, org.money - 3 * (playerPayroll(world, org) + staffPayroll(world, org))) / 36;
  return Math.round(monthlyRevenue(org) * org.finance.wageAmbition + (b?.monthlyCap ?? 0) * 0.9 + savings - staffPayroll(world, org));
}

export const wageRoom = (world: World, org: Org, day: Day): number => wageCapacity(world, org, day) - playerPayroll(world, org);

export type FinancialState = 'healthy' | 'stretched' | 'distressed';

export function financialState(world: World, org: Org, day: Day): FinancialState {
  if (org.money < 0 && org.finance.monthsInDebt >= 2) return 'distressed';
  if (org.money < 0 || wageRoom(world, org, day) < 0) return 'stretched';
  return 'healthy';
}

// ---------------------------------------------------------------------------------------------
// Contracts

/** Roster windows open on 1 January and 1 July; contracts end on one. */
export function windowAfter(day: Day, months: number): Day {
  const p = toParts(day);
  const total = p.season * 12 + p.month + months; // months since season 0, January
  const season = Math.floor(total / 12);
  const month = total % 12 < 6 ? 0 : 6;
  return dayOf(season, month, 1);
}

export function remainingMonths(c: Contract, day: Day): number {
  return Math.max(0, Math.round((c.endDay - day) / 30.4));
}

/** Contract length a deal settles on (years): clubs lock up prospects; rising players prefer short deals; veterans get one year. */
export function preferredYears(p: Player, day: Day): number {
  const age = ageOn(p, day);
  if (age <= 21) return 3;
  if (age >= 30) return 1;
  return p.potential - p.skill > 4 ? 2 : age <= 26 ? 3 : 2;
}

/** Fee a selling club accepts for a contracted player: owed wages plus the value they lose. */
export function transferFee(world: World, p: Player, day: Day): number {
  const c = p.contract;
  if (!c) return 0;
  const months = remainingMonths(c, day);
  const v = marketValue(world, p, day).monthly;
  const premium = Math.max(0, v - c.monthly) * Math.min(months, 24);
  const fee = Math.round((c.monthly * months * 0.6 + premium + v * 6) / 5000) * 5000;
  return c.buyout !== null ? Math.min(fee, c.buyout) : fee;
}

/** Cost of releasing a player early (settling half of the remaining wages). */
export const terminationCost = (p: Player, day: Day): number => (p.contract ? Math.round(p.contract.monthly * remainingMonths(p.contract, day) * 0.5) : 0);

// ---------------------------------------------------------------------------------------------
// Negotiation

export interface Offer {
  readonly monthly: number;
  readonly signingBonus: number;
  readonly years: number;
  readonly status: Contract['status'];
  readonly prizeShare: number;
}

export interface Assessment {
  /** Utility of the offer to the player; accepted when ≥ 0. */
  readonly utility: number;
  readonly accept: boolean;
  /** Monthly wage at which the player would accept this offer's other terms. */
  readonly requiredMonthly: number;
  /** Plain-English motives (most important first). */
  readonly reasons: readonly string[];
}

/** 0–1 chance the club can realistically win titles soon (from prestige and current level). */
const titlePath = (world: World, org: Org): number => {
  const xs = org.roster.map((id) => world.players.get(id)?.skill ?? 40);
  const avg = xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
  return Math.max(0, Math.min(1, (avg - 70) / 16)) * 0.7 + (org.finance.prestige / 100) * 0.3;
};

/**
 * How the player values an offer. Money matters on a log scale (doubling an offer is worth the same
 * at any level); career factors are weighed by the player's own motives. Deterministic.
 */
export function assessOffer(world: World, p: Player, org: Org, offer: Offer, day: Day): Assessment {
  const value = marketValue(world, p, day);
  const current = p.orgId ? world.orgs.get(p.orgId) ?? null : null;
  const staying = current?.id === org.id;
  // Leverage: in demand → asks above value; under contract elsewhere → needs a raise to move.
  const demand = interestedClubs(world, p, day);
  const ask = value.monthly * (demand >= 3 ? 1.08 : demand === 0 ? 0.9 : 1) * (p.contract && !staying ? 1.1 : 1);
  const bonusPerMonth = offer.signingBonus / Math.max(6, offer.years * 12);
  const pay = offer.monthly + bonusPerMonth;
  const m = p.motives;
  const terms: { label: string; v: number }[] = [];
  const money = Math.log(Math.max(1, pay) / Math.max(1, ask)) * (0.4 + 0.8 * m.money);
  terms.push({ label: pay >= ask ? 'pays at or above his market value' : 'pays below his market value', v: money });
  const fromPrestige = current ? current.finance.prestige : 30;
  const prestige = ((org.finance.prestige - fromPrestige) / 100) * (0.2 + 0.8 * m.prestige);
  terms.push({ label: prestige >= 0 ? 'a step up in prestige' : 'a step down in prestige', v: prestige });
  const playing = (offer.status === 'starter' ? 0.12 : offer.status === 'prospect' ? -0.05 : -0.3) * (0.3 + 1.2 * m.playingTime);
  terms.push({ label: offer.status === 'starter' ? 'a starting role' : 'no guaranteed starting role', v: playing });
  const winning = (titlePath(world, org) - (current ? titlePath(world, current) : 0.1)) * 0.5 * (0.2 + 0.8 * m.winning);
  terms.push({ label: winning >= 0 ? 'a better path to titles' : 'a weaker path to titles', v: winning });
  const loyalty = (staying ? 0.08 : 0) * m.loyalty + (org.homeRegion === p.region ? 0.04 : -0.06) * (0.4 + m.loyalty);
  terms.push({ label: staying ? 'loyalty to his club' : org.homeRegion === p.region ? 'stays in his home scene' : 'moving abroad', v: loyalty });
  const share = (offer.prizeShare - 0.15) * 0.4 * m.money;
  terms.push({ label: 'prize-money share', v: share });
  const utility = terms.reduce((s, t) => s + t.v, 0);
  const career = utility - money;
  const requiredPay = ask * Math.exp(-career / (0.4 + 0.8 * m.money));
  const reasons = terms
    .filter((t) => Math.abs(t.v) >= 0.02)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .map((t) => `${t.v >= 0 ? '+' : '−'} ${t.label}`);
  return { utility, accept: utility >= 0, requiredMonthly: roundWage(Math.max(0, requiredPay - bonusPerMonth)), reasons };
}

export interface Negotiation {
  readonly ok: boolean;
  readonly offer: Offer | null;
  readonly rounds: readonly string[];
}

/**
 * A club negotiates with a player. The club opens at what it believes the player is worth to it
 * (never above its wage room), the player counters at the wage that makes the move worth it, and
 * the club closes the gap with wages or a one-off signing bonus if it can, else walks away.
 */
export function negotiate(world: World, org: Org, p: Player, day: Day, status: Contract['status'], importance = 1): Negotiation {
  const rounds: string[] = [];
  const value = marketValue(world, p, day).monthly;
  const room = Math.max(0, wageRoom(world, org, day) + (p.orgId === org.id ? p.contract?.monthly ?? 0 : 0));
  // What the player is worth to this club: their market value, more if they fill an urgent need.
  const ceiling = Math.min(room, roundWage(value * Math.min(1.35, 0.9 + 0.25 * importance)));
  if (ceiling < Math.min(value * 0.5, 300)) {
    rounds.push(`${org.name} cannot fit ${p.nickname}'s wages (room $${room.toLocaleString('en-US')}/month)`);
    return { ok: false, offer: null, rounds };
  }
  const years = preferredYears(p, day);
  const prizeShare = org.finance.prestige >= 60 ? 0.1 : 0.2; // smaller clubs share more of their prizes
  let offer: Offer = { monthly: roundWage(Math.min(ceiling, value * 0.92)), signingBonus: 0, years, status, prizeShare };
  rounds.push(`${org.name} offers $${offer.monthly.toLocaleString('en-US')}/month for ${years} year${years > 1 ? 's' : ''} (${status})`);
  let a = assessOffer(world, p, org, offer, day);
  if (a.accept) {
    rounds.push(`${p.nickname} accepts: ${a.reasons.slice(0, 2).join(', ')}`);
    return { ok: true, offer, rounds };
  }
  rounds.push(`${p.nickname} asks for $${a.requiredMonthly.toLocaleString('en-US')}/month (${a.reasons.slice(0, 2).join(', ')})`);
  if (a.requiredMonthly <= ceiling) {
    offer = { ...offer, monthly: a.requiredMonthly };
    rounds.push(`${org.name} agrees`);
    return { ok: true, offer, rounds };
  }
  // Bridge with a signing bonus from cash (a richer club can front-load what wages can't carry).
  const gap = a.requiredMonthly - ceiling;
  const bonus = Math.round((gap * years * 12) / 1000) * 1000;
  if (bonus <= Math.max(0, org.money) * 0.15) {
    offer = { ...offer, monthly: ceiling, signingBonus: bonus };
    a = assessOffer(world, p, org, offer, day);
    if (a.accept) {
      rounds.push(`${org.name} meets him with a $${bonus.toLocaleString('en-US')} signing bonus`);
      return { ok: true, offer, rounds };
    }
  }
  rounds.push(`${org.name} walks away: $${a.requiredMonthly.toLocaleString('en-US')}/month is beyond its $${ceiling.toLocaleString('en-US')} limit`);
  return { ok: false, offer: null, rounds };
}

/** Writes a signed deal: contract, signing bonus through the ledger. */
export function signContract(world: World, org: Org, p: Player, offer: Offer, day: Day): Contract {
  const c: Contract = {
    orgId: org.id, monthly: offer.monthly, startDay: day, endDay: windowAfter(day, offer.years * 12), signingBonus: offer.signingBonus,
    buyout: offer.status === 'prospect' || org.finance.prestige < 40 ? roundWage(marketValue(world, p, day).monthly * 30) : null,
    prizeShare: offer.prizeShare, status: offer.status,
  };
  p.contract = c;
  if (offer.signingBonus > 0) {
    post(org, day, 'signing_bonus', -offer.signingBonus, `Signing bonus: ${p.nickname}`);
    p.careerEarnings += offer.signingBonus;
  }
  return c;
}

// ---------------------------------------------------------------------------------------------
// World set-up and migration

/**
 * Gives every signed player a contract that reflects the market at world start (with natural
 * variation in when it was signed, so some players are underpaid and some overpaid), assigns
 * prestige and explicit backers, and opens the ledger. Also migrates worlds saved before contracts
 * existed. Idempotent for players that already have a contract.
 */
export function initContracts(world: World, day: Day): void {
  const r = Rng.fromSeed(`contracts:${world.seed}`);
  for (const o of [...world.orgs.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    // Some clubs are explicitly bankrolled: elite owners, or investors building a contender.
    if (!o.finance.backer && (o.archetype === 'elite' ? r.chance(0.35) : o.archetype === 'contender' ? r.chance(0.15) : r.chance(0.04))) {
      const kind = o.archetype === 'elite' ? 'owner' : 'investor';
      const cap = Math.round(r.range(o.archetype === 'elite' ? 120_000 : 60_000, o.archetype === 'elite' ? 400_000 : 220_000) / 10_000) * 10_000;
      o.finance.backer = { name: kind === 'owner' ? `${o.name} ownership group` : `${o.name} investor consortium`, kind, monthlyCap: cap, untilDay: day + r.int(2, 5) * 365 };
    }
  }
  for (const p of [...world.players.values()].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (p.reputation === 0) p.reputation = Math.round(Math.max(5, Math.min(95, toOvr(p.skill) - 15 + (p.orgId ? world.orgs.get(p.orgId)!.finance.prestige * 0.2 : 0))));
    if (!p.orgId || p.contract || p.retired) continue;
    const o = world.orgs.get(p.orgId)!;
    const v = marketValue(world, p, day, 1).monthly;
    // Signed earlier at a different market: young risers are often underpaid, veterans overpaid.
    const age = ageOn(p, day);
    const drift = age <= 22 ? r.range(0.45, 0.9) : age >= 29 ? r.range(0.95, 1.35) : r.range(0.75, 1.15);
    const yearsLeft = r.int(1, 4) / 2;
    p.contract = {
      orgId: o.id, monthly: roundWage(v * drift), startDay: Math.min(p.joinedDay, day), endDay: windowAfter(day, Math.round(yearsLeft * 12)),
      signingBonus: 0, buyout: o.finance.prestige < 40 ? roundWage(v * 30) : null, prizeShare: o.finance.prestige >= 60 ? 0.1 : 0.2,
      status: o.roster.includes(p.id) ? 'starter' : 'rotation',
    };
  }
  for (const o of world.orgs.values()) if (o.finance.ledger.length === 0) o.finance.ledgerOpening = o.money;
}

/**
 * Reputation follows ability shown on a stage: OVR, plus the standing of the player's club.
 * Updated at each full roster window; moves slowly.
 */
export function updateReputation(world: World, day: Day, rankOf: (orgId: string) => number): void {
  for (const p of world.players.values()) {
    if (p.retired) continue;
    const rank = p.orgId ? rankOf(p.orgId) : 999;
    const stage = rank <= 10 ? 15 : rank <= 30 ? 10 : rank <= 80 ? 5 : 0;
    const target = Math.max(0, Math.min(100, toOvr(p.skill) - 18 + stage));
    p.reputation = Math.round(0.6 * p.reputation + 0.4 * target);
  }
}

// ---------------------------------------------------------------------------------------------
// Forecasts (GM view)

export interface ForecastMonth {
  readonly day: Day;
  readonly revenue: number;
  readonly payroll: number;
  readonly staff: number;
  readonly subsidy: number;
  readonly cash: number;
}

export interface FinancialForecast {
  readonly monthlyPayroll: number;
  /** Wage commitments by season still owed under current contracts. */
  readonly commitmentsBySeason: readonly { readonly season: number; readonly amount: number }[];
  /** Transfer fees paid (negative) and received over the last 12 months. */
  readonly transfers12m: { readonly paid: number; readonly received: number };
  readonly months: readonly ForecastMonth[];
  readonly expiring: readonly { readonly playerId: string; readonly nickname: string; readonly endDay: Day; readonly monthly: number; readonly value: number }[];
  readonly state: FinancialState;
}

/**
 * Projection under current contracts (no new signings, no prize money): revenue at today's prestige,
 * contracted wages month by month (dropping as deals expire), staff wages and capped backing.
 */
export function financialForecast(world: World, org: Org, day: Day, months = 24): FinancialForecast {
  const players = [...org.roster, ...org.bench].map((id) => world.players.get(id)!).filter((p) => p.contract);
  const staff = staffPayroll(world, org);
  const revenue = monthlyRevenue(org);
  const out: ForecastMonth[] = [];
  let cash = org.money;
  for (let i = 1; i <= months; i++) {
    const d = day + Math.round(i * 30.4);
    const payroll = players.reduce((s, p) => s + (p.contract!.endDay > d ? p.contract!.monthly : 0), 0);
    const net = revenue - payroll - staff;
    const b = org.finance.backer;
    const subsidy = b && b.untilDay > d && net < 0 ? Math.min(b.monthlyCap, -net) : 0;
    cash += net + subsidy;
    out.push({ day: d, revenue, payroll, staff, subsidy, cash: Math.round(cash) });
  }
  const bySeason = new Map<number, number>();
  for (const p of players) {
    for (let d = day; d < p.contract!.endDay; d += 30.4) {
      const s = toParts(Math.round(d)).season;
      bySeason.set(s, (bySeason.get(s) ?? 0) + p.contract!.monthly);
    }
  }
  const recent = org.finance.ledger.filter((e) => e.day > day - 365);
  return {
    monthlyPayroll: players.reduce((s, p) => s + p.contract!.monthly, 0),
    commitmentsBySeason: [...bySeason].sort((a, b) => a[0] - b[0]).map(([season, amount]) => ({ season, amount: Math.round(amount) })),
    transfers12m: { paid: -recent.filter((e) => e.kind === 'transfer_in').reduce((s, e) => s + e.amount, 0), received: recent.filter((e) => e.kind === 'transfer_out').reduce((s, e) => s + e.amount, 0) },
    months: out,
    expiring: players
      .sort((a, b) => a.contract!.endDay - b.contract!.endDay)
      .map((p) => ({ playerId: p.id, nickname: p.nickname, endDay: p.contract!.endDay, monthly: p.contract!.monthly, value: marketValue(world, p, day).monthly })),
    state: financialState(world, org, day),
  };
}
