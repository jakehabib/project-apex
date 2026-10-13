/**
 * Attacking Team Director (the IGL) plus the attackers' squad and player behaviour.
 *
 * The director picks a plan template and runs it through stages:
 * - default:  control → (call) → gather → utility → hit → onsite → postplant
 * - execute:  gather → utility → hit → onsite → postplant
 * - split:    two squads gather on two routes → synchronised utility → hit
 * - fake:     fake squad sells one site with real utility and noise → main squad hits the other
 * - contact:  silent walk in a file; utility and a fast hit on first contact
 * - rush:     immediate fast hit through one route
 *
 * It replans only on triggers with a cooldown:
 * - the target site is revealed stacked;
 * - an opening pick;
 * - a failed hit (regroup);
 * - the clock.
 *
 * Every decision uses the attackers' own beliefs (see ai/beliefs.ts), never the defenders' setup.
 */
import type { BuyType, SiteId } from '../events';
import { siteAt } from '../maps/grid';
import { nodesWithTag } from '../maps/nav';
import { dist, type SiteRoute, type Vec2 } from '../maps/types';
import { describePressure, pressure } from './ai/beliefs';
import { aiEvent, moveSquad, squadAlive, squadArrived, TRADE_GAP, type Squad } from './ai/squad';
import { hitUtility, mapTactics, nearestNode, safeStage } from './ai/tactical';
import { freshIntel } from './perception';
import { currentCalling, emit, type Agent, type AttackPlan, type AttackStage, type PlanKind, type RoundCtx } from './state';
import { assign, atNode, gotoTask, pos } from './tasks';
import { THROW_RANGE } from './types';
import { hasUtility, throwUtility } from './utility';
import { travelMs } from './movement';

const other = (s: SiteId): SiteId => (s === 'A' ? 'B' : 'A');
const REPLAN_COOLDOWN = 6000;

export function attackers(ctx: RoundCtx): Agent[] {
  return ctx.agents.filter((a) => a.alive && a.side === 'attacker');
}

function routeById(ctx: RoundCtx, site: SiteId, id: string): SiteRoute {
  return ctx.m.map.strategy.sites[site].routes.find((r) => r.id === id) ?? ctx.m.map.strategy.sites[site].routes[0]!;
}

/** Where post-plant players and late hitters look: the defenders' way back onto the site. */
function retakeWatch(ctx: RoundCtx, site: SiteId): Vec2 {
  return pos(ctx, ctx.m.map.strategy.sites[site].retakeStage[0]!);
}

/** Danger angles of a site: its clear spots and the usual defender positions. */
function siteChecks(ctx: RoundCtx, site: SiteId, r: SiteRoute): Vec2[] {
  const s = ctx.m.map.strategy.sites[site];
  return [...new Set([...r.clear, ...s.ctAnchors])].map((n) => pos(ctx, n));
}

function closestOf(ctx: RoundCtx, from: Vec2, options: readonly string[]): string {
  return [...options].sort((x, y) => dist(pos(ctx, x), from) - dist(pos(ctx, y), from) || (x < y ? -1 : 1))[0]!;
}

const teamOf = (ctx: RoundCtx) => ctx.teams[ctx.attackerTeam]!;
const callingOf = (ctx: RoundCtx) => currentCalling(ctx, teamOf(ctx)).calling / 100;

/** Known enemies alive (deaths are public through the kill feed). */
const enemiesAlive = (ctx: RoundCtx) => ctx.agents.filter((a) => a.alive && a.side === 'defender').length;

function setStage(ctx: RoundCtx, plan: AttackPlan, stage: AttackStage, note: string): void {
  plan.stage = stage;
  plan.stageSince = ctx.t;
  if (stage === 'hit' || stage === 'utility' || stage === 'onsite') plan.phase = 'execute';
  if (stage === 'postplant') plan.phase = 'postplant';
  aiEvent(ctx, ctx.attackerTeam, plan.description, stage, note);
}

/** Squad gap: cohesive teams with good teamwork keep tighter trade distance. */
function tradeGap(ctx: RoundCtx): number {
  const ts = attackers(ctx);
  const teamwork = ts.reduce((s, a) => s + a.attrs.teamwork, 0) / Math.max(1, ts.length) / 100;
  const cohesion = teamOf(ctx).setup.cohesion ?? 0.5;
  return TRADE_GAP * (1 + (1 - teamwork) * 0.6 + (0.5 - cohesion) * 0.3);
}

// ---------------------------------------------------------------------------------------------
// Plan selection

function chooseKind(ctx: RoundCtx, buy: BuyType): PlanKind {
  const tac = teamOf(ctx).tactics;
  const c = teamOf(ctx).calling / 100;
  const pace = tac.tPace;
  const rng = ctx.rng;
  const kinds: PlanKind[] = ['default', 'execute', 'split', 'fake', 'contact', 'rush'];
  const w =
    buy === 'pistol'
      ? [0.14, 0.4, 0.1, 0.04, 0.2, 0.12]
      : buy === 'eco' || buy === 'half'
      ? [0.12, 0.18, 0.04, 0.02, 0.28 + 0.2 * (1 - pace), 0.36 + 0.3 * pace]
      : [0.3 + 0.35 * (1 - pace), 0.3, 0.1 + 0.25 * (1 - tac.tGrouping), 0.04 + 0.1 * c, 0.05, 0.03 + 0.25 * pace * pace];
  return rng.weighted(kinds, w);
}

