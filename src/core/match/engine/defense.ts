/**
 * Defending-side team AI. Sets up a formation, rotates only on information the
 * team actually has, uses delay utility, retakes planted sites and saves when a
 * retake is impossible.
 */
import type { SiteId } from '../events';
import { siteAt } from '../maps/grid';
import { findPath, nodesWithTag } from '../maps/nav';
import { dist, type Vec2 } from '../maps/types';
import { saveAgent } from './attack';
import { freshIntel } from './perception';
import { currentCalling, emit, type Agent, type DefenseState, type RoundCtx } from './state';
import { hasLineOfSight } from '../maps/grid';
import { assign, gotoTask, pos } from './tasks';
import { travelMs } from './movement';
import { THROW_RANGE } from './types';
import { hasUtility, throwUtility } from './utility';

export function defenders(ctx: RoundCtx): Agent[] {
  return ctx.agents.filter((a) => a.alive && a.side === 'defender');
}

const defTeam = (ctx: RoundCtx) => 1 - ctx.attackerTeam;

/** Direction an anchor watches: the closest attacker entry into its site, or the mid approach. */
function watchFor(ctx: RoundCtx, nodeId: string, area: SiteId | 'mid'): Vec2 {
  const here = pos(ctx, nodeId);
  if (area !== 'mid') {
    const entries = ctx.m.map.strategy.sites[area].routes.map((r) => pos(ctx, r.entry));
    return entries.sort((x, y) => dist(x, here) - dist(y, here))[0]!;
  }
  const tSpawn = nodesWithTag(ctx.m.nav, 'attacker_spawn')[0]!.id;
  const p = findPath(ctx.m.nav, nodeId, tSpawn);
  return p && p.length > 2 ? pos(ctx, p[2]!) : pos(ctx, tSpawn);
}

export function planDefense(ctx: RoundCtx): DefenseState {
  const team = ctx.teams[defTeam(ctx)]!;
  const tac = team.tactics;
  const c = team.calling / 100;
  const strat = ctx.m.map.strategy;
  const cts = defenders(ctx);
  const rng = ctx.rng;

  const counts: Record<SiteId | 'mid', number> = { A: 2, mid: 1, B: 2 };
  const diff = team.memory.executes.A - team.memory.executes.B;
  const stack = team.adjustment?.stack;
  if (stack) {
    // Coach timeout directive.
    counts.mid = 0;
    counts[stack] = 3;
  } else if (Math.abs(diff) >= 2.5 && c > 0.55 && rng.chance(c - 0.3)) {
    // Anti-strat stack: only on a clearly repeated pattern, and only for strong readers.
    counts.mid = 0;
    counts[diff > 0 ? 'A' : 'B'] = 3;
  }
  const busier: SiteId = diff >= 0 ? 'A' : 'B';
  const slots: { area: SiteId | 'mid'; node: string }[] = [];
  for (const area of ['A', 'mid', 'B'] as const) {
    const pool = area === 'mid' ? strat.midHolds : strat.sites[area].ctAnchors;
    for (let i = 0; i < counts[area]; i++) slots.push({ area, node: pool[i % pool.length]! });
  }
  // Preferences: AWPer takes mid (or the first site slot), anchors take site slots.
  const baseOf = new Map<string, string>();
  const areaOf = new Map<string, SiteId | 'mid'>();
  const remaining = [...slots];
  const take = (a: Agent, pred: (s: { area: SiteId | 'mid' }) => boolean) => {
    const i = remaining.findIndex(pred);
    if (i < 0) return false;
    const s = remaining.splice(i, 1)[0]!;
    baseOf.set(a.id, s.node);
    areaOf.set(a.id, s.area);
    return true;
  };
  // The AWPer takes the slot with the longest clear sightline onto the attackers' approach.
  const sightline = (s: { area: SiteId | 'mid'; node: string }) => {
    const from = pos(ctx, s.node);
    const to = watchFor(ctx, s.node, s.area);
    return hasLineOfSight(ctx.m.grid, from, to) ? dist(from, to) : 0;
  };
  const ordered = rng.shuffle(cts).sort((x, y) => rolePriority(x) - rolePriority(y));
  for (const a of ordered) {
    if (a.roles[0] === 'awper') {
      const best = [...remaining].sort((x, y) => sightline(y) - sightline(x))[0];
      if (best && take(a, (s) => s === best)) continue;
    }
    if (a.roles[0] === 'anchor' && take(a, (s) => s.area !== 'mid')) continue;
    // The star rifler goes where the action has been.
    if (a.roles[0] === 'star' && take(a, (s) => s.area === busier)) continue;
    take(a, () => true);
  }

  const d: DefenseState = {
    baseOf, areaOf, rotatedTo: null, rotateCalledAt: -1, retake: null,
    infoUntil: 0, delayThrown: new Set(),
  };
  ctx.defense = d;

  // Aggressive defenders send one player forward for early information.
  let infoId: string | null = null;
  if (rng.chance(tac.ctAggression * 0.5) && strat.ctInfo.length > 0) {
    const midPlayer = cts.find((a) => areaOf.get(a.id) === 'mid') ?? cts.find((a) => a.roles[0] !== 'awper');
    if (midPlayer) {
      infoId = midPlayer.id;
      d.infoUntil = 9000 + rng.int(0, 9000);
      const spot = rng.pick(strat.ctInfo);
      assign(ctx, midPlayer, gotoTask(spot, 'info', { watch: watchFor(ctx, spot, 'mid') }));
    }
  }
  // Crossfire: anchors sharing a site watch different entries (nearest first).
  const watchCount = new Map<string, number>();
  for (const a of cts) {
    if (a.id === infoId) continue;
    const base = baseOf.get(a.id)!;
    const area = areaOf.get(a.id)!;
    let watch = watchFor(ctx, base, area);
    if (area !== 'mid') {
      const k = watchCount.get(area) ?? 0;
      watchCount.set(area, k + 1);
      const here = pos(ctx, base);
      const entries = ctx.m.map.strategy.sites[area].routes.map((r) => pos(ctx, r.entry)).sort((x, y) => dist(x, here) - dist(y, here));
      watch = entries[k % entries.length]!;
    }
    assign(ctx, a, gotoTask(base, 'setup', { watch }));
  }
  return d;
}

