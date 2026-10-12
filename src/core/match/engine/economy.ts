/**
 * Economy: team buy decisions, individual purchases, drops and settlement.
 * All prices/rewards come from the Arsenal and Ruleset data.
 */
import type { BuyType, Side } from '../events';
import { ARSENAL, GEAR, MAX_GRENADES, UTILITY, weaponById, type WeaponDef } from '../rules/arsenal';
import type { Ruleset } from '../rules/ruleset';
import { emit, type Agent, type MapCtx, type TeamState } from './state';

export const DEFAULT_PISTOL: Record<Side, string> = { attacker: 'vanta9', defender: 'kestrel' };
const RIFLE: Record<Side, string> = { attacker: 'kraken', defender: 'sentinel' };
const BUDGET_RIFLE: Record<Side, string> = { attacker: 'galeforce', defender: 'ferrum' };
const SMG: Record<Side, string> = { attacker: 'mako', defender: 'wasp' };
const FIRE: Record<Side, string> = { attacker: 'cinder', defender: 'ember' };

const price = (id: string): number => {
  const w = ARSENAL.find((x) => x.id === id);
  if (w) return w.price;
  const u = UTILITY.find((x) => x.id === id);
  if (u) return u.price;
  switch (id) {
    case 'vest':
      return GEAR.vest.price;
    case 'vest_helmet':
      return GEAR.vestHelmet.price;
    case 'helmet':
      return GEAR.helmetUpgrade.price;
    case 'kit':
      return GEAR.kit.price;
  }
  throw new Error(`No price for ${id}`);
};

export function primaryDef(a: Agent): WeaponDef | null {
  return a.primary ? weaponById(a.primary) : null;
}

/** Monetary value of what the agent currently carries (equipment value). */
export function equipmentValue(a: Agent): number {
  let v = 0;
  if (a.primary) v += price(a.primary);
  if (a.secondary !== DEFAULT_PISTOL[a.side]) v += price(a.secondary);
  if (a.armor > 0) v += a.helmet ? GEAR.vestHelmet.price : GEAR.vest.price;
  if (a.kit) v += GEAR.kit.price;
  for (const u of a.utility) v += price(u);
  return v;
}

const isRifleTier = (a: Agent) => {
  const p = primaryDef(a);
  return !!p && (p.category === 'rifle' || p.category === 'sniper');
};

/** Cost for this agent to reach a "full buy" from what they already carry. */
function fullBuyNeed(a: Agent, wantsAwp: boolean, utilBudget: number): number {
  let need = 0;
  if (!isRifleTier(a)) need += wantsAwp ? price('lance') : price(RIFLE[a.side]);
  if (a.armor < 70) need += GEAR.vestHelmet.price;
  else if (!a.helmet) need += GEAR.helmetUpgrade.price;
  return need + utilBudget;
}

export interface BuyContext {
  readonly rules: Ruleset;
  readonly team: TeamState;
  readonly agents: Agent[];
  readonly roundInHalf: number;
  readonly isPistol: boolean;
  /** Losing this round loses the map, or money resets anyway afterwards. */
  readonly noFuture: boolean;
  readonly wonLast: boolean;
  readonly opponentLikelyEco: boolean;
}

/** Economy aggression shifts the force/save threshold (tuning hypothesis). */
const AGGRESSION_RISK = { conservative: -0.15, balanced: 0, aggressive: 0.15 } as const;
/** Money kept back on a half buy beyond the strict next-round need. */
const HALF_BUFFER = { conservative: 400, balanced: 150, aggressive: 0 } as const;

/** Effective utility appetite: tactics plus the GM's utility focus for the side being played. */
export function utilityShare(team: TeamState): number {
  const f = team.economy.utilityFocus;
  const shift = f === 'execute' ? (team.side === 'attacker' ? 0.25 : -0.1) : f === 'retake' ? (team.side === 'defender' ? 0.2 : -0.1) : 0;
  return Math.max(0, Math.min(1, team.tactics.utilityUse + shift));
}

const utilBudget = (team: TeamState) => 400 + 600 * utilityShare(team);

/**
 * Per-player spending room that still guarantees a full buy next round if this round is lost
 * (wallet + next loss bonus - full-buy need - buffer). The basis of a half buy.
 */