function chooseSite(ctx: RoundCtx): SiteId {
  const team = teamOf(ctx);
  const c = team.calling / 100;
  let wA = Math.max(0.05, team.tactics.tBiasA);
  let wB = Math.max(0.05, 1 - team.tactics.tBiasA);
  wA /= 1 + 0.3 * c * team.memory.defendersSeen.A;
  wB /= 1 + 0.3 * c * team.memory.defendersSeen.B;
  wA /= 1 + 0.15 * c * team.memory.executes.A;
  wB /= 1 + 0.15 * c * team.memory.executes.B;
  return ctx.rng.weighted<SiteId>(['A', 'B'], [wA, wB]);
}

/** Routes of a site ordered by how quickly this group reaches their staging points. */
function routesByTravel(ctx: RoundCtx, site: SiteId, group: readonly Agent[]): SiteRoute[] {
  const routes = ctx.m.map.strategy.sites[site].routes;
  const avg = (r: SiteRoute) => group.reduce((s, a) => s + travelMs(ctx, a, r.stage), 0) / Math.max(1, group.length);
  return [...routes].sort((x, y) => avg(x) - avg(y) || (x.id < y.id ? -1 : 1));
}

export function planAttack(ctx: RoundCtx, buy: BuyType): AttackPlan {
  const rng = ctx.rng;
  const ts = attackers(ctx);
  const kind = chooseKind(ctx, buy);
  const site = chooseSite(ctx);
  const lurkerCand = ts.find((a) => a.roles[0] === 'lurker');
  const lurkerId = (kind === 'default' || kind === 'execute' || kind === 'fake') && lurkerCand && rng.chance(0.65) ? lurkerCand.id : null;

  const plan: AttackPlan = {
    kind, site, routeOf: new Map(), lurkerId, executeAt: Infinity, phase: 'setup', utilityThrown: false, callAt: Infinity,
    entryOrder: [], postPlantOf: new Map(), description: '', earlySeen: { A: 0, B: 0 },
    squads: [], stage: 'gather', stageSince: 0, fakeSite: null, hitRoutes: [], utilityAt: -1, flashesDone: false,
    lastReplan: -1e9, replans: 0, traded: new Set(), controlSmokes: new Set(),
  };
  ctx.plan = plan;
  const pace = teamOf(ctx).tactics.tPace;
  const core = ts.filter((a) => a.id !== lurkerId);
  const routes = routesByTravel(ctx, site, core);

  if (kind === 'default') {
    plan.callAt = Math.max(28000, Math.min(70000, 38000 + (1 - pace) * 24000 + rng.normal(0, 5000)));
    plan.description = 'Default: map control, late call';
    startControl(ctx, plan);
    return plan;
  }
  if (kind === 'rush') {
    const r = routes[0]!;
    plan.squads = [{ id: 'main', job: 'main', members: ts.map((a) => a.id), route: r.id }];
    plan.hitRoutes = [r.id];
    plan.description = `Rush ${site} through ${r.name}`;
    for (const a of ts) plan.routeOf.set(a.id, r.id);
    plan.executeAt = 0;
    startHit(ctx, plan, false);
    return plan;
  }
  if (kind === 'contact') {
    const r = routes[0]!;
    plan.squads = [{ id: 'main', job: 'main', members: ts.map((a) => a.id), route: r.id }];
    plan.hitRoutes = [r.id];
    plan.description = `Contact play ${site} through ${r.name}`;
    for (const a of ts) plan.routeOf.set(a.id, r.id);
    // Walk silently in a file right up to the entry; the hit starts on first contact.
    moveSquad(ctx, plan.squads[0]!, r.entry, { reason: 'contact', walk: true, watch: pos(ctx, r.clear[0]!), checks: siteChecks(ctx, site, r), gap: tradeGap(ctx) * 0.8 });
    setStage(ctx, plan, 'gather', `Contact play: walking into ${r.name}`);
    return plan;
  }
  if (kind === 'fake') {
    const fakeSite = other(site);
    plan.fakeSite = fakeSite;
    const ordered = [...core].sort((x, y) => (x.roles[0] === 'support' ? 0 : 1) - (y.roles[0] === 'support' ? 0 : 1) || (x.id < y.id ? -1 : 1));
    const fakers = ordered.slice(0, Math.min(2, Math.max(1, core.length - 3)));
    const main = core.filter((a) => !fakers.includes(a));
    const fr = routesByTravel(ctx, fakeSite, fakers)[0]!;
    const mr = routesByTravel(ctx, site, main)[0]!;
    plan.squads = [
      { id: 'main', job: 'main', members: main.map((a) => a.id), route: mr.id },
      { id: 'fake', job: 'fake', members: fakers.map((a) => a.id), route: fr.id },
    ];
    plan.hitRoutes = [mr.id];
    for (const a of main) plan.routeOf.set(a.id, mr.id);
    for (const a of fakers) plan.routeOf.set(a.id, fr.id);
    plan.executeAt = Math.max(22000, 26000 + (1 - pace) * 14000 + rng.normal(0, 3000)); // fake sells at executeAt - 7s
    plan.description = `Fake ${fakeSite}, hit ${site} via ${mr.name}`;
    moveSquad(ctx, plan.squads[0]!, safeStage(ctx, mr.stage, mr.entry), { reason: 'stage', watch: pos(ctx, mr.entry), walk: true, gap: tradeGap(ctx) });
    moveSquad(ctx, plan.squads[1]!, safeStage(ctx, fr.stage, fr.entry), { reason: 'fake stage', watch: pos(ctx, fr.entry), gap: tradeGap(ctx) });
    placeLurker(ctx, plan);
    setStage(ctx, plan, 'gather', `Fake ${fakeSite} with ${fakers.length}, main ${main.length} stage ${mr.name}`);
    return plan;
  }
  // execute / split
  const split = kind === 'split' && routes.length >= 2 && core.length >= 4;
  const r1 = routes[0]!;
  const r2 = routes[1] ?? r1;
  let main = core;
  let second: Agent[] = [];
  if (split) {
    const ordered = [...core].sort((x, y) => travelMs(ctx, x, r2.stage) - travelMs(ctx, x, r1.stage) - (travelMs(ctx, y, r2.stage) - travelMs(ctx, y, r1.stage)) || (x.id < y.id ? -1 : 1));
    const nSecond = Math.floor(core.length / 2);
    second = ordered.slice(0, nSecond);
    main = core.filter((a) => !second.includes(a));
  } else if (core.length >= 4 && routes.length >= 2 && rng.chance(0.55)) {
    // A support player covers the second route for a crossfire on the site.
    const awp = core.find((a) => a.roles[0] === 'awper');
    const sup = awp ?? core.find((a) => a.roles[0] === 'support') ?? core[core.length - 1]!;
    second = [sup];
    main = core.filter((a) => a !== sup);
  }
  plan.squads = [{ id: 'main', job: 'main', members: main.map((a) => a.id), route: r1.id }];
  if (second.length) plan.squads.push({ id: 'second', job: 'second', members: second.map((a) => a.id), route: r2.id });
  plan.hitRoutes = second.length ? [r1.id, r2.id] : [r1.id];
  for (const a of main) plan.routeOf.set(a.id, r1.id);
  for (const a of second) plan.routeOf.set(a.id, r2.id);
  plan.executeAt = Math.max(12000, Math.min(55000, 16000 + (1 - pace) * 26000 + rng.normal(0, 4000)));
  plan.description = split ? `Split ${site}: ${r1.name} + ${r2.name}` : `Execute ${site} via ${r1.name}${second.length ? ` (crossfire ${r2.name})` : ''}`;
  const quiet = rng.chance(0.75 * (1 - pace));
  // Squads leave so that they reach their staging points together, just before the hit: a squad
  // with a short route waits back instead of standing exposed for 20 seconds.
  const departAt = (members: readonly Agent[], stage: string) => Math.max(0, plan.executeAt - 3000 - Math.max(...members.map((a) => travelMs(ctx, a, stage))));
  moveSquad(ctx, plan.squads[0]!, safeStage(ctx, r1.stage, r1.entry), { reason: 'stage', watch: pos(ctx, r1.entry), gap: tradeGap(ctx), notBefore: departAt(main, r1.stage), ...(quiet ? { quietNear: pos(ctx, r1.entry) } : {}) });
  if (plan.squads[1]) moveSquad(ctx, plan.squads[1], safeStage(ctx, r2.stage, r2.entry), { reason: 'stage', watch: pos(ctx, r2.entry), gap: tradeGap(ctx), notBefore: departAt(second, r2.stage), ...(quiet ? { quietNear: pos(ctx, r2.entry) } : {}) });
  placeLurker(ctx, plan);
  setStage(ctx, plan, 'gather', `${plan.description}: staging`);
  return plan;
}

