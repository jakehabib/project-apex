/**
 * Deterministic world generation: organisations, rosters and free agents across
 * three competitive regions. Hand-authored "featured" clubs (with portrait art)
 * are passed in by the caller and placed first; the rest is generated.
 */
import { Rng } from '../rng/prng';
import { NAMES, NATIONS, NICK_PARTS, ORG_FIRST, ORG_SUFFIX, type Nation } from './names';
import { REGIONS, type Archetype, type Org, type Player, type PlayerRole, type Region, type World } from './types';

export const WORLD_VERSION = 1;

export interface FeaturedTeam {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly region: string;
  readonly archetype?: Archetype;
}
export interface FeaturedPlayer {
  readonly id: string;
  readonly team: string;
  readonly name: string;
  readonly nickname: string;
  readonly nationality: string;
  readonly age: number;
  readonly role: string;
}

export interface WorldSpec {
  readonly seed: string;
  /** Organisations per region, featured clubs included. */
  readonly orgsPerRegion?: Partial<Record<Region, number>>;
  readonly freeAgents?: number;
  readonly featured?: { readonly teams: readonly FeaturedTeam[]; readonly players: readonly FeaturedPlayer[] };
}

const DEFAULT_ORGS: Record<Region, number> = { EU: 64, AM: 40, AS: 32 };

/** Share of each region's clubs per archetype, strongest first. */
const ARCHETYPE_SHARE: Record<Region, readonly [Archetype, number][]> = {
  EU: [['elite', 0.1], ['contender', 0.2], ['developing', 0.34], ['grassroots', 0.36]],
  AM: [['elite', 0.075], ['contender', 0.175], ['developing', 0.35], ['grassroots', 0.4]],
  AS: [['elite', 0.0625], ['contender', 0.16], ['developing', 0.34], ['grassroots', 0.4375]],
};

/** Mean player skill by archetype (individual players vary around it). */
const SKILL_BASE: Record<Archetype, [number, number]> = {
  elite: [79, 86],
  contender: [72, 79],
  developing: [63, 72],
  grassroots: [52, 63],
};
/** Regional depth: Europe is the strongest scene, Asia the youngest. */
const REGION_SKILL: Record<Region, number> = { EU: 0, AM: -1.5, AS: -3.5 };
const MONEY: Record<Archetype, number> = { elite: 3_000_000, contender: 1_200_000, developing: 400_000, grassroots: 120_000 };

const ROLES_CORE: readonly PlayerRole[] = ['AWPer', 'In-game leader', 'Star rifler', 'Entry fragger'];
const ROLES_FLEX: readonly PlayerRole[] = ['Anchor', 'Support', 'Lurker'];

function regionOf(label: string): Region {
  const l = label.toLowerCase();
  if (l.includes('america')) return 'AM';
  if (l.includes('asia') || l.includes('oceania') || l.includes('pacific')) return 'AS';
  return 'EU';
}

export function nationByName(name: string): Nation | undefined {
  return NATIONS.find((n) => n.name === name);
}

