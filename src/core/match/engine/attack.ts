/**
 * Attacking-side team AI ("the IGL"). Decides a plan from tactics, economy,
 * cross-round memory and current intel — never from enemy ground truth.
 */
import type { BuyType, SiteId } from '../events';
import { siteAt } from '../maps/grid';
import { nodesWithTag } from '../maps/nav';
import { dist, type SiteRoute } from '../maps/types';
import { freshIntel } from './perception';
import { currentCalling, emit, type Agent, type AttackPlan, type PlanKind, type RoundCtx } from './state';
import { assign, assignNearest, atNode, gotoTask, pos } from './tasks';
import { THROW_RANGE } from './types';
import { hasUtility, throwUtility } from './utility';
import { travelMs } from './movement';

const other = (s: SiteId): SiteId => (s === 'A' ? 'B' : 'A');

export function attackers(ctx: RoundCtx): Agent[] {
  return ctx.agents.filter((a) => a.alive && a.side === 'attacker');
}

function routeById(ctx: RoundCtx, site: SiteId, id: string): SiteRoute {
  return ctx.m.map.strategy.sites[site].routes.find((r) => r.id === id)!;
}

/**
 * Who goes in first: entries lead, the star rifler takes the trade slot right
 * behind them, the AWPer holds the entry angle and goes last; the bomb carrier never leads.
 */
function entryOrder(ts: Agent[]): string[] {
  const score = (a: Agent) =>
    (a.roles[0] === 'entry' ? 100 : a.roles[0] === 'star' ? 60 : 0) + a.attrs.opening * (a.roles[0] === 'star' ? 0.3 : 1) - (a.roles[0] === 'awper' ? 80 : 0) - (a.bomb ? 40 : 0);
  return [...ts].sort((x, y) => score(y) - score(x) || (x.id < y.id ? -1 : 1)).map((a) => a.id);
}

export function planAttack(ctx: RoundCtx, buy: BuyType): AttackPlan {
  const team = ctx.teams[ctx.attackerTeam]!;
  const tac = team.tactics;
  const rng = ctx.rng;
  const c = team.calling / 100;
  const ts = attackers(ctx);

  // Site choice: preference, adjusted by what this team has learned about the defense.
  let wA = Math.max(0.05, tac.tBiasA);
  let wB = Math.max(0.05, 1 - tac.tBiasA);
  wA /= 1 + 0.3 * c * team.memory.defendersSeen.A;
  wB /= 1 + 0.3 * c * team.memory.defendersSeen.B;
  wA /= 1 + 0.15 * c * team.memory.executes.A;
  wB /= 1 + 0.15 * c * team.memory.executes.B;
  const site = rng.weighted<SiteId>(['A', 'B'], [wA, wB]);

  const pace = tac.tPace;
  const kinds: PlanKind[] = ['execute', 'rush', 'default', 'split'];
  const weights =
    buy === 'eco'
      ? [0.3, 0.45 + 0.3 * pace, 0.2, 0.05]
      : [0.35, 0.05 + 0.3 * pace * pace, 0.15 + 0.45 * (1 - pace), 0.06 + 0.3 * (1 - tac.tGrouping)];
  const kind = rng.weighted(kinds, weights);

  const routes = ctx.m.map.strategy.sites[site].routes;
  const order = entryOrder(ts);
  const lurkerCand = ts.find((a) => a.roles[0] === 'lurker');
  const lurkerId = kind !== 'rush' && lurkerCand && rng.chance(0.7) ? lurkerCand.id : null;
  const mainIdx = rng.int(0, routes.length - 1);
  const routeOf = new Map<string, string>();
  const members = order.filter((id) => id !== lurkerId);
  if (kind === 'split') {
    const firstCount = rng.chance(0.5) ? Math.ceil(members.length / 2) : Math.floor(members.length / 2);
    members.forEach((id, i) => routeOf.set(id, routes[i < firstCount ? 0 : 1]!.id));
  } else members.forEach((id) => routeOf.set(id, routes[mainIdx]!.id));
  if (lurkerId) routeOf.set(lurkerId, routes[(mainIdx + 1) % routes.length]!.id);

  let executeAt = 0;
  let callAt = Infinity;
  if (kind === 'execute' || kind === 'split') executeAt = Math.max(10000, Math.min(60000, 16000 + (1 - pace) * 30000 + rng.normal(0, 5000)));
  if (kind === 'default') {
    callAt = Math.max(30000, Math.min(75000, 40000 + (1 - pace) * 25000 + rng.normal(0, 6000)));
    executeAt = callAt;
  }

  const routeNames = [...new Set(routeOf.values())].map((r) => routeById(ctx, site, r).name).join(' + ');
  const description =
    kind === 'rush' ? `Rush ${site} through ${routeNames}` : kind === 'default' ? `Default, late call` : kind === 'split' ? `Split ${site}: ${routeNames}` : `Execute ${site} via ${routeNames}`;

  const plan: AttackPlan = {
    kind, site, routeOf, lurkerId, executeAt, phase: 'setup', utilityThrown: false, callAt, entryOrder: order,
    postPlantOf: new Map(), description, earlySeen: { A: 0, B: 0 },
  };
  ctx.plan = plan;

  // Opening tasks.
  if (kind === 'rush') {
    startExecute(ctx, plan, false);
  } else if (kind === 'default') {
    const strat = ctx.m.map.strategy;
    const spread = assignNearest(ctx, ts.filter((a) => a.id !== lurkerId), strat.tControl);
    for (const a of ts) {
      if (a.id === lurkerId) assign(ctx, a, gotoTask(strat.lurks[0]!, 'lurk', { walk: true, watch: pos(ctx, nearestDefenderSpawn(ctx)) }));
      else assign(ctx, a, gotoTask(spread.get(a.id)!, 'map control', { watch: pos(ctx, nearestDefenderSpawn(ctx)) }));
    }
  } else {
    for (const a of ts) {
      const r = routeById(ctx, site, routeOf.get(a.id)!);
      if (a.id === lurkerId) {
        const lurk = closestOf(ctx, r.stage, ctx.m.map.strategy.lurks);
        assign(ctx, a, gotoTask(lurk, 'lurk', { walk: true, watch: pos(ctx, r.entry) }));
      } else assign(ctx, a, gotoTask(r.stage, 'stage', { watch: pos(ctx, r.entry) }));
    }
  }
  return plan;
}

