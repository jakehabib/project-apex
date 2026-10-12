/**
 * Roster lineage: ranking history belongs to a competitive core of players,
 * not to an organisation's brand. A roster continues a lineage when it fields
 * at least `CONTINUITY_MIN` of the lineage's core players.
 *
 * Because two disjoint five-player rosters cannot both contain 3 of the same 5
 * players, at most one roster can ever continue a given lineage.
 */
import type { Day } from '../world/calendar';
import type { Org, Player, Region, World } from '../world/types';

export const CONTINUITY_MIN = 3;

export interface LineageChange {
  readonly day: Day;
  readonly orgId: string;
  readonly core: readonly string[];
  readonly note: string;
}

export interface Lineage {
  readonly id: string;
  /** Organisation currently fielding this lineage (null once ended). */
  orgId: string | null;
  /** The five players of the current core. */
  core: string[];
  readonly startedDay: Day;
  endedDay: Day | null;
  readonly history: LineageChange[];
}

export interface LineageRegistry {
  readonly lineages: Map<string, Lineage>;
  /** Org id -> active lineage id. */
  readonly activeByOrg: Map<string, string>;
  seq: number;
}

export const createRegistry = (): LineageRegistry => ({ lineages: new Map(), activeByOrg: new Map(), seq: 1 });

export const sharedCount = (a: readonly string[], b: readonly string[]): number => a.filter((x) => b.includes(x)).length;

function newLineage(reg: LineageRegistry, org: Org, day: Day, note: string): Lineage {
  const l: Lineage = { id: `L${String(reg.seq++).padStart(5, '0')}`, orgId: org.id, core: [...org.roster], startedDay: day, endedDay: null, history: [] };
  l.history.push({ day, orgId: org.id, core: [...org.roster], note });
  reg.lineages.set(l.id, l);
  reg.activeByOrg.set(org.id, l.id);
  return l;
}

function endLineage(reg: LineageRegistry, l: Lineage, day: Day, note: string): void {
  if (l.orgId) reg.activeByOrg.delete(l.orgId);
  l.history.push({ day, orgId: l.orgId ?? '', core: [...l.core], note });
  l.orgId = null;
  l.endedDay = day;
}

/**
 * Re-evaluates every organisation's lineage after roster changes on `day`.
 * Order: (1) orgs keeping ≥3 of their own core continue; (2) orgs that now field
 * ≥3 of another lineage's core inherit it (the core moved clubs); (3) the rest
 * start new lineages. Lineages nobody continues end.
 */
export function syncLineages(reg: LineageRegistry, world: World, day: Day): void {
  const orgs = [...world.orgs.values()].filter((o) => o.roster.length === 5).sort((a, b) => (a.id < b.id ? -1 : 1));
  const claimed = new Set<string>();
  const settled = new Set<string>();
  for (const org of orgs) {
    const lid = reg.activeByOrg.get(org.id);
    const l = lid ? reg.lineages.get(lid) : undefined;
    if (l && sharedCount(l.core, org.roster) >= CONTINUITY_MIN) {
      if (sharedCount(l.core, org.roster) < 5) l.history.push({ day, orgId: org.id, core: [...org.roster], note: `Roster change: ${sharedCount(l.core, org.roster)} of 5 core players retained` });
      l.core = [...org.roster];
      claimed.add(l.id);
      settled.add(org.id);
    }
  }
  // A core that moved clubs: the new club inherits the lineage (resolved before anything ends).
  for (const org of orgs) {
    if (settled.has(org.id)) continue;
    const l = [...reg.lineages.values()].find((x) => x.endedDay === null && !claimed.has(x.id) && sharedCount(x.core, org.roster) >= CONTINUITY_MIN);
    if (!l) continue;
    const own = reg.activeByOrg.get(org.id);
    if (own && own !== l.id) {
      const o = reg.lineages.get(own)!;
      if (!claimed.has(own)) endLineage(reg, o, day, `Lost continuity: only ${sharedCount(o.core, org.roster)} of 5 core players remain`);
    }
    if (l.orgId && reg.activeByOrg.get(l.orgId) === l.id) reg.activeByOrg.delete(l.orgId);
    l.history.push({ day, orgId: org.id, core: [...org.roster], note: `Core moved from ${l.orgId ?? 'free agency'} to ${org.id}` });
    l.orgId = org.id;
    l.core = [...org.roster];
    reg.activeByOrg.set(org.id, l.id);
    claimed.add(l.id);
    settled.add(org.id);
  }
  // Everyone else fields a new core.
  for (const org of orgs) {
    if (settled.has(org.id)) continue;
    const own = reg.activeByOrg.get(org.id);
    if (own && !claimed.has(own)) {
      const o = reg.lineages.get(own)!;
      endLineage(reg, o, day, `Lost continuity: only ${sharedCount(o.core, org.roster)} of 5 core players remain`);
    } else if (own) reg.activeByOrg.delete(org.id);
    newLineage(reg, org, day, own ? 'New core after roster rebuild' : 'New roster');
    settled.add(org.id);
  }
  // Lineages left without a roster end.
  for (const l of reg.lineages.values()) {
    if (l.endedDay !== null || claimed.has(l.id)) continue;
    if (l.orgId && settled.has(l.orgId) && reg.activeByOrg.get(l.orgId) === l.id) continue;
    // A club temporarily short of five players keeps its lineage while it holds ≥3 of the core.
    const holder = l.orgId ? world.orgs.get(l.orgId) : undefined;
    if (holder && reg.activeByOrg.get(holder.id) === l.id && sharedCount(l.core, holder.roster) >= CONTINUITY_MIN) continue;
    endLineage(reg, l, day, 'Roster disbanded');
  }
}

/** Competitive region of a roster: the region of at least 3 of its players, else the org's home region. */
export function rosterRegion(world: World, org: Org): Region {
  const counts: Record<Region, number> = { EU: 0, AM: 0, AS: 0 };
  for (const id of org.roster) {
    const p: Player | undefined = world.players.get(id);
    if (p) counts[p.region]++;
  }
  const best = (Object.keys(counts) as Region[]).sort((a, b) => counts[b] - counts[a])[0]!;
  return counts[best] >= 3 ? best : org.homeRegion;
}

/** Would `newRoster` keep `org`'s current lineage? Used to warn before transfers. */
export function continuityAfter(reg: LineageRegistry, org: Org, newRoster: readonly string[]): { keeps: boolean; retained: number } {
  const lid = reg.activeByOrg.get(org.id);
  if (!lid) return { keeps: false, retained: 0 };
  const retained = sharedCount(reg.lineages.get(lid)!.core, newRoster);
  return { keeps: retained >= CONTINUITY_MIN, retained };
}