export function halfBudgets(rules: Ruleset, team: TeamState, agents: readonly Agent[]): number[] {
  const lossNext = lossBonus(rules, Math.min(rules.economy.lossBonus.length, team.lossStreak + 1));
  const util = utilBudget(team);
  return agents.map((a) => Math.max(0, a.money + lossNext - fullBuyNeed(a, a.roles[0] === 'awper', util) - HALF_BUFFER[team.economy.aggression]));
}

export function decideBuy(c: BuyContext): BuyType {
  if (c.isPistol) return 'pistol';
  const { agents, team, rules } = c;
  const util = utilBudget(team);
  const needs = agents.map((a) => fullBuyNeed(a, a.roles[0] === 'awper', util));
  const surplus = agents.reduce((s, a, i) => s + Math.max(0, a.money - needs[i]!), 0);
  const deficit = agents.reduce((s, a, i) => s + Math.max(0, needs[i]! - a.money), 0);
  // Drops can cover rifles only, so allow the team surplus to cover the deficit.
  const canFull = deficit === 0 || (surplus >= deficit && agents.filter((a, i) => a.money >= needs[i]! - price(RIFLE[a.side])).length >= agents.length);
  if (canFull) return 'full';
  if (c.noFuture) return 'force';
  // Won the pistol round: keep pistols/armor, add SMGs.
  if (c.wonLast && c.roundInHalf === 1) return 'bonus';

  const avg = agents.reduce((s, a) => s + a.money, 0) / agents.length;
  const lossBonusNext = lossBonus(rules, Math.min(rules.economy.lossBonus.length, team.lossStreak + 1));
  const avgNeed = needs.reduce((s, n) => s + n, 0) / needs.length;
  const fullNextIfEco = avg + lossBonusNext >= avgNeed * 0.92;
  // A force needs armour plus at least an SMG on most players.
  const forceViable = avg >= GEAR.vestHelmet.price + price(SMG.attacker) * 0.9;
  // A good caller keeps the team's economy aligned: fewer speculative forces.
  const risk = team.tactics.ecoRisk * 0.75 - (team.calling / 100 - 0.5) * 0.25 + AGGRESSION_RISK[team.economy.aggression];
  // Half buy: spend only what still guarantees next round's full buy.
  const halfViable = halfBudgets(rules, team, agents).filter((b) => b >= GEAR.vest.price).length >= 3;
  if (!forceViable) return 'eco';
  if (!fullNextIfEco) return risk > 0.35 ? 'force' : 'eco';
  // Full buy is reachable next round by saving: forcing now only with a high-risk style,
  // or when the opponent is probably saving (anti-eco is cheap and efficient).
  if (c.opponentLikelyEco && avg >= 2200) return 'force';
  if (risk > 0.62) return 'force';
  return halfViable ? 'half' : 'eco';
}

function canCarryGrenade(a: Agent): boolean {
  return a.utility.length < MAX_GRENADES;
}

function tryBuy(a: Agent, id: string, items: string[]): boolean {
  const cost = price(id);
  if (a.money < cost) return false;
  const u = UTILITY.find((x) => x.id === id);
  if (u) {
    if (!canCarryGrenade(a)) return false;
    if (a.utility.filter((x) => x === id).length >= u.maxCarried) return false;
    a.utility.push(id);
  } else if (id === 'vest') {
    if (a.armor >= 100) return false;
    a.armor = 100;
  } else if (id === 'vest_helmet') {
    if (a.armor >= 100 && a.helmet) return false;
    a.armor = 100;
    a.helmet = true;
  } else if (id === 'helmet') {
    if (a.helmet || a.armor <= 0) return false;
    a.helmet = true;
  } else if (id === 'kit') {
    if (a.kit || a.side !== 'defender') return false;
    a.kit = true;
  } else {
    const w = weaponById(id);
    if (w.side !== 'both' && w.side !== a.side) return false;
    if (w.category === 'pistol') a.secondary = id;
    else a.primary = id;
  }
  a.money -= cost;
  items.push(id);
  return true;
}