function placeLurker(ctx: RoundCtx, plan: AttackPlan): void {
  if (!plan.lurkerId) return;
  const l = ctx.byId.get(plan.lurkerId)!;
  // Lurk on the far side of the map to catch rotators and give late flank pressure.
  const strat = ctx.m.map.strategy;
  const away = other(plan.site);
  const tgt = pos(ctx, mapTactics(ctx).siteNode[away]);
  const spot = closestOf(ctx, tgt, strat.lurks);
  plan.squads.push({ id: 'lurk', job: 'lurk', members: [l.id], route: null });
  assign(ctx, l, gotoTask(spot, 'lurk', { walk: true, watch: tgt, squad: 'lurk', role: 'lurk' }));
}

// ---------------------------------------------------------------------------------------------
// Default: map control

function startControl(ctx: RoundCtx, plan: AttackPlan): void {
  const ts = attackers(ctx);
  const objs = mapTactics(ctx).controls;
  // The main objective gets two players (entry + trade); others one each; spare players back up the first.
  const order = [...ts].sort((x, y) => (x.id === plan.lurkerId ? 1 : 0) - (y.id === plan.lurkerId ? 1 : 0) || (x.roles[0] === 'entry' ? 0 : x.roles[0] === 'star' ? 1 : 2) - (y.roles[0] === 'entry' ? 0 : y.roles[0] === 'star' ? 1 : 2) || (x.id < y.id ? -1 : 1));
  const groups = new Map<string, Agent[]>();
  const want = objs.map((o, i) => (i === 0 ? 2 : 1));
  let oi = 0;
  for (const a of order) {
    while (oi < objs.length && (groups.get(objs[oi]!.id)?.length ?? 0) >= want[oi]!) oi++;
    const o = objs[oi < objs.length ? oi : 0]!;
    groups.set(o.id, [...(groups.get(o.id) ?? []), a]);
  }
  plan.squads = [];
  for (const o of objs) {
    const g = groups.get(o.id);
    if (!g) continue;
    const sq: Squad = { id: `ctl:${o.id}`, job: 'control', members: g.map((a) => a.id), route: null };
    plan.squads.push(sq);
    const watchTgt = o.contest[0] ? pos(ctx, o.contest[0]) : pos(ctx, nodesWithTag(ctx.m.nav, 'defender_spawn')[0]!.id);
    // Hold control from cover: an exposed authored spot shifts to the nearest covered one.
    const spots = o.spots.map((sp) => safeStage(ctx, sp, o.contest[0] ?? sp));
    moveSquad(ctx, sq, spots[0]!, {
      reason: `control ${o.name}`,
      watch: watchTgt,
      gap: tradeGap(ctx),
      targets: spots.length >= g.length ? spots : undefined,
      checks: o.contest.map((c) => pos(ctx, c)),
      quietNear: pos(ctx, o.spots[0]!),
    });
  }
  setStage(ctx, plan, 'control', `Taking ${plan.squads.map((s) => s.id.slice(4)).join(', ')}`);
}

