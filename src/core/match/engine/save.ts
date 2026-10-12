/**
 * Save decisions. A team (its current caller) abandons a round when the chance
 * of winning it is worth less than the equipment its survivors would carry
 * into the next round. The decision uses only what the team knows: the kill
 * feed (alive counts), the bomb state, the clock and its own economy.
 *
 * Win chances start from man-advantage conversion priors (the calibration
 * pack's state seeds), adjusted for the objective, time and equipment.
 */
import { siteAt } from '../maps/grid';
import { lossBonus } from './economy';
import { activeWeapon } from './combat';
import { saveAgent } from './attack';
import { currentCalling, emit, type Agent, type RoundCtx } from './state';
import { travelMs } from './movement';

/** P(side with `m` alive beats `e` alive) on neutral terms, from the calibration state seeds. */
const FAVOURED: Record<string, number> = {
  '5v4': 0.72, '5v3': 0.9, '5v2': 0.97, '5v1': 0.995,
  '4v3': 0.78, '4v2': 0.9, '4v1': 0.98,
  '3v2': 0.78, '3v1': 0.93,
  '2v1': 0.77,
};

export function neutralWinChance(m: number, e: number): number {
  if (m <= 0) return 0;
  if (e <= 0) return 1;
  if (m === e) return 0.5;
  if (m > e) return FAVOURED[`${m}v${e}`] ?? 0.99;
  return 1 - (FAVOURED[`${e}v${m}`] ?? 0.99);
}

/** 0..1 equipment strength of one player. */
function gear(a: Agent): number {
  const w = activeWeapon(a);
  const gun = w.category === 'sniper' ? 1 : w.category === 'rifle' ? (w.price >= 2500 ? 0.92 : 0.75) : w.category === 'smg' || w.category === 'heavy' ? 0.55 : w.price >= 500 ? 0.35 : 0.22;
  return gun * (a.armor > 0 ? 1 : 0.8);
}

const odds = (p: number) => p / Math.max(1e-6, 1 - p);
const prob = (o: number) => o / (1 + o);

/** Estimated chance that `team` wins the round from here. */
export function roundWinChance(ctx: RoundCtx, team: number): number {
  const mine = ctx.agents.filter((a) => a.alive && a.team === team && !a.saving);
  const theirs = ctx.agents.filter((a) => a.alive && a.team !== team);
  let p = neutralWinChance(mine.length, theirs.length);
  if (p <= 0 || p >= 1) return p;
  // Equipment: a rifle side against pistols is a large edge.
  const g = (xs: Agent[]) => xs.reduce((s, a) => s + gear(a), 0) / Math.max(1, xs.length);
  let o = odds(p) * Math.exp(2.2 * (g(mine) - g(theirs)));
  const rules = ctx.m.rules;
  const attacking = team === ctx.attackerTeam;
  const planted = ctx.bomb.planted;
  if (planted) {
    // Retaking against a set post-plant is hard (CTs win about a quarter of planted rounds).
    o *= attacking ? 2.6 : 1 / 2.6;
    if (!attacking) {
      const left = planted.at + rules.timing.bombTimerMs - ctx.t;
      const need = Math.min(...mine.map((a) => travelMs(ctx, a, planted.node) + (a.kit ? rules.timing.defuseKitTimeMs : rules.timing.defuseTimeMs)));
      if (need + 1500 > left) return 0;
      if (need + 6000 > left) o *= 0.45;
    }
  } else if (!attacking) {
    // Before a plant the clock works for the defenders: attackers must still take a site.
    o *= 1.5;
  } else {
    // Attackers must still reach a site and plant before time runs out.
    const left = rules.timing.roundTimeMs - ctx.t;
    const site = ctx.plan?.site ?? 'A';
    const spot = ctx.m.map.strategy.sites[site].routes[0]!.clear[0]!;
    const need = Math.min(...mine.map((a) => travelMs(ctx, a, spot))) + rules.timing.plantTimeMs;
    if (need + 1500 > left) return 0;
    if (need + 12000 > left) o *= 0.5;
    if (mine.some((a) => a.bomb) === false && !ctx.bomb.dropped) o *= 0.2;
  }
  p = prob(o);
  return Math.max(0, Math.min(1, p));
}

/** How much the survivors' equipment matters for next round, 0..1. */
function saveImportance(ctx: RoundCtx, team: number): number {
  const rules = ctx.m.rules;
  const t = ctx.teams[team]!;
  const members = ctx.agents.filter((a) => a.team === team);
  const survivors = members.filter((a) => a.alive);
  const kept = survivors.reduce((s, a) => s + (a.primary ? activeWeapon(a).price : 0) + (a.armor > 50 ? 650 : 0), 0);
  if (kept < 1500) return 0; // pistols and nothing to protect
  const bank = members.reduce((s, a) => s + a.money, 0) + 5 * lossBonus(rules, Math.min(rules.economy.lossBonus.length, t.lossStreak + 1));
  const fullBuy = 5 * 4600;
  // Saving matters most when the bank alone cannot fund a full buy but bank + kept gear gets close.
  const shortfall = Math.max(0, Math.min(1, (fullBuy - bank) / fullBuy));
  const keptShare = Math.min(1, kept / fullBuy);
  return Math.min(1, 0.25 + 0.9 * shortfall + 0.6 * keptShare);
}

/**
 * Evaluated by each side whenever the situation changes (a death, the plant).
 * Saving is never chosen when the round decides the half or the map.
 */
export function considerSave(ctx: RoundCtx): void {
  if (ctx.t < 15000) return;
  for (const team of [0, 1]) {
    const members = ctx.agents.filter((a) => a.alive && a.team === team);
    if (members.length === 0 || members.every((a) => a.saving)) continue;
    const enemies = ctx.agents.filter((a) => a.alive && a.team !== team).length;
    const key = `${members.length}v${enemies}:${ctx.bomb.planted ? 'p' : 'n'}:${Math.floor(ctx.t / 30000)}`;
    if (ctx.saveCheck[team] === key) continue;
    ctx.saveCheck[team] = key;
    const attacking = team === ctx.attackerTeam;
    if (attacking && ctx.bomb.planted) continue; // attackers defend the bomb; the timer works for them
    // Last round of the half, or the opponent is one round from the map: nothing to save for.
    if (ctx.isLastRoundOfHalf || ctx.isMatchPointFor[1 - team]) continue;
    const p = roundWinChance(ctx, team);
    const importance = saveImportance(ctx, team);
    if (importance <= 0) continue;
    const threshold = 0.015 + 0.085 * importance;
    ctx.m.trace?.('save_check', { t: ctx.t, team, attacking, alive: members.length, enemies, planted: !!ctx.bomb.planted, p, importance, threshold });
    if (p >= threshold) continue;
    // The caller makes the call; disciplined teams follow it reliably, others sometimes play for the hero round.
    const { calling, caller } = currentCalling(ctx, ctx.teams[team]!);
    const judgement = (calling + (caller?.attrs.gameSense ?? 40)) / 200;
    if (!ctx.rng.chance(0.55 + 0.4 * judgement)) continue;
    emit(ctx.m, { type: 'call', tMs: ctx.t, team, text: 'Save' });
    for (const a of members) {
      // A player already in a duel or on the bomb finishes what they started.
      if (a.target || a.defusing || (ctx.bomb.planted && siteAt(ctx.m.grid, a.pos) === ctx.bomb.planted.site && a.task.kind === 'defuse')) continue;
      if (!a.saving) saveAgent(ctx, a);
    }
  }
}