function utilityPlan(a: Agent, side: Side): string[] {
  const r = a.roles[0];
  if (r === 'entry') return ['flash', 'flash', 'smoke', FIRE[side]];
  if (r === 'support' || r === 'igl') return ['smoke', 'flash', FIRE[side], 'frag'];
  if (r === 'awper') return ['flash', 'smoke'];
  if (r === 'star') return ['flash', 'smoke', 'frag'];
  if (r === 'lurker') return ['flash', 'smoke', 'frag'];
  return ['smoke', FIRE[side], 'flash', 'frag'];
}

/**
 * Executes purchases for a team. Mutates agents and emits buy/drop events.
 * Deterministic: agents are processed in fixed order.
 */
export function executeBuys(m: MapCtx, agents: Agent[], type: BuyType, team: TeamState, tMs: number): void {
  const side = team.side;
  const bought = new Map<string, string[]>(agents.map((a) => [a.id, []]));
  const utilShare = utilityShare(team);
  const pol = team.economy;
  const retakeKits = pol.utilityFocus === 'retake' ? 1 : 0;
  let kitsWanted = side === 'defender' ? (type === 'full' ? 2 + retakeKits : type === 'force' || type === 'half' ? 1 : 0) : 0;
  const awperId = agents.find((a) => a.roles[0] === 'awper')?.id ?? null;
  const awper = agents.find((a) => a.id === awperId);
  const halfRoom = type === 'half' ? halfBudgets(m.rules, team, agents) : [];

  // A teammate who picked up a sniper hands it to the AWPer (who passes their own weapon back).
  if (awper && awper.primary !== 'lance' && pol.awpPriority !== 'low') {
    const holder = agents.find((a) => a !== awper && a.primary === 'lance');
    if (holder) {
      const back = awper.primary;
      awper.primary = 'lance';
      holder.primary = back;
      emit(m, { type: 'drop', tMs, fromPlayerId: holder.id, toPlayerId: awper.id, itemId: 'lance' });
      if (back) emit(m, { type: 'drop', tMs, fromPlayerId: awper.id, toPlayerId: holder.id, itemId: back });
    }
  }

  if (type === 'full') {
    // Drops first: players who cannot afford a rifle receive one from the richest teammates.
    // The AWPer gets the sniper dropped if they cannot afford it themselves. The donor's own
    // rifle can in turn come from a third teammate (the rifle pass below), so two or three
    // players can finance the sniper together. A low AWP priority never finances it.
    const keep = pol.awpPriority === 'high' ? GEAR.vest.price : GEAR.vestHelmet.price + 300;
    if (awper && pol.awpPriority !== 'low' && !isRifleTier(awper) && awper.money < price('lance') + GEAR.vestHelmet.price) {
      const donor = agents
        .filter((d) => d !== awper && d.money >= price('lance') + keep)
        .sort((x, y) => y.money - x.money || (x.id < y.id ? -1 : 1))[0];
      if (donor) {
        donor.money -= price('lance');
        bought.get(donor.id)!.push('lance');
        awper.primary = 'lance';
        emit(m, { type: 'drop', tMs, fromPlayerId: donor.id, toPlayerId: awper.id, itemId: 'lance' });
      }
    }
    // Rifle drops: the star rifler is first in line, then by role.
    const dropPriority = (a: Agent) => (a.roles[0] === 'star' ? 0 : a.roles[0] === 'entry' ? 1 : 2);
    const needRifle = agents
      .filter((a) => !isRifleTier(a) && a.money < price(RIFLE[side]) + GEAR.vestHelmet.price)
      .sort((x, y) => dropPriority(x) - dropPriority(y) || (x.id < y.id ? -1 : 1));
    for (const poor of needRifle) {
      const donor = agents
        .filter((d) => d !== poor && d.money >= price(RIFLE[side]) + fullBuyNeed(d, d.id === awperId, 0) + 300)
        .sort((x, y) => y.money - x.money || (x.id < y.id ? -1 : 1))[0];
      if (!donor) continue;
      donor.money -= price(RIFLE[side]);
      bought.get(donor.id)!.push(RIFLE[side]);
      poor.primary = RIFLE[side];
      emit(m, { type: 'drop', tMs, fromPlayerId: donor.id, toPlayerId: poor.id, itemId: RIFLE[side] });
    }
  }

  const awpMargin = pol.awpPriority === 'high' ? 0 : pol.awpPriority === 'low' ? 1000 : 200;
  for (const [i, a] of agents.entries()) {
    const items = bought.get(a.id)!;
    switch (type) {
      case 'pistol': {
        // Mix of armour and utility pistols, decided by role.
        if (a.roles[0] === 'entry' || a.roles[0] === 'anchor') tryBuy(a, 'vest', items);
        else {
          tryBuy(a, side === 'attacker' ? 'flash' : 'smoke', items);
          tryBuy(a, 'talon', items);
          tryBuy(a, 'flash', items);
        }
        if (kitsWanted > 0 && a.roles[0] === 'support' && tryBuy(a, 'kit', items)) kitsWanted--;
        break;
      }
      case 'full': {
        if (a.armor < 70) tryBuy(a, 'vest_helmet', items);
        else if (!a.helmet) tryBuy(a, 'helmet', items);
        // An AWPer still holding a rifle from last round upgrades when the sniper is affordable,
        // and hands the rifle to a teammate who has no rifle.
        if (a.id === awperId && a.primary && a.primary !== 'lance' && a.money >= price('lance') + awpMargin) {
          const old = a.primary;
          // Only a rifle is worth handing on, and only to a teammate who could not buy one.
          const taker = isRifleTier(a)
            ? agents.find((t) => t !== a && !isRifleTier(t) && t.money < price(RIFLE[side]) + GEAR.vestHelmet.price)
            : undefined;
          a.primary = null;
          tryBuy(a, 'lance', items);
          if (taker) {
            taker.primary = old;
            emit(m, { type: 'drop', tMs, fromPlayerId: a.id, toPlayerId: taker.id, itemId: old });
          }
        }
        if (!isRifleTier(a)) {
          if (a.id === awperId && a.money >= price('lance') + awpMargin) tryBuy(a, 'lance', items);
          else if (!tryBuy(a, RIFLE[side], items)) tryBuy(a, BUDGET_RIFLE[side], items);
        }
        if (kitsWanted > 0 && a.id !== awperId && tryBuy(a, 'kit', items)) kitsWanted--;
        const plan = utilityPlan(a, side);
        const n = Math.max(1, Math.round(plan.length * (0.45 + 0.55 * utilShare)));
        for (const u of plan.slice(0, n)) tryBuy(a, u, items);
        break;
      }
      case 'force': {
        if (a.armor < 70) {
          if (a.money >= GEAR.vestHelmet.price + price(SMG[side])) tryBuy(a, 'vest_helmet', items);
          else tryBuy(a, 'vest', items);
        }
        // A high AWP priority puts the sniper on the AWPer even on a force when it is affordable with armour.
        if (!a.primary && a.id === awperId && pol.awpPriority === 'high' && a.money >= price('lance')) tryBuy(a, 'lance', items);
        if (!a.primary) {
          if (!tryBuy(a, BUDGET_RIFLE[side], items)) if (!tryBuy(a, SMG[side], items)) tryBuy(a, 'ruin50', items);
        }
        if (kitsWanted > 0 && tryBuy(a, 'kit', items)) kitsWanted--;
        tryBuy(a, 'flash', items);
        if (utilShare > 0.5) tryBuy(a, 'smoke', items);
        break;
      }
      case 'half': {
        // Limited spend bounded by the guaranteed next-round full buy: armour, a pistol upgrade or SMG, a grenade.
        let room = halfRoom[i] ?? 0;
        const buy = (id: string) => {
          if (price(id) > room || !tryBuy(a, id, items)) return false;
          room -= price(id);
          return true;
        };
        if (a.armor < 70) buy('vest');
        if (kitsWanted > 0 && a.id !== awperId && buy('kit')) kitsWanted--;
        if (!a.primary && !buy(SMG[side]) && a.secondary === DEFAULT_PISTOL[side]) {
          if (!buy('ruin50')) buy('talon');
        }
        buy('flash');
        if (utilShare > 0.6) buy('smoke');
        break;
      }
      case 'bonus': {
        if (a.armor <= 0) tryBuy(a, a.money >= GEAR.vestHelmet.price + price(SMG[side]) ? 'vest_helmet' : 'vest', items);
        else if (!a.helmet && a.money >= GEAR.helmetUpgrade.price + price(SMG[side])) tryBuy(a, 'helmet', items);
        if (!a.primary) tryBuy(a, SMG[side], items);
        tryBuy(a, 'flash', items);
        break;
      }
      case 'eco': {
        // Save; at most a cheap upgrade for players already rich enough to full-buy next round anyway.
        if (a.money >= 3800 && a.secondary === DEFAULT_PISTOL[side]) tryBuy(a, 'talon', items);
        break;
      }
    }
  }
  for (const a of agents) {
    const items = bought.get(a.id)!;
    if (items.length === 0) continue;
    const spent = items.reduce((s, i) => s + price(i), 0);
    emit(m, { type: 'buy', tMs, playerId: a.id, items, spent, moneyAfter: a.money });
  }
}