/** Smokes that make crossing a contested control area safe, thrown as the squad arrives. */
function controlUtility(ctx: RoundCtx, plan: AttackPlan): void {
  for (const o of mapTactics(ctx).controls) {
    if (!o.smoke || plan.controlSmokes.has(o.id)) continue;
    const sq = plan.squads.find((s) => s.id === `ctl:${o.id}`);
    if (!sq) continue;
    const near = squadAlive(ctx, sq).find((a) => hasUtility(a, 'smoke') && dist(a.pos, pos(ctx, o.spots[0]!)) < 700 && dist(a.pos, o.smoke!) <= THROW_RANGE);
    if (!near) continue;
    // A smoke is worth it when the area is contested (enemy contact there) or the team plays utility-heavy.
    const contested = pressure(ctx, ctx.attackerTeam, mapTactics(ctx).areaOfNode.get(nearestNode(ctx, o.smoke)) ?? 'mid').value > 0.3;
    if (!contested && !ctx.rng.chance(0.25 + 0.6 * teamOf(ctx).tactics.utilityUse)) {
      plan.controlSmokes.add(o.id);
      continue;
    }
    throwUtility(ctx, near, hasUtility(near, 'smoke')!, o.smoke);
    plan.controlSmokes.add(o.id);
    emit(ctx.m, { type: 'call', tMs: ctx.t, team: ctx.attackerTeam, text: `Smoke ${o.name}` });
  }
}

/** The late call: commit to the site the team believes is weaker, through the closest routes. */
function makeCall(ctx: RoundCtx, plan: AttackPlan, why: string, prefer?: SiteId): void {
  const c = callingOf(ctx);
  const pA = pressure(ctx, ctx.attackerTeam, 'A', 15000);
  const pB = pressure(ctx, ctx.attackerTeam, 'B', 15000);
  let site: SiteId = prefer ?? plan.site;
  if (!prefer && Math.abs(pA.value - pB.value) >= 0.6 && ctx.rng.chance(0.45 + 0.5 * c)) site = pA.value < pB.value ? 'A' : 'B';
  plan.site = site;
  plan.kind = 'execute';
  plan.callAt = Infinity;
  regroupTo(ctx, plan, site, `${why}: ${site} (A ${describePressure(pA)}; B ${describePressure(pB)})`);
  emit(ctx.m, { type: 'call', tMs: ctx.t, team: ctx.attackerTeam, text: `${why}: ${site}` });
}

/** Rebuild squads around the routes of `site` that each player reaches fastest; gather briefly. */
function regroupTo(ctx: RoundCtx, plan: AttackPlan, site: SiteId, note: string): void {
  const ts = attackers(ctx);
  const routes = ctx.m.map.strategy.sites[site].routes;
  const byRoute = new Map<string, Agent[]>();
  for (const a of ts) {
    const best = [...routes].sort((x, y) => travelMs(ctx, a, x.stage) - travelMs(ctx, a, y.stage) || (x.id < y.id ? -1 : 1))[0]!;
    byRoute.set(best.id, [...(byRoute.get(best.id) ?? []), a]);
  }
  // A lone player on a route joins the larger group unless the team is spread for a split.
  const groups = [...byRoute.entries()].sort((x, y) => y[1].length - x[1].length || (x[0] < y[0] ? -1 : 1));
  if (groups.length > 1 && groups[groups.length - 1]![1].length === 1 && ts.length >= 4 && !ctx.rng.chance(0.4)) {
    const [, lone] = groups.pop()!;
    groups[0]![1].push(...lone);
  }
  plan.squads = groups.map(([rid, g], i) => ({ id: i === 0 ? 'main' : 'second', job: i === 0 ? 'main' : 'second', members: g.map((a) => a.id), route: rid }));
  plan.hitRoutes = groups.map(([rid]) => rid);
  plan.routeOf = new Map();
  for (const [rid, g] of groups) for (const a of g) plan.routeOf.set(a.id, rid);
  for (const sq of plan.squads) {
    const r = routeById(ctx, site, sq.route!);
    moveSquad(ctx, sq, safeStage(ctx, r.stage, r.entry), { reason: 'stage', watch: pos(ctx, r.entry), gap: tradeGap(ctx) });
  }
  plan.executeAt = ctx.t + 2500;
  plan.utilityAt = -1;
  plan.flashesDone = false;
  plan.description = `${plan.description.split(' →')[0]} → ${site}`;
  setStage(ctx, plan, 'gather', note);
}

// ---------------------------------------------------------------------------------------------
// The hit