function nearestDefenderSpawn(ctx: RoundCtx): string {
  return nodesWithTag(ctx.m.nav, 'defender_spawn')[0]!.id;
}

function closestOf(ctx: RoundCtx, from: string, options: readonly string[]): string {
  const p = pos(ctx, from);
  return [...options].sort((x, y) => dist(pos(ctx, x), p) - dist(pos(ctx, y), p))[0]!;
}

function retakeWatch(ctx: RoundCtx, site: SiteId) {
  return pos(ctx, ctx.m.map.strategy.sites[site].retakeStage[0]!);
}

function startExecute(ctx: RoundCtx, plan: AttackPlan, withUtility: boolean): void {
  plan.phase = 'execute';
  const team = ctx.teams[ctx.attackerTeam]!;
  const ts = attackers(ctx);
  const strat = ctx.m.map.strategy.sites[plan.site];
  emit(ctx.m, { type: 'call', tMs: ctx.t, team: team.index, text: plan.kind === 'rush' ? plan.description : `Go ${plan.site}` });
  team.memory.executes[plan.site]++;

  if (withUtility && ctx.rng.chance(0.35 + 0.65 * team.tactics.utilityUse)) {
    const used = new Set(plan.routeOf.values());
    const throwers = new Set<string>();
    const throwKind = (lineups: typeof strat.execSmokes, kind: 'smoke' | 'flash') => {
      for (const l of lineups) {
        if (!used.has(l.route)) continue;
        const thrower = ts
          .filter((a) => !throwers.has(a.id) && hasUtility(a, kind) && dist(a.pos, l.target) <= THROW_RANGE)
          .sort((x, y) => dist(x.pos, l.target) - dist(y.pos, l.target) || (x.id < y.id ? -1 : 1))[0];
        if (!thrower) continue;
        throwUtility(ctx, thrower, hasUtility(thrower, kind)!, l.target);
        throwers.add(thrower.id);
      }
    };
    throwKind(strat.execSmokes, 'smoke');
    throwers.clear();
    throwKind(strat.execFlashes, 'flash');
    // Molotovs on the usual defender positions force anchors off cover (or burn them).
    throwers.clear();
    const mollies = ctx.rng.chance(0.25 + 0.5 * team.tactics.utilityUse) ? strat.ctAnchors.slice(0, 1) : [];
    for (const anchor of mollies) {
      const at = pos(ctx, anchor);
      const thrower = ts
        .filter((a) => !throwers.has(a.id) && hasUtility(a, 'fire') && dist(a.pos, at) <= THROW_RANGE)
        .sort((x, y) => dist(x.pos, at) - dist(y.pos, at) || (x.id < y.id ? -1 : 1))[0];
      if (!thrower) continue;
      throwUtility(ctx, thrower, hasUtility(thrower, 'fire')!, at);
      throwers.add(thrower.id);
    }
    plan.utilityThrown = true;
  }

  const byRoute = new Map<string, Agent[]>();
  for (const id of plan.entryOrder) {
    const a = ctx.byId.get(id)!;
    if (!a.alive || id === plan.lurkerId) continue;
    const r = plan.routeOf.get(id)!;
    byRoute.set(r, [...(byRoute.get(r) ?? []), a]);
  }
  const teamwork = ts.reduce((s, a) => s + a.attrs.teamwork, 0) / Math.max(1, ts.length) / 100;
  const cohesion = team.setup.cohesion ?? 0.5;
  const spacing = 380 + (1 - teamwork) * 1300 + (0.5 - cohesion) * 300;
  for (const [rid, group] of byRoute) {
    const r = routeById(ctx, plan.site, rid);
    // The bomb carrier never leads the entry.
    if (group.length > 1 && group[0]!.bomb) group.push(group.shift()!);
    group.forEach((a, i) => {
      const target = r.clear[i % r.clear.length]!;
      assign(ctx, a, gotoTask(target, 'entry', { via: r.entry, notBefore: ctx.t + (plan.kind === 'rush' ? 0 : 500) + i * spacing, watch: retakeWatch(ctx, plan.site) }));
    });
  }
  if (plan.lurkerId) {
    const l = ctx.byId.get(plan.lurkerId)!;
    if (l.alive) {
      const r = routeById(ctx, plan.site, plan.routeOf.get(l.id)!);
      assign(ctx, l, gotoTask(r.clear[0]!, 'lurk join', { via: r.entry, notBefore: ctx.t + 3500, watch: retakeWatch(ctx, plan.site) }));
    }
  }
}