/** Base pick-up preference: the enemy-side rifle is prized because it cannot be bought on this side. */
const PICKUP_RANK: Record<string, number> = { lance: 5, kraken: 4, sentinel: 3, ferrum: 2, galeforce: 2, pike: 1.5 };
const NEAR_MAX_MONEY = 12000;

/**
 * How much `a` wants to carry `item` into the next round. An AK-class rifle beats the M4-class one
 * for everyone; a dropped sniper beats both, except for a rich defender who is not the AWPer: they
 * can buy a sniper any round but can never buy the attacker rifle.
 */
function pickupDesire(a: Agent, item: string | null): number {
  if (!item) return 0;
  const base = PICKUP_RANK[item] ?? (weaponById(item).category === 'pistol' ? 0 : 1);
  if (item === 'lance') {
    if (a.roles[0] === 'awper') return 6;
    if (a.side === 'defender' && a.money >= NEAR_MAX_MONEY) return 3.5;
  }
  return base;
}

/**
 * After the round, surviving winners collect the weapons of the fallen (either team) and pass
 * swapped-out guns on to teammates who want them more. Every move strictly raises someone's
 * preference, so the exchange always terminates.
 */
export function recoverWeapons(m: MapCtx, agents: readonly Agent[], winnerTeam: number, tMs: number): void {
  const ground: { item: string; fromId: string; dead: boolean }[] = agents
    .filter((a) => !a.alive && a.primary)
    .map((a) => ({ item: a.primary!, fromId: a.id, dead: true }));
  const takers = agents.filter((a) => a.alive && a.team === winnerTeam);
  for (let guard = 0; guard < 20 && ground.length > 0; guard++) {
    let best: { g: number; t: Agent; gain: number } | null = null;
    ground.forEach((g, gi) => {
      for (const t of takers) {
        if (t.id === g.fromId) continue;
        const gain = pickupDesire(t, g.item) - pickupDesire(t, t.primary);
        if (gain <= 0) continue;
        if (!best || gain > best.gain || (gain === best.gain && t.id < best.t.id)) best = { g: gi, t, gain };
      }
    });
    if (!best) break;
    const { g: gi, t } = best as { g: number; t: Agent; gain: number };
    const g = ground.splice(gi, 1)[0]!;
    const old = t.primary;
    t.primary = g.item;
    if (g.dead) {
      ctxDead(agents, g.fromId).primary = null;
      emit(m, { type: 'pickup', tMs, playerId: t.id, fromPlayerId: g.fromId, itemId: g.item });
    } else emit(m, { type: 'drop', tMs, fromPlayerId: g.fromId, toPlayerId: t.id, itemId: g.item });
    if (old) ground.push({ item: old, fromId: t.id, dead: false });
  }
}

const ctxDead = (agents: readonly Agent[], id: string): Agent => agents.find((a) => a.id === id)!;

export function grantMoney(m: MapCtx, rules: Ruleset, a: Agent, delta: number, reason: 'kill' | 'round_win' | 'round_loss' | 'plant' | 'defuse' | 'plant_loss_bonus', tMs: number): void {
  const before = a.money;
  a.money = Math.max(0, Math.min(rules.economy.maxMoney, a.money + delta));
  const applied = a.money - before;
  if (applied !== 0) emit(m, { type: 'money', tMs, playerId: a.id, delta: applied, reason, moneyAfter: a.money });
}

export function lossBonus(rules: Ruleset, streak: number): number {
  const ladder = rules.economy.lossBonus;
  return ladder[Math.min(Math.max(streak, 1), ladder.length) - 1]!;
}
