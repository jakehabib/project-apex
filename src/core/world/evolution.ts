/**
 * World evolution between competitions: ageing and development, retirements,
 * new prospects, simple finances and AI roster moves. v1: the full attribute,
 * coach and scouting model replaces `develop` later (see HANDOFF backlog);
 * no training grind, fatigue or injuries by design.
 */
import type { Rng } from '../rng/prng';
import type { Day } from './calendar';
import { NATIONS, NAMES, NICK_PARTS } from './names';
import { ageOn, REGIONS, type Archetype, type Org, type Player, type PlayerRole, type World } from './types';

const ROLES: readonly PlayerRole[] = ['AWPer', 'In-game leader', 'Star rifler', 'Entry fragger', 'Anchor', 'Support', 'Lurker'];

/** Development for a fraction of a year (1 = full year). Young players grow toward potential; veterans decline. */
export function develop(world: World, rng: Rng, day: Day, fraction: number): void {
  for (const p of world.players.values()) {
    if (p.retired) continue;
    const age = ageOn(p, day);
    const gap = Math.max(0, p.potential - p.skill);
    let delta: number;
    // Growth closes part of the gap to potential each year, capped: even prodigies take seasons to peak.
    if (age <= 21) delta = Math.min(6, gap * rng.range(0.12, 0.28));
    else if (age <= 24) delta = Math.min(4, gap * rng.range(0.08, 0.22));
    else if (age <= 27) delta = rng.normal(0.2, 0.8);
    else if (age <= 30) delta = rng.normal(-0.9, 0.9);
    else delta = rng.normal(-2.4, 1.1);
    p.skill = Math.round(Math.max(30, Math.min(p.potential, p.skill + delta * fraction)) * 10) / 10;
    if (age > 27) p.potential = Math.max(p.skill, p.potential - 0.5 * fraction);
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
    const skill = rng.range(42, 62);
    let nick = rng.pick(NICK_PARTS);
    for (let k = 0; used.has(nick) && k < 20; k++) nick = `${rng.pick(NICK_PARTS)}${rng.pick(NICK_PARTS).slice(0, 2)}`;
    if (used.has(nick)) nick = `${nick}${world.nextPlayerSeq}`;
    used.add(nick);
    const p: Player = {
      id: `g${String(world.nextPlayerSeq++).padStart(4, '0')}`,
      name: `${rng.pick(names.first)} ${rng.pick(names.last)}`,
      nickname: nick,
      nationality: nation.name,
      region: nation.region,
      role: rng.pick(ROLES),
      bornDay: day - age * 365 - rng.int(0, 364),
      skill: Math.round(skill * 10) / 10,
      potential: Math.round(Math.min(96, gem ? rng.range(84, 95) : skill + rng.range(4, 24)) * 10) / 10,
      orgId: null,
      joinedDay: day,
      retired: false,
    };
    world.players.set(p.id, p);
  }
}

/** Yearly salary for a player of this skill (USD). */
export const salaryFor = (skill: number): number => Math.round((8000 + 32 * Math.max(0, skill - 40) ** 2) / 1000) * 1000;
/** Transfer fee to buy a contracted player. */
export const feeFor = (p: Player, day: Day): number => Math.round((salaryFor(p.skill) * (ageOn(p, day) < 24 ? 1.6 : 1.1)) / 1000) * 1000;

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
}

export interface RosterPolicy {
  /** Max changes allowed for this org this window (continuity protection). */
  readonly maxChanges: (org: Org) => number;
  /** Org wants a full rebuild (3+ changes) this window. */
  readonly rebuild: (org: Org) => boolean;
  /** Relative standing used to decide who can buy from whom (lower = stronger). */
  readonly level: (org: Org) => number;
}

/**
 * AI roster window. Clubs fill empty slots, then try to upgrade their weakest
 * players from free agency or from weaker clubs they can afford, within the
 * policy's continuity limit. Returns the moves for the news feed and tests.
 */