/** Throw the hit's smokes now; flashes follow when the smokes are up; the entry swings after. */
function startHit(ctx: RoundCtx, plan: AttackPlan, withUtility: boolean): void {
  const team = teamOf(ctx);
  const strat = ctx.m.map.strategy.sites[plan.site];
  team.memory.executes[plan.site]++;
  emit(ctx.m, { type: 'call', tMs: ctx.t, team: team.index, text: plan.kind === 'rush' ? plan.description : `Go ${plan.site}` });
  const ts = attackers(ctx);
  let thrown = 0;
  if (withUtility) {
    const used = new Set<string>();
    const throwAt = (kind: 'smoke' | 'fire', target: Vec2): boolean => {
      const thrower = ts
        .filter((a) => !used.has(a.id) && hasUtility(a, kind) && dist(a.pos, target) <= THROW_RANGE)
        .sort((x, y) => dist(x.pos, target) - dist(y.pos, target) || (x.id < y.id ? -1 : 1))[0];
      if (!thrower) return false;
      throwUtility(ctx, thrower, hasUtility(thrower, kind)!, target);
      used.add(thrower.id);
      thrown++;
      return true;
    };
    // Smokes on the defensive sightlines into every entry being hit; molotovs on the close angles.
    // Teams that play utility-light skip some of them (and the hit is harder).
    const share = 0.5 + 0.5 * team.tactics.utilityUse;
    for (const rid of plan.hitRoutes) {
      const u = hitUtility(ctx, plan.site, rid);
      u.smokes.forEach((p, i) => {
        if (i === 0 || ctx.rng.chance(share)) throwAt('smoke', p);
      });
      u.mollies.forEach((p) => {
        if (ctx.rng.chance(share)) throwAt('fire', p);
      });
    }
    void strat;
    // HE a defender the team knows is on an anchor spot.
    const anchors = strat.ctAnchors.map((n) => pos(ctx, n));
    const seen = freshIntel(ctx, team.index, 4000).find((e) => anchors.some((p) => dist(p, e.pos) < 250));
    if (seen) {
      const thrower = ts.filter((a) => hasUtility(a, 'frag') && dist(a.pos, seen.pos) <= THROW_RANGE).sort((x, y) => dist(x.pos, seen.pos) - dist(y.pos, seen.pos) || (x.id < y.id ? -1 : 1))[0];
      if (thrower) throwUtility(ctx, thrower, hasUtility(thrower, 'frag')!, seen.pos);
    }
  }
  plan.utilityThrown = thrown > 0;
  plan.utilityAt = ctx.t;
  plan.flashesDone = !withUtility;
  if (thrown > 0) setStage(ctx, plan, 'utility', `Utility for ${plan.site}: ${thrown} thrown`);
  else releaseHit(ctx, plan);
}

/** Flashes pop over the entries just before the entry players swing. */
function throwFlashes(ctx: RoundCtx, plan: AttackPlan): void {
  const strat = ctx.m.map.strategy.sites[plan.site];
  const ts = attackers(ctx);
  const used = new Set<string>();
  const targets = plan.hitRoutes.flatMap((rid) => hitUtility(ctx, plan.site, rid).flashes);
  for (const target of targets) {
    // Supports flash for the entry (the entry doesn't flash for themselves when someone else can).
    const thrower = ts
      .filter((a) => !used.has(a.id) && hasUtility(a, 'flash') && dist(a.pos, target) <= THROW_RANGE)
      .sort((x, y) => (x.roles[0] === 'entry' ? 1 : 0) - (y.roles[0] === 'entry' ? 1 : 0) || dist(x.pos, target) - dist(y.pos, target) || (x.id < y.id ? -1 : 1))[0];
    if (!thrower) continue;
    throwUtility(ctx, thrower, hasUtility(thrower, 'flash')!, target);
    used.add(thrower.id);
  }
  void strat;
  plan.flashesDone = true;
}

/** Entry players swing through the chokes in a spaced file; each takes a different clear spot. */
function releaseHit(ctx: RoundCtx, plan: AttackPlan): void {
  const site = plan.site;
  for (const sq of plan.squads) {
    if (sq.job === 'lurk' || sq.job === 'fake' || !sq.route) continue;
    const r = routeById(ctx, site, sq.route);
    moveSquad(ctx, sq, r.clear[0]!, { reason: 'entry', via: r.entry, watch: retakeWatch(ctx, site), targets: r.clear, checks: siteChecks(ctx, site, r), gap: tradeGap(ctx) });
  }
  // After a fake, the fake squad either pushes into the site it sold (now likely thinned by rotations)
  // or follows the defenders' rotation to join the hit.
  const fake = plan.squads.find((s) => s.job === 'fake');
  if (fake && plan.fakeSite) {
    const fs = plan.fakeSite;
    const fr = routeById(ctx, fs, fake.route!);
    if (ctx.rng.chance(0.5)) moveSquad(ctx, fake, fr.clear[0]!, { reason: 'fake push', via: fr.entry, watch: retakeWatch(ctx, fs), targets: fr.clear, checks: siteChecks(ctx, fs, fr), gap: tradeGap(ctx), notBefore: ctx.t + 1500 });
    else {
      const join = routesByTravel(ctx, site, squadAlive(ctx, fake))[0]!;
      moveSquad(ctx, fake, join.clear[join.clear.length - 1]!, { reason: 'fake rotate', via: join.entry, watch: retakeWatch(ctx, site), checks: siteChecks(ctx, site, join), gap: tradeGap(ctx) });
    }
  }
  // The lurker joins late through the closest entry (catching rotators on the way).
  const lurk = plan.squads.find((s) => s.job === 'lurk');
  if (lurk) {
    const l = squadAlive(ctx, lurk)[0];
    if (l) {
      const r = [...ctx.m.map.strategy.sites[site].routes].sort((x, y) => travelMs(ctx, l, x.entry) - travelMs(ctx, l, y.entry) || (x.id < y.id ? -1 : 1))[0]!;
      assign(ctx, l, gotoTask(r.clear[r.clear.length - 1]!, 'lurk join', { via: r.entry, notBefore: ctx.t + 3500, watch: retakeWatch(ctx, site), checks: siteChecks(ctx, site, r), squad: 'lurk', role: 'lurk' }));
    }
  }
  setStage(ctx, plan, 'hit', `Hit ${site}: ${plan.squads.filter((s) => s.route && s.job !== 'fake').map((s) => `${s.id} via ${routeById(ctx, site, s.route!).name}`).join(', ')}`);
}