export function generateWorld(spec: WorldSpec): World {
  const rng = Rng.fromSeed(`world:${spec.seed}`);
  const players = new Map<string, Player>();
  const orgs = new Map<string, Org>();
  const usedNicks = new Set<string>();
  const usedOrgNames = new Set<string>();
  const usedTags = new Set<string>();
  let seq = 1;

  const nick = (r: Rng): string => {
    for (let i = 0; i < 50; i++) {
      const a = r.pick(NICK_PARTS);
      const cand = i < 10 ? a : i < 30 ? `${a}${r.pick(['', 'x', 'y', 'o', 'z'])}` : `${a}${r.pick(NICK_PARTS).slice(0, 2)}`;
      if (!usedNicks.has(cand)) {
        usedNicks.add(cand);
        return cand;
      }
    }
    const c = `${r.pick(NICK_PARTS)}${seq}`;
    usedNicks.add(c);
    return c;
  };

  const pickNation = (r: Rng, region: Region): Nation => {
    const pool = NATIONS.filter((n) => n.region === region);
    return r.weighted(pool, pool.map((n) => n.weight));
  };

  const makePlayer = (r: Rng, nation: Nation, skill: number, role: PlayerRole, orgId: string | null): Player => {
    const names = NAMES[nation.culture];
    const age = r.int(17, 31);
    const p: Player = {
      id: `g${String(seq++).padStart(4, '0')}`,
      name: `${r.pick(names.first)} ${r.pick(names.last)}`,
      nickname: nick(r),
      nationality: nation.name,
      region: nation.region,
      role,
      bornDay: -age * 365 - r.int(0, 364),
      skill: Math.round(Math.max(35, Math.min(95, skill)) * 10) / 10,
      potential: 0,
      orgId,
      joinedDay: -r.int(30, 900),
      retired: false,
    };
    // Younger players have more headroom.
    p.potential = Math.round(Math.min(97, p.skill + Math.max(0, (24 - age) * r.range(0.8, 2.2)) + r.range(0, 4)) * 10) / 10;
    players.set(p.id, p);
    return p;
  };

  const orgName = (r: Rng): string => {
    for (let i = 0; i < 400; i++) {
      const n = `${r.pick(ORG_FIRST)}${r.pick(ORG_SUFFIX)}`;
      const base = n.replace(/ (Esports|Gaming|Club|Collective|Team)$/, '');
      if (!usedOrgNames.has(base)) {
        usedOrgNames.add(base);
        return n;
      }
    }
    throw new Error('ran out of organisation names');
  };
  const tagFor = (name: string): string => {
    const words = name.replace(/ (Esports|Gaming|Club|Collective|Team)$/, '').split(/\s+/);
    const cands = [
      words.length > 1 ? words.map((w) => w[0]).join('').toUpperCase() : '',
      words[0]!.slice(0, 3).toUpperCase(),
      (words[0]!.slice(0, 2) + (words[1]?.[0] ?? words[0]!.slice(-1))).toUpperCase(),
      words[0]!.slice(0, 4).toUpperCase(),
    ].filter((c) => c.length >= 2);
    for (const c of cands) if (!usedTags.has(c)) return usedTags.add(c), c;
    for (let i = 2; ; i++) {
      const c = `${cands[0]}${i}`;
      if (!usedTags.has(c)) return usedTags.add(c), c;
    }
  };

  // Featured clubs first.
  const featuredByRegion: Record<Region, Org[]> = { EU: [], AM: [], AS: [] };
  for (const t of spec.featured?.teams ?? []) {
    const homeRegion = regionOf(t.region);
    const archetype = t.archetype ?? 'contender';
    usedOrgNames.add(t.name);
    usedTags.add(t.tag);
    const org: Org = { id: t.id, name: t.name, tag: t.tag, homeRegion, archetype, money: MONEY[archetype], roster: [], bench: [], isUser: false };
    orgs.set(org.id, org);
    featuredByRegion[homeRegion].push(org);
    const r = rng.fork(`featured:${t.id}`);
    const [lo, hi] = SKILL_BASE[archetype];
    const base = r.range(lo, hi);
    for (const fp of (spec.featured?.players ?? []).filter((x) => x.team === t.id)) {
      const nation = nationByName(fp.nationality) ?? pickNation(r, homeRegion);
      usedNicks.add(fp.nickname);
      const skill = base + r.normal(0, 3) + (fp.role === 'Star rifler' || fp.role === 'AWPer' ? 2.5 : 0);
      const p: Player = {
        id: fp.id, name: fp.name, nickname: fp.nickname, nationality: nation.name, region: nation.region,
        role: (fp.role as PlayerRole) ?? 'Support', bornDay: -fp.age * 365 - r.int(0, 364),
        skill: Math.round(Math.max(35, Math.min(95, skill)) * 10) / 10, potential: 0, orgId: org.id, joinedDay: -r.int(120, 900), retired: false,
      };
      p.potential = Math.round(Math.min(97, p.skill + Math.max(0, (24 - fp.age) * 1.4) + 1) * 10) / 10;
      players.set(p.id, p);
      org.roster.push(p.id);
    }
  }

  // Generated clubs.
  for (const region of REGIONS) {
    const total = spec.orgsPerRegion?.[region] ?? DEFAULT_ORGS[region];
    const r = rng.fork(`region:${region}`);
    const slots: Archetype[] = [];
    for (const [arch, share] of ARCHETYPE_SHARE[region]) for (let i = 0; i < Math.round(share * total); i++) slots.push(arch);
    while (slots.length < total) slots.push('grassroots');
    slots.length = total;
    // Featured clubs consume a slot of their archetype.
    for (const f of featuredByRegion[region]) {
      const i = slots.indexOf(f.archetype);
      slots.splice(i >= 0 ? i : slots.length - 1, 1);
    }
    for (const archetype of slots) {
      const name = orgName(r);
      const id = `o${String(orgs.size + 1).padStart(3, '0')}`;
      const org: Org = { id, name, tag: tagFor(name), homeRegion: region, archetype, money: Math.round(MONEY[archetype] * r.range(0.7, 1.3)), roster: [], bench: [], isUser: false };
      orgs.set(id, org);
      const [lo, hi] = SKILL_BASE[archetype];
      const base = r.range(lo, hi) + REGION_SKILL[region];
      // Most rosters are local; some are international, a few are mostly from another region.
      const style = r.weighted(['local', 'mixed', 'foreign'] as const, [0.8, 0.16, 0.04]);
      const foreign = r.pick(REGIONS.filter((x) => x !== region));
      const roles = [...ROLES_CORE, r.pick(ROLES_FLEX)];
      // One shared nation for most of a local roster (teams cluster by language).
      const homeNation = pickNation(r, region);
      for (let k = 0; k < 5; k++) {
        const playerRegion = style === 'foreign' && k < 3 ? foreign : style === 'mixed' && k === 4 ? foreign : region;
        const nation = playerRegion === region && r.chance(0.65) ? homeNation : pickNation(r, playerRegion);
        const skill = base + r.normal(0, 3.2) + (roles[k] === 'Star rifler' || roles[k] === 'AWPer' ? 2.5 : 0);
        org.roster.push(makePlayer(r, nation, skill, roles[k]!, id).id);
      }
    }
  }

  // Free agents and prospects.
  const fr = rng.fork('free-agents');
  for (let i = 0; i < (spec.freeAgents ?? 140); i++) {
    const region = fr.weighted(REGIONS, [0.45, 0.32, 0.23]);
    makePlayer(fr, pickNation(fr, region), fr.range(45, 74), fr.pick([...ROLES_CORE, ...ROLES_FLEX]), null);
  }

  return { seed: spec.seed, version: WORLD_VERSION, day: 0, players, orgs, nextPlayerSeq: seq };
}