export function rosterWindow(world: World, rng: Rng, day: Day, policy: RosterPolicy): RosterMove[] {
  const moves: RosterMove[] = [];
  const orgs = [...world.orgs.values()].filter((o) => !o.isUser).sort((a, b) => policy.level(a) - policy.level(b) || (a.id < b.id ? -1 : 1));
  const freeAgents = () => [...world.players.values()].filter((p) => !p.retired && !p.orgId);
  const sign = (org: Org, p: Player, outId: string | null, fee: number, from: Org | null, reason: string) => {
    if (outId) {
      org.roster = org.roster.filter((x) => x !== outId);
      // Dropped starters are benched (still paid, transfer-listed) while the club can carry them; else released.
      if (org.bench.length < 2 && org.money > salaryFor(world.players.get(outId)!.skill)) org.bench.push(outId);
      else world.players.get(outId)!.orgId = null;
    }
    if (from) {
      from.roster = from.roster.filter((x) => x !== p.id);
      from.bench = from.bench.filter((x) => x !== p.id);
      from.money += fee;
    }
    org.money -= fee;
    p.orgId = org.id;
    p.joinedDay = day;
    org.bench = org.bench.filter((x) => x !== p.id);
    org.roster.push(p.id);
    moves.push({ day, orgId: org.id, inId: p.id, outId, fromOrgId: from?.id ?? null, fee, reason });
  };
  const fill = (org: Org) => {
    while (org.roster.length < 5 && org.bench.length > 0) {
      const b = org.bench.map((id) => world.players.get(id)!).sort((x, y) => y.skill - x.skill)[0]!;
      org.bench = org.bench.filter((x) => x !== b.id);
      org.roster.push(b.id);
      moves.push({ day, orgId: org.id, inId: b.id, outId: null, fromOrgId: null, fee: 0, reason: 'Promoted from the bench' });
    }
    while (org.roster.length < 5) {
      const fa = freeAgents().sort((a, b) => b.skill - a.skill || (a.id < b.id ? -1 : 1));
      const pick = fa.find((p) => salaryFor(p.skill) <= Math.max(60_000, org.money * 0.25)) ?? fa[fa.length - 1];
      if (!pick) break;
      sign(org, pick, null, 0, null, 'Filled an empty roster spot');
    }
  };
  for (const org of orgs) fill(org);
  for (const org of orgs) {
    const rebuild = policy.rebuild(org);
    const limit = rebuild ? 3 : policy.maxChanges(org);
    let changes = 0;
    const tried = new Set<string>();
    while (changes < limit) {
      const need = assessNeed(world, org, day, rebuild, rng, tried);
      if (!need) break;
      tried.add(need.out.id);
      const myLevel = policy.level(org);
      const budget = org.money * 0.4;
      const pool = [
        ...freeAgents().map((p) => ({ p, from: null as Org | null, fee: 0 })),
        ...[...world.orgs.values()]
          .filter((o) => o.id !== org.id && !o.isUser && policy.level(o) > myLevel)
          // Clubs don't sell players they only just signed.
          .flatMap((o) => o.roster.filter((id) => day - world.players.get(id)!.joinedDay >= 180).map((id) => ({ p: world.players.get(id)!, from: o, fee: feeFor(world.players.get(id)!, day) }))),
        // Transfer-listed bench players from any club, at a discount.
        ...[...world.orgs.values()]
          .filter((o) => o.id !== org.id)
          .flatMap((o) => o.bench.map((id) => ({ p: world.players.get(id)!, from: o, fee: Math.round(feeFor(world.players.get(id)!, day) * 0.5) }))),
      ].filter((c) => roleGroup(c.p.role) === need.group && c.p.skill >= need.minSkill && c.fee + salaryFor(c.p.skill) <= budget);
      if (pool.length === 0) continue;
      // Ambitious clubs buy the best; developing clubs weigh youth and upside.
      // Clubs recruit mostly within their own scene (language, visas, comms); only top clubs import freely.
      const home = org.homeRegion;
      const score = (c: (typeof pool)[number]) =>
        c.p.skill + (org.archetype === 'developing' || org.archetype === 'grassroots' ? 0.3 * (c.p.potential - c.p.skill) : 0) - c.fee / 200_000 + rng.range(0, 1.5) - (c.p.region === home ? 0 : org.archetype === 'elite' ? 2 : 6);
      const best = pool.sort((a, b) => score(b) - score(a) || (a.p.id < b.p.id ? -1 : 1))[0]!;
      sign(org, best.p, need.out.id, best.fee, best.from, need.reason);
      changes++;
      if (best.from) fill(best.from);
    }
  }
  for (const org of orgs) {
    fill(org);
    // Clubs that can't afford their bench release it.
    for (const id of [...org.bench]) {
      if (org.money < 4 * salaryFor(world.players.get(id)!.skill)) {
        org.bench = org.bench.filter((x) => x !== id);
        world.players.get(id)!.orgId = null;
        moves.push({ day, orgId: org.id, inId: id, outId: id, fromOrgId: null, fee: 0, reason: 'Released from the bench' });
      }
    }
  }
  return moves;
}

/** Monthly finances: salaries out, a small baseline income in (sponsors and content, v1). */
export function monthlyFinances(world: World): void {
  for (const org of world.orgs.values()) {
    const payroll = [...org.roster, ...org.bench].reduce((s, id) => s + salaryFor(world.players.get(id)?.skill ?? 40), 0) / 12;
    const income: Record<Archetype, number> = { elite: 140_000, contender: 70_000, developing: 28_000, grassroots: 12_000 };
    org.money += income[org.archetype] - payroll;
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