// ---------------------------------------------------------------------------------------------
// Per-tick director update (every 250 ms)

export function updateAttack(ctx: RoundCtx): void {
  const plan = ctx.plan;
  if (!plan) return;
  const ts = attackers(ctx);
  if (ts.length === 0) return;
  const rules = ctx.m.rules;

  trades(ctx, plan);

  if (ctx.bomb.planted) {
    if (plan.stage !== 'postplant') enterPostPlant(ctx, plan);
    // Hear/see a defuse: everyone close collapses on the bomb.
    const defuser = ctx.agents.find((a) => a.alive && a.defusing);
    if (defuser && ctx.bomb.planted) {
      for (const a of ts) {
        if (a.task.kind === 'goto' && a.task.reason === 'stop defuse') continue;
        if (dist(a.pos, ctx.bomb.planted.pos) < 950) assign(ctx, a, gotoTask(ctx.bomb.planted.node, 'stop defuse', { watch: ctx.bomb.planted.pos }));
      }
    }
    return;
  }

  // Time pressure: commit while a plant is still possible.
  const site0 = mapTactics(ctx).siteNode[plan.site];
  const toSite = Math.max(...ts.map((a) => travelMs(ctx, a, site0)));
  const deadline = rules.timing.roundTimeMs - (toSite + rules.timing.plantTimeMs + 12000);

  for (const s of ['A', 'B'] as const) plan.earlySeen[s] = Math.max(plan.earlySeen[s], pressure(ctx, ctx.attackerTeam, s, 3000).seen);

  switch (plan.stage) {
    case 'control': {
      controlUtility(ctx, plan);
      // An opening pick (a defender died) opens a fast call toward where it happened.
      const pick = ctx.recentKills.find((k) => ctx.t - k.t < 300 && ctx.byId.get(k.victimId)!.side === 'defender');
      if (pick && ctx.t > 12000 && ctx.rng.chance(0.4 + 0.4 * callingOf(ctx))) {
        const at = ctx.byId.get(pick.victimId)!.pos;
        const area = mapTactics(ctx).areaOfNode.get(nearestNode(ctx, at)) ?? 'mid';
        makeCall(ctx, plan, 'Pick, go', area === 'mid' ? undefined : area);
        return;
      }
      if (ctx.t >= plan.callAt || ctx.t >= deadline) makeCall(ctx, plan, ctx.t >= deadline ? 'Late call' : 'Call');
      return;
    }
    case 'gather': {
      // Contact play: the hit starts on first contact (or at the entry).
      if (plan.kind === 'contact') {
        const contact = ts.some((a) => a.target || a.seeing.length > 0) || ts.some((a) => dist(a.pos, pos(ctx, routeById(ctx, plan.site, plan.hitRoutes[0]!).entry)) < 120);
        if (contact || ctx.t >= deadline) startHit(ctx, plan, true);
        return;
      }
      // Fake: the fake squad sells its site with real utility and noise before the main hit.
      if (plan.kind === 'fake' && plan.fakeSite && ctx.t >= plan.executeAt - 7000 && !plan.controlSmokes.has('fake')) {
        sellFake(ctx, plan);
        return;
      }
      // Site revealed stacked before the hit: switch (good callers notice more often).
      if (ctx.t < plan.executeAt - 1500 && ctx.t - plan.lastReplan > REPLAN_COOLDOWN && plan.replans < 2 && rules.timing.roundTimeMs - ctx.t > 40000) {
        const here = pressure(ctx, ctx.attackerTeam, plan.site, 5000);
        const there = pressure(ctx, ctx.attackerTeam, other(plan.site), 5000);
        if (here.seen >= 3 && there.value < 1 && ctx.rng.chance(0.15 + 0.5 * callingOf(ctx))) {
          plan.lastReplan = ctx.t;
          plan.replans++;
          plan.site = other(plan.site);
          regroupTo(ctx, plan, plan.site, `Switch to ${plan.site}: ${here.seen} defenders seen at ${other(plan.site)}`);
          emit(ctx.m, { type: 'call', tMs: ctx.t, team: ctx.attackerTeam, text: `Switch ${plan.site}` });
          return;
        }
      }
      const hitters = plan.squads.filter((s) => s.route && s.job !== 'fake' && s.job !== 'lurk');
      const ready = hitters.every((s) => squadArrived(ctx, s));
      if ((ctx.t >= plan.executeAt && ready) || ctx.t >= plan.executeAt + 9000 || ctx.t >= deadline) startHit(ctx, plan, true);
      return;
    }
    case 'utility': {
      // Flashes once the smokes have bloomed; the entry swings as the flashes pop.
      if (!plan.flashesDone && ctx.t >= plan.utilityAt + 1300) throwFlashes(ctx, plan);
      if (plan.flashesDone && ctx.t >= plan.utilityAt + 2300) releaseHit(ctx, plan);
      return;
    }
    case 'hit':
    case 'onsite': {
      reactToAngle(ctx, plan);
      bombHandling(ctx, plan);
      if (plan.stage === 'hit' && ts.some((a) => siteAt(ctx.m.grid, a.pos) === plan.site)) setStage(ctx, plan, 'onsite', `On ${plan.site}`);
      // A failed hit: lost two or more without reaching the site and now outnumbered → regroup.
      if (plan.stage === 'hit' && ctx.t - plan.stageSince > 4000 && ctx.t - plan.lastReplan > REPLAN_COOLDOWN && plan.replans < 2) {
        const onSite = ts.some((a) => siteAt(ctx.m.grid, a.pos) === plan.site);
        if (!onSite && ts.length < enemiesAlive(ctx) && rules.timing.roundTimeMs - ctx.t > 35000) {
          plan.lastReplan = ctx.t;
          plan.replans++;
          const target = ctx.rng.chance(0.5 + 0.3 * callingOf(ctx)) ? other(plan.site) : plan.site;
          plan.site = target;
          regroupTo(ctx, plan, target, `Regroup: hit failed (${ts.length}v${enemiesAlive(ctx)}), re-hit ${target}`);
          plan.executeAt = ctx.t + 6000;
          emit(ctx.m, { type: 'call', tMs: ctx.t, team: ctx.attackerTeam, text: `Fall back, regroup ${target}` });
        }
      }
      return;
    }
    default:
      return;
  }
}