function rolePriority(a: Agent): number {
  return a.roles[0] === 'awper' ? 0 : a.roles[0] === 'anchor' ? 1 : a.roles[0] === 'star' ? 2 : 3;
}

function threatAt(ctx: RoundCtx, site: SiteId, maxAge: number): number {
  const strat = ctx.m.map.strategy.sites[site];
  const nodes = [...strat.routes.flatMap((r) => [r.entry, r.stage]), ...strat.ctAnchors].map((n) => pos(ctx, n));
  return freshIntel(ctx, defTeam(ctx), maxAge).filter((e) => siteAt(ctx.m.grid, e.pos) === site || nodes.some((p) => dist(p, e.pos) < 320)).length;
}

export function updateDefense(ctx: RoundCtx): void {
  const d = ctx.defense;
  if (!d) return;
  const cts = defenders(ctx);
  if (cts.length === 0) return;
  const team = ctx.teams[defTeam(ctx)]!;
  const rules = ctx.m.rules;
  const noFuture = ctx.isLastRoundOfHalf || ctx.isMatchPointFor[ctx.attackerTeam]!;

  const planted = ctx.bomb.planted;
  if (planted) {
    const strat = ctx.m.map.strategy.sites[planted.site];
    if (!d.retake) {
      d.retake = { site: planted.site, pushAt: Infinity, pushing: false };
      emit(ctx.m, { type: 'call', tMs: ctx.t, team: team.index, text: `Retake ${planted.site}` });
      for (const a of cts) {
        if (siteAt(ctx.m.grid, a.pos) === planted.site) continue; // already contesting
        // Regroup at the nearest retake entrance; several entrances make a crossfire retake.
        const mine = [...strat.retakeStage].sort((x, y) => travelMs(ctx, a, x) - travelMs(ctx, a, y))[0]!;
        assign(ctx, a, gotoTask(mine, 'retake stage', { watch: planted.pos }));
      }
    }
    const remaining = planted.at + rules.timing.bombTimerMs - ctx.t;
    const active = cts.filter((a) => !a.saving);
    if (active.length === 0) return;
    const need = (a: Agent) => travelMs(ctx, a, planted.node) + (a.kit ? rules.timing.defuseKitTimeMs : rules.timing.defuseTimeMs);
    const best = Math.min(...active.map(need));
    const ts = ctx.agents.filter((a) => a.alive && a.side === 'attacker').length;
    // Save when the defuse is mathematically out of reach, or a hopeless 1vX that is worth more saved.
    const hopeless = active.length === 1 && ts >= 3 && !noFuture && ctx.rng.chance(0.01 + active[0]!.attrs.gameSense / 4000);
    if ((best + 300 > remaining && !noFuture) || hopeless) {
      for (const a of active) saveAgent(ctx, a);
      return;
    }
    if (!d.retake.pushing) {
      const gathered = active.every((a) => siteAt(ctx.m.grid, a.pos) === planted.site || strat.retakeStage.some((st) => dist(a.pos, pos(ctx, st)) < 260));
      const mustGo = remaining < best + 6000;
      if (gathered || mustGo) {
        d.retake.pushing = true;
        // Retake utility: flash the bomb area and any post-plant positions the team knows about.
        const known = freshIntel(ctx, team.index, 6000).map((e) => e.pos);
        const targets = [planted.pos, ...known].slice(0, 3);
        let ti = 0;
        for (const a of active) {
          const flash = hasUtility(a, 'flash');
          const tgt = targets[ti];
          if (!flash || !tgt || dist(a.pos, tgt) > THROW_RANGE) continue;
          throwUtility(ctx, a, flash, tgt);
          ti++;
        }
        const defuser = [...active].sort((x, y) => need(x) - need(y) || (x.id < y.id ? -1 : 1))[0]!;
        for (const a of active) {
          if (a === defuser) assign(ctx, a, { kind: 'defuse' });
          else assign(ctx, a, gotoTask(planted.node, 'retake', { watch: planted.pos }));
        }
      }
    } else if (!active.some((a) => a.task.kind === 'defuse')) {
      // Defuser died: the next closest takes over.
      const next = [...active].sort((x, y) => need(x) - need(y) || (x.id < y.id ? -1 : 1))[0]!;
      assign(ctx, next, { kind: 'defuse' });
    }
    return;
  }

  // Fall back instead of taking outnumbered fights: mid players toward spawn, lone anchors to a retake spot.
  const known = freshIntel(ctx, team.index, 2500);
  for (const a of cts) {
    if (a.target || a.task.kind !== 'hold' || a.task.reason.startsWith('fallback')) continue;
    const near = known.filter((e) => dist(e.pos, a.pos) < 1000).length;
    const area = d.areaOf.get(a.id);
    if (area === 'mid' && near >= 2) {
      const spawn = nodesWithTag(ctx.m.nav, 'defender_spawn')[0]!.id;
      const back = findPath(ctx.m.nav, a.node, spawn);
      if (back && back.length > 2) {
        const to = back[Math.min(2, back.length - 1)]!;
        assign(ctx, a, gotoTask(to, 'fallback mid', { watch: a.pos }));
        emit(ctx.m, { type: 'call', tMs: ctx.t, team: team.index, text: 'Mid falling back' });
      }
    } else if (area === 'A' || area === 'B') {
      const mates = cts.filter((x) => x !== a && siteAt(ctx.m.grid, x.pos) === area).length;
      const onSite = known.filter((e) => dist(e.pos, a.pos) < 900).length;
      const style = team.tactics.ctAggression < 0.2 ? 0.5 : 0.15;
      if (mates === 0 && onSite >= 3 && ctx.rng.chance(style + a.attrs.gameSense / 400)) {
        const spot = ctx.m.map.strategy.sites[area].retakeStage[0]!;
        assign(ctx, a, gotoTask(spot, 'fallback retake', { watch: pos(ctx, ctx.m.map.strategy.sites[area].ctAnchors[0]!) }));
      }
    }
  }

  // Information player falls back.
  for (const a of cts) {
    if (a.task.kind === 'hold' && a.task.reason === 'info' && ctx.t >= d.infoUntil) {
      const base = d.baseOf.get(a.id)!;
      assign(ctx, a, gotoTask(base, 'setup', { watch: watchFor(ctx, base, d.areaOf.get(a.id)!) }));
    }
  }

  // Delay utility at entries where attackers are reported.
  const intel = freshIntel(ctx, team.index, 2500);
  for (const site of ['A', 'B'] as const) {
    for (const r of ctx.m.map.strategy.sites[site].routes) {
      if (d.delayThrown.has(r.id)) continue;
      const entry = pos(ctx, r.entry);
      if (!intel.some((e) => dist(e.pos, entry) < 420)) continue;
      const lineup = ctx.m.map.strategy.sites[site].ctDelay.find((l) => l.route === r.id);
      if (!lineup) continue;
      const thrower = cts
        .filter((a) => (hasUtility(a, 'fire') || hasUtility(a, 'frag')) && dist(a.pos, lineup.target) <= THROW_RANGE)
        .sort((x, y) => dist(x.pos, lineup.target) - dist(y.pos, lineup.target) || (x.id < y.id ? -1 : 1))[0];
      if (!thrower || !ctx.rng.chance(0.4 + 0.6 * team.tactics.utilityUse)) {
        d.delayThrown.add(r.id);
        continue;
      }
      throwUtility(ctx, thrower, hasUtility(thrower, 'fire') ?? hasUtility(thrower, 'frag')!, lineup.target);
      d.delayThrown.add(r.id);
    }
  }

  // Rotation on information.
  const tA = threatAt(ctx, 'A', 3500);
  const tB = threatAt(ctx, 'B', 3500);
  const hot: SiteId | null = tA === tB ? null : tA > tB ? 'A' : 'B';
  if (!hot) return;
  const threat = Math.max(tA, tB);
  // Two reported attackers around a site is a standard rotate call; cautious teams wait for three.
  const threshold = team.tactics.ctRotation >= 0.35 ? 2 : 3;
  if (threat < threshold || d.rotatedTo === hot) return;
  if (d.rotateCalledAt < 0) {
    const caller = currentCalling(ctx, team).caller;
    const sense = caller ? caller.attrs.gameSense : 30;
    const delay = Math.max(200, Math.min(3000, 2100 - 14 * sense - 1000 * team.tactics.ctRotation + ctx.rng.normal(0, 300)));
    d.rotateCalledAt = ctx.t + delay;
    return;
  }
  if (ctx.t < d.rotateCalledAt) return;
  d.rotatedTo = hot;
  d.rotateCalledAt = -1;
  emit(ctx.m, { type: 'call', tMs: ctx.t, team: team.index, text: `Rotate ${hot}` });
  const strat = ctx.m.map.strategy.sites[hot];
  const keepAnchor = threat < 4;
  const otherSite: SiteId = hot === 'A' ? 'B' : 'A';
  // Partial rotation keeps one player home: a designated anchor if there is one.
  const homeGuard = keepAnchor
    ? (cts.filter((a) => d.areaOf.get(a.id) === otherSite).sort((x, y) => (x.roles[0] === 'anchor' ? 0 : 1) - (y.roles[0] === 'anchor' ? 0 : 1) || (x.id < y.id ? -1 : 1))[0] ?? null)
    : null;
  const taken = new Set(cts.filter((a) => d.areaOf.get(a.id) === hot).map((a) => d.baseOf.get(a.id)!));
  for (const a of cts) {
    const area = d.areaOf.get(a.id);
    if (area === hot || a === homeGuard) continue;
    const free = strat.ctAnchors.find((n) => !taken.has(n));
    const target = free ?? strat.retakeStage[0]!;
    if (free) taken.add(free);
    d.areaOf.set(a.id, hot);
    assign(ctx, a, gotoTask(target, 'rotate', { watch: watchFor(ctx, target, hot) }));
  }
}