/** The IGL's late call / mid-round switch: commit to the site where fewer defenders were seen. */
function reroute(ctx: RoundCtx, plan: AttackPlan, site: SiteId, reason: string): void {
  plan.site = site;
  const routes = ctx.m.map.strategy.sites[site].routes;
  for (const a of attackers(ctx)) {
    const best = [...routes].sort((x, y) => travelMs(ctx, a, x.stage) - travelMs(ctx, a, y.stage) || (x.id < y.id ? -1 : 1))[0]!;
    plan.routeOf.set(a.id, best.id);
    assign(ctx, a, gotoTask(best.stage, 'stage', { watch: pos(ctx, best.entry) }));
  }
  plan.executeAt = ctx.t + 3500;
  plan.description += ` → ${reason} ${site}`;
  emit(ctx.m, { type: 'call', tMs: ctx.t, team: ctx.attackerTeam, text: `${reason} ${site}` });
}

function defendersNear(ctx: RoundCtx, site: SiteId, maxAge: number): number {
  const strat = ctx.m.map.strategy.sites[site];
  const nodes = [...strat.ctAnchors, ...strat.routes.map((r) => r.entry)].map((n) => pos(ctx, n));
  return freshIntel(ctx, ctx.attackerTeam, maxAge).filter((e) => siteAt(ctx.m.grid, e.pos) === site || nodes.some((p) => dist(p, e.pos) < 300)).length;
}