/**
 * A teammate just died on the approach to a known angle: the rest of the squad doesn't walk into
 * the same peek. It smokes the angle off, or flashes it and swings together, or reroutes through
 * another entry. Cooldown per angle.
 */
function reactToAngle(ctx: RoundCtx, plan: AttackPlan): void {
  const ts = attackers(ctx);
  for (const k of ctx.recentKills) {
    if (ctx.t - k.t > 600) continue;
    const key = `angle:${k.killerId}>${k.victimId}`;
    if (plan.traded.has(key)) continue;
    const victim = ctx.byId.get(k.victimId)!;
    const killer = ctx.byId.get(k.killerId)!;
    if (victim.side !== 'attacker' || !killer.alive || siteAt(ctx.m.grid, victim.pos) === plan.site) continue;
    plan.traded.add(key);
    const known = teamOf(ctx).intel.get(killer.id);
    const at = known && ctx.t - known.t < 3000 ? known.pos : null;
    // Teammates still on the way in, behind the spot where the victim died.
    const coming = ts.filter((a) => !a.target && a.task.kind === 'goto' && siteAt(ctx.m.grid, a.pos) !== plan.site && dist(a.pos, victim.pos) < 700);
    if (coming.length === 0) continue;
    if (at) {
      const block = { x: at.x + (victim.pos.x - at.x) * 0.3, y: at.y + (victim.pos.y - at.y) * 0.3 };
      const smoker = coming.find((a) => hasUtility(a, 'smoke') && dist(a.pos, block) <= THROW_RANGE);
      if (smoker) {
        throwUtility(ctx, smoker, hasUtility(smoker, 'smoke')!, block);
        for (const a of coming) if (a.task.kind === 'goto') assign(ctx, a, { ...a.task, notBefore: ctx.t + 2200 });
        aiEvent(ctx, ctx.attackerTeam, plan.description, plan.stage, `${victim.name} died to an angle: smoke it off, then go`);
        continue;
      }
      const flasher = coming.find((a) => hasUtility(a, 'flash') && dist(a.pos, at) <= THROW_RANGE);
      if (flasher) {
        throwUtility(ctx, flasher, hasUtility(flasher, 'flash')!, at);
        for (const a of coming) {
          if (a.task.kind !== 'goto') continue;
          const { follow: _f, ...rest } = a.task;
          assign(ctx, a, { ...rest, notBefore: ctx.t + 1300 });
        }
        aiEvent(ctx, ctx.attackerTeam, plan.description, plan.stage, `${victim.name} died to an angle: flash it and swing together`);
        continue;
      }
    }
    // No utility: take another way in.
    const routes = ctx.m.map.strategy.sites[plan.site].routes;
    const current = plan.routeOf.get(coming[0]!.id);
    const alt = routes.filter((r) => r.id !== current).sort((x, y) => travelMs(ctx, coming[0]!, x.entry) - travelMs(ctx, coming[0]!, y.entry) || (x.id < y.id ? -1 : 1))[0];
    if (!alt) continue;
    const sq: Squad = { id: `re:${alt.id}`, job: 'main', members: coming.map((a) => a.id), route: alt.id };
    for (const a of coming) plan.routeOf.set(a.id, alt.id);
    moveSquad(ctx, sq, alt.clear[0]!, { reason: 'entry', via: alt.entry, watch: retakeWatch(ctx, plan.site), targets: alt.clear, checks: siteChecks(ctx, plan.site, alt), gap: tradeGap(ctx) });
    aiEvent(ctx, ctx.attackerTeam, plan.description, plan.stage, `${victim.name} died on ${routeById(ctx, plan.site, current ?? alt.id).name}: rest go through ${alt.name}`);
  }
}

/** The fake squad throws its site's execute smokes and flashes and runs at the entry, making noise. */
function sellFake(ctx: RoundCtx, plan: AttackPlan): void {
  plan.controlSmokes.add('fake');
  const fsq = plan.squads.find((s) => s.job === 'fake');
  const fs = plan.fakeSite!;
  if (!fsq) return;
  const strat = ctx.m.map.strategy.sites[fs];
  const members = squadAlive(ctx, fsq);
  let thrown = 0;
  for (const l of [...strat.execSmokes, ...strat.execFlashes]) {
    if (l.route !== fsq.route) continue;
    const kind = strat.execSmokes.includes(l) ? 'smoke' : 'flash';
    const thrower = members.find((a) => hasUtility(a, kind) && dist(a.pos, l.target) <= THROW_RANGE);
    if (!thrower) continue;
    throwUtility(ctx, thrower, hasUtility(thrower, kind)!, l.target);
    thrown++;
  }
  const r = routeById(ctx, fs, fsq.route!);
  // Run (loud) to the entry and hold it: noise and a real threat that holds rotators.
  moveSquad(ctx, fsq, r.entry, { reason: 'fake', watch: pos(ctx, r.clear[0]!), gap: 90 });
  emit(ctx.m, { type: 'call', tMs: ctx.t, team: ctx.attackerTeam, text: `Fake ${fs}` });
  aiEvent(ctx, ctx.attackerTeam, plan.description, 'fake', `Selling ${fs}: ${thrown} utility, running at ${r.name}`);
}

function bombHandling(ctx: RoundCtx, plan: AttackPlan): void {
  const ts = attackers(ctx);
  const rules = ctx.m.rules;
  const carrier = ts.find((a) => a.bomb);
  if (carrier && carrier.task.kind !== 'plant' && !carrier.planting) {
    const onSite = siteAt(ctx.m.grid, carrier.pos);
    if (onSite) {
      const enemiesVisible = carrier.seeing.some((e) => e.alive);
      const mates = ts.filter((a) => a !== carrier && siteAt(ctx.m.grid, a.pos) === onSite).length;
      const late = ctx.t > rules.timing.roundTimeMs - 22000;
      // Plant once the site is clear, the numbers on it are won, or the clock forces it.
      const known = pressure(ctx, ctx.attackerTeam, onSite, 2500).seen;
      if (!enemiesVisible && (known === 0 || late || mates >= known + 1)) {
        const spots = nodesWithTag(ctx.m.nav, 'plant').filter((n) => n.site === onSite).map((n) => n.id);
        const spot = closestOf(ctx, carrier.pos, spots);
        assign(ctx, carrier, { kind: 'plant', node: spot });
        emit(ctx.m, { type: 'call', tMs: ctx.t, team: ctx.attackerTeam, text: 'Planting' });
      }
    }
  }
  if (!carrier && ctx.bomb.dropped) {
    const picker = ts.some((a) => a.task.kind === 'pickup')
      ? null
      : [...ts].sort((x, y) => dist(x.pos, ctx.bomb.dropped!.pos) - dist(y.pos, ctx.bomb.dropped!.pos) || (x.id < y.id ? -1 : 1))[0];
    if (picker) {
      assign(ctx, picker, { kind: 'pickup' });
      aiEvent(ctx, ctx.attackerTeam, plan.description, plan.stage, `Bomb down: ${picker.name} recovers it`);
    }
  }
}

/**
 * Trading: when a teammate dies nearby, the closest free attacker swings onto the killer's last
 * known position. That is the core of coordinated play.
 */
function trades(ctx: RoundCtx, plan: AttackPlan): void {
  for (const k of ctx.recentKills) {
    if (ctx.t - k.t > 400) continue;
    const key = `${k.killerId}>${k.victimId}`;
    if (plan.traded.has(key)) continue;
    const victim = ctx.byId.get(k.victimId)!;
    const killer = ctx.byId.get(k.killerId)!;
    if (victim.side !== 'attacker' || !killer.alive) continue;
    plan.traded.add(key);
    const known = teamOf(ctx).intel.get(killer.id);
    if (!known || ctx.t - known.t > 2000) continue;
    const trader = attackers(ctx)
      .filter((a) => !a.target && !a.planting && a.task.kind !== 'plant' && !a.saving && dist(a.pos, victim.pos) < 650)
      .sort((x, y) => dist(x.pos, victim.pos) - dist(y.pos, victim.pos) || (x.id < y.id ? -1 : 1))[0];
    if (!trader) continue;
    const at = nearestNode(ctx, known.pos);
    assign(ctx, trader, gotoTask(at, 'trade', { watch: known.pos, checks: [known.pos], squad: 'trade', role: 'trade' }));
  }
}

export function saveAgent(ctx: RoundCtx, a: Agent): void {
  const tag = a.side === 'attacker' ? 'attacker_spawn' : 'defender_spawn';
  const spot = closestOf(ctx, a.pos, nodesWithTag(ctx.m.nav, tag).map((n) => n.id));
  a.saving = true;
  assign(ctx, a, { kind: 'save', node: spot });
  emit(ctx.m, { type: 'save', tMs: ctx.t, playerId: a.id });
}

function enterPostPlant(ctx: RoundCtx, plan: AttackPlan): void {
  const site = ctx.bomb.planted!.site;
  const strat = ctx.m.map.strategy.sites[site];
  const ts = attackers(ctx).filter((a) => a.task.kind !== 'save');
  const watch = retakeWatch(ctx, site);
  const taken = new Set<string>();
  // Spread over post-plant positions (closest first), each watching the defenders' way back in.
  for (const a of [...ts].sort((x, y) => (x.id < y.id ? -1 : 1))) {
    const spot = [...strat.postPlant].filter((s) => !taken.has(s)).sort((x, y) => travelMs(ctx, a, x) - travelMs(ctx, a, y) || (x < y ? -1 : 1))[0] ?? strat.postPlant[0]!;
    taken.add(spot);
    plan.postPlantOf.set(a.id, spot);
    if (!atNode(ctx, a, spot)) assign(ctx, a, gotoTask(spot, 'post-plant', { watch, squad: 'postplant', role: 'post-plant' }));
  }
  emit(ctx.m, { type: 'call', tMs: ctx.t, team: ctx.attackerTeam, text: 'Post-plant' });
  setStage(ctx, plan, 'postplant', `Bomb down on ${site}: post-plant spread`);
}