export function updateAttack(ctx: RoundCtx): void {
  const plan = ctx.plan;
  if (!plan) return;
  const ts = attackers(ctx);
  if (ts.length === 0) return;
  const team = ctx.teams[ctx.attackerTeam]!;
  const rules = ctx.m.rules;
  // Mid-round decisions come from whoever is calling now (IGL dead => weaker backup caller).
  const c = currentCalling(ctx, team).calling / 100;

  if (ctx.bomb.planted) {
    if (plan.phase !== 'postplant') enterPostPlant(ctx, plan);
    // Hear/see a defuse: everyone collapses on the bomb.
    const defuser = ctx.agents.find((a) => a.alive && a.defusing);
    if (defuser && ctx.bomb.planted) {
      for (const a of ts) {
        if (a.task.kind === 'goto' && a.task.reason === 'stop defuse') continue;
        if (dist(a.pos, ctx.bomb.planted.pos) < 950) assign(ctx, a, gotoTask(ctx.bomb.planted.node, 'stop defuse', { watch: ctx.bomb.planted.pos }));
      }
    }
    return;
  }

  if (plan.phase === 'setup') {
    for (const s of ['A', 'B'] as const) plan.earlySeen[s] = Math.max(plan.earlySeen[s], defendersNear(ctx, s, 3000));
    if (plan.kind === 'default' && ctx.t >= plan.callAt) {
      const a = defendersNear(ctx, 'A', 15000);
      const b = defendersNear(ctx, 'B', 15000);
      const pick: SiteId = a === b ? plan.site : a < b ? 'A' : 'B';
      plan.kind = 'execute';
      plan.callAt = Infinity;
      reroute(ctx, plan, ctx.rng.chance(0.4 + 0.5 * c) ? pick : plan.site, 'Call');
      return;
    }
    // Mid-round adaptation: a strong caller abandons a site that is clearly stacked.
    if ((plan.kind === 'execute' || plan.kind === 'split') && ctx.t < plan.executeAt - 2500 && !plan.description.includes('Switch')) {
      if (defendersNear(ctx, plan.site, 4000) >= 3 && ctx.rng.chance(c * 0.25)) {
        reroute(ctx, plan, other(plan.site), 'Switch');
        return;
      }
    }
    const nonLurkers = ts.filter((a) => a.id !== plan.lurkerId);
    const ready = nonLurkers.filter((a) => a.task.kind === 'hold').length;
    const toSite = Math.max(...ts.map((a) => travelMs(ctx, a, ctx.m.map.strategy.sites[plan.site].routes[0]!.clear[0]!)));
    const deadline = rules.timing.roundTimeMs - (toSite + rules.timing.plantTimeMs + 12000);
    if ((ctx.t >= plan.executeAt && ready >= nonLurkers.length - 1) || ctx.t >= plan.executeAt + 9000 || ctx.t >= deadline) {
      startExecute(ctx, plan, true);
    }
    return;
  }

  if (plan.phase === 'execute') {
    // Bomb handling.
    const carrier = ts.find((a) => a.bomb);
    if (carrier && carrier.task.kind !== 'plant' && !carrier.planting) {
      const onSite = siteAt(ctx.m.grid, carrier.pos);
      if (onSite) {
        const enemiesVisible = carrier.seeing.some((e) => e.alive);
        const mates = ts.filter((a) => a !== carrier && siteAt(ctx.m.grid, a.pos) === onSite).length;
        const late = ctx.t > rules.timing.roundTimeMs - 22000;
        // Plant once the site is clear, or the numbers on it are won, or the clock forces it.
        const knownDefenders = defendersNear(ctx, onSite, 2500);
        if (!enemiesVisible && (knownDefenders === 0 || late || mates >= knownDefenders + 1)) {
          const spots = nodesWithTag(ctx.m.nav, 'plant').filter((n) => n.site === onSite).map((n) => n.id);
          const spot = closestOf(ctx, carrier.node, spots);
          assign(ctx, carrier, { kind: 'plant', node: spot });
        }
      }
    }
    if (!carrier && ctx.bomb.dropped) {
      const picker = ts.some((a) => a.task.kind === 'pickup')
        ? null
        : [...ts].sort((x, y) => dist(x.pos, ctx.bomb.dropped!.pos) - dist(y.pos, ctx.bomb.dropped!.pos) || (x.id < y.id ? -1 : 1))[0];
      if (picker) assign(ctx, picker, { kind: 'pickup' });
    }
  }
}

export function saveAgent(ctx: RoundCtx, a: Agent): void {
  const tag = a.side === 'attacker' ? 'attacker_spawn' : 'defender_spawn';
  const spot = closestOf(ctx, a.node, nodesWithTag(ctx.m.nav, tag).map((n) => n.id));
  a.saving = true;
  assign(ctx, a, { kind: 'save', node: spot });
  emit(ctx.m, { type: 'save', tMs: ctx.t, playerId: a.id });
}

function enterPostPlant(ctx: RoundCtx, plan: AttackPlan): void {
  plan.phase = 'postplant';
  const site = ctx.bomb.planted!.site;
  const strat = ctx.m.map.strategy.sites[site];
  const ts = attackers(ctx).filter((a) => a.task.kind !== 'save');
  const spots = assignNearest(ctx, ts, strat.postPlant);
  const watch = retakeWatch(ctx, site);
  for (const a of ts) {
    plan.postPlantOf.set(a.id, spots.get(a.id)!);
    if (!atNode(ctx, a, spots.get(a.id)!)) assign(ctx, a, gotoTask(spots.get(a.id)!, 'post-plant', { watch }));
  }
  emit(ctx.m, { type: 'call', tMs: ctx.t, team: ctx.attackerTeam, text: 'Post-plant' });
}
