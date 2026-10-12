/**
 * simulateMap: the single authoritative simulation of one map. Watching,
 * instant-sim, highlights and every statistic consume the events it returns.
 */
import { Rng } from '../../rng/prng';
import { fingerprint } from '../../util/hash';
import type { BuyType, MatchEvent, PlayerLoadout, RoundOutcome, Side } from '../events';
import { buildNav, node, nodesWithTag } from '../maps/nav';
import { isLastRoundOfHalf, isOvertimeHalfStart, isSideSwitchBefore, mapOutcome, roundInHalf, winTarget } from '../rules/ruleset';
import { planAttack } from './attack';
import { planDefense } from './defense';
import { DEFAULT_PISTOL, decideBuy, executeBuys, grantMoney, lossBonus } from './economy';
import { playRound } from './round';
import { emit, type Agent, type MapCtx, type RoundCtx, type TeamState } from './state';
import { DEFAULT_COACH, ENGINE_VERSION, type MapSimInput } from './types';
import { applyAdjustment, considerTimeout, setStance, STANCE_LABEL, type Stance } from './coach';
export type { Stance } from './coach';

export interface RoundSummary {
  readonly index: number;
  readonly attackerTeam: number;
  readonly winnerTeam: number;
  readonly reason: RoundOutcome;
  readonly endMs: number;
  readonly buyTypes: readonly [BuyType, BuyType];
  readonly plan: string;
  readonly scoresAfter: readonly [number, number];
}

export interface MapResult {
  readonly engineVersion: string;
  readonly matchId: string;
  readonly mapId: string;
  readonly seed: string;
  readonly teamIds: readonly [string, string];
  readonly winnerTeam: number | null;
  readonly scores: readonly [number, number];
  readonly rounds: readonly RoundSummary[];
  readonly events: readonly MatchEvent[];
  readonly fingerprint: string;
}

function createAgent(team: number, p: MapSimInput['teams'][number]['players'][number], form: number): Agent {
  return {
    id: p.id, name: p.name, team, attrs: p.attributes, roles: p.roles, isIgl: false, formFactor: form,
    side: 'attacker', alive: true, hp: 100, armor: 0, helmet: false, kit: false, money: 0,
    primary: null, secondary: 'vanta9', utility: [], bomb: false,
    node: '', edgeTo: null, pos: { x: 0, y: 0 }, motion: null, path: [], walking: false, facing: { x: 0, y: -1 },
    task: { kind: 'idle' }, taskSince: 0, assignedNode: null, saving: false,
    target: null, readyAt: 0, nextShotAt: 0, burst: 0, lastEngageAt: -1e9, stoppedAt: -1e9, blindUntil: -1e9, lastSeen: new Map(),
    seeing: [], planting: null, defusing: null,
  };
}

function stripEquipment(a: Agent): void {
  a.primary = null;
  a.secondary = DEFAULT_PISTOL[a.side];
  a.armor = 0;
  a.helmet = false;
  a.kit = false;
  a.utility = [];
  a.bomb = false;
}

function loadoutOf(a: Agent): PlayerLoadout {
  return { playerId: a.id, primary: a.primary, secondary: a.secondary, armor: a.armor, helmet: a.helmet, kit: a.kit, utility: [...a.utility], money: a.money, bomb: a.bomb };
}

/** A manager's stance call, applied from the start of `round` (a legal decision point: freeze time). */
export interface ManagerInstruction {
  readonly round: number;
  readonly team: 0 | 1;
  readonly stance: Stance;
}

/**
 * A map simulated one round at a time. The only inputs are the setup and the
 * manager instructions recorded so far, so stepping round by round with a given
 * instruction log gives exactly the same result as `simulateMap` with that log.
 */
export class MapSimulation {
  private readonly input: MapSimInput;
  private readonly m: MapCtx;
  private readonly rng: Rng;
  private readonly teams: [TeamState, TeamState];
  private readonly agents: Agent[];
  private readonly byId: Map<string, Agent>;
  private readonly instructions: ManagerInstruction[];
  readonly rounds: RoundSummary[] = [];
  private r = 0;
  private lastWinner: number | null = null;
  private winner: number | null = null;
  private finished = false;
  private cached: MapResult | null = null;

  constructor(input: MapSimInput) {
    this.input = input;
    this.instructions = [...(input.instructions ?? [])];
    const { map, ruleset: rules } = input;
    const nav = buildNav(map);
    const rng = (this.rng = Rng.fromSeed(`${input.seed}|${map.id}|${input.mapIndex}`));
    void rng;
    const m: MapCtx = (this.m = { map, nav, grid: nav.grid, rules, rng: this.rng, events: [], seq: 0, roundIndex: 0, trace: input.trace });
    const f = rules.format;

    const teams = (this.teams = input.teams.map((setup, i): TeamState => {
      const igl = [...setup.players].sort((x, y) => (y.roles.includes('igl') ? 1000 : 0) + y.attributes.calling - ((x.roles.includes('igl') ? 1000 : 0) + x.attributes.calling))[0]!;
      const coach = setup.coach ?? DEFAULT_COACH;
      return {
        index: i, setup, tactics: setup.tactics, coach, timeoutsLeft: f.timeoutsPerTeam, adjustment: null, history: [], stance: 'balanced',
        side: (i === input.firstAttacker ? 'attacker' : 'defender') as Side,
        score: 0, lossStreak: rules.economy.halfStartLossStreak, intel: new Map(),
        memory: { executes: { A: 0, B: 0 }, defendersSeen: { A: 0, B: 0 } }, iglId: igl.id,
        // Reads of opponent tendencies: mostly the IGL, partly the coach's preparation work.
        calling: 0.75 * igl.attributes.calling + 0.25 * coach.reading,
      };
    }) as [TeamState, TeamState]);

    const agents: Agent[] = (this.agents = []);
    input.teams.forEach((setup, ti) => {
      const prof = setup.mapProficiency?.[map.id] ?? 0.5;
      const prep = ((setup.coach ?? DEFAULT_COACH).preparation - 50) / 50;
      for (const p of setup.players) {
        const form = 0.95 + 0.06 * prof + 0.02 * ((p.attributes.adaptability - 50) / 50) + 0.015 * prep;
        const a = createAgent(ti, p, form);
        a.isIgl = p.id === teams[ti]!.iglId;
        a.side = teams[ti]!.side;
        a.secondary = DEFAULT_PISTOL[a.side];
        a.money = rules.economy.startMoney;
        agents.push(a);
      }
    });
    this.byId = new Map(agents.map((a) => [a.id, a]));
    emit(m, { type: 'map_start', tMs: -rules.timing.freezeTimeMs, mapId: map.id, seed: input.seed, engineVersion: ENGINE_VERSION, teams: [input.teams[0].id, input.teams[1].id], firstAttacker: input.firstAttacker });
  }

  get done(): boolean {
    return this.finished;
  }
  /** Index of the next round to be played. */
  get nextRound(): number {
    return this.r;
  }
  get events(): readonly MatchEvent[] {
    return this.m.events;
  }
  get scores(): [number, number] {
    return [this.teams[0].score, this.teams[1].score];
  }
  /** All manager instructions so far (the input log that reproduces this map). */
  get instructionLog(): readonly ManagerInstruction[] {
    return this.instructions;
  }
  stanceOf(team: 0 | 1): Stance {
    return this.teams[team].stance;
  }

  /** Records a stance call that takes effect from the next round played. */
  instruct(team: 0 | 1, stance: Stance): void {
    if (this.finished) return;
    const existing = this.instructions.findIndex((i) => i.round === this.r && i.team === team);
    if (existing >= 0) this.instructions.splice(existing, 1);
    this.instructions.push({ round: this.r, team, stance });
  }

  /** Plays the next round. Returns its summary, or null if the map is over. */
  step(): RoundSummary | null {
    if (this.finished) return null;
    const { m, rng, teams, agents, byId } = this;
    const rules = m.rules;
    const f = rules.format;
    const nav = m.nav;
    const r = this.r;
    if (r >= f.regulationRounds + f.overtimeRounds * 30) {
      this.finished = true;
      return null;
    }
    m.roundIndex = r;
    if (isSideSwitchBefore(f, r)) {
      const ot = r >= f.regulationRounds;
      const money = ot ? rules.economy.overtimeStartMoney : rules.economy.startMoney;
      for (const t of teams) {
        t.side = t.side === 'attacker' ? 'defender' : 'attacker';
        t.lossStreak = rules.economy.halfStartLossStreak;
        t.memory = { executes: { A: 0, B: 0 }, defendersSeen: { A: 0, B: 0 } };
        applyAdjustment(t, null);
      }
      for (const a of agents) {
        a.side = teams[a.team]!.side;
        stripEquipment(a);
        a.money = money;
      }
      this.lastWinner = null;
      emit(m, { type: 'side_switch', tMs: -rules.timing.freezeTimeMs, reason: ot ? 'overtime_half' : 'half', money });
    }
    if (isOvertimeHalfStart(f, r) && !isSideSwitchBefore(f, r)) {
      // Overtime half without a side swap (start of every overtime set): fresh overtime money.
      for (const a of agents) {
        stripEquipment(a);
        const delta = rules.economy.overtimeStartMoney - a.money;
        a.money = rules.economy.overtimeStartMoney;
        if (delta !== 0) emit(m, { type: 'money', tMs: -rules.timing.freezeTimeMs, playerId: a.id, delta, reason: 'reset', moneyAfter: a.money });
      }
      for (const t of teams) t.lossStreak = rules.economy.halfStartLossStreak;
      this.lastWinner = null;
    }

    const attackerTeam = teams[0]!.side === 'attacker' ? 0 : 1;
    const freeze = -rules.timing.freezeTimeMs;
    const inHalf = roundInHalf(f, r);
    const lastOfHalf = isLastRoundOfHalf(f, r);
    const scores: [number, number] = [teams[0]!.score, teams[1]!.score];
    const matchPoint: [boolean, boolean] = [
      scores[0] + 1 >= winTarget(f, r + 1),
      scores[1] + 1 >= winTarget(f, r + 1),
    ];

    // Reset per-round state and spawn.
    const tSpawns = nodesWithTag(nav, 'attacker_spawn');
    const ctSpawns = nodesWithTag(nav, 'defender_spawn');
    const roundRng = rng.fork(`round-${r}`);
    const shuffledT = roundRng.shuffle(tSpawns);
    const shuffledCt = roundRng.shuffle(ctSpawns);
    let ti = 0;
    let ci = 0;
    for (const a of agents) {
      const spawn = a.side === 'attacker' ? shuffledT[ti++ % shuffledT.length]! : shuffledCt[ci++ % shuffledCt.length]!;
      Object.assign(a, {
        alive: true, hp: 100, node: spawn.id, edgeTo: null, pos: spawn.pos, motion: null, path: [], walking: false,
        facing: a.side === 'attacker' ? { x: 0, y: -1 } : { x: 0, y: 1 }, task: { kind: 'idle' }, taskSince: 0,
        assignedNode: null, saving: false, target: null, readyAt: 0, nextShotAt: 0, burst: 0, lastEngageAt: -1e9, stoppedAt: -1e9,
        blindUntil: -1e9, lastSeen: new Map(), seeing: [], planting: null, defusing: null, bomb: false,
      });
    }
    for (const t of teams) t.intel = new Map();

    // Coach timeouts (legal decision point: before the round, during freeze time).
    const sideStart = (() => {
      let k = r;
      while (k > 0 && !isSideSwitchBefore(f, k)) k--;
      return k;
    })();
    for (const t of teams) considerTimeout(m, t, roundRng, r - sideStart, freeze);
    // Manager stance calls (inputs): applied from this round.
    for (const ins of this.instructions) {
      if (ins.round !== r) continue;
      const t = teams[ins.team];
      if (t.stance === ins.stance) continue;
      setStance(t, ins.stance);
      emit(m, { type: 'call', tMs: freeze, team: t.index, text: `Coach: ${STANCE_LABEL[ins.stance]}` });
    }

    // Economy.
    const buyTypes: [BuyType, BuyType] = ['eco', 'eco'];
    for (const t of teams) {
      const mine = agents.filter((a) => a.team === t.index);
      const opp = agents.filter((a) => a.team !== t.index);
      const oppAvg = opp.reduce((s, a) => s + a.money, 0) / opp.length;
      buyTypes[t.index] = decideBuy({
        rules, team: t, agents: mine, roundInHalf: inHalf, isPistol: inHalf === 0 && r < f.regulationRounds,
        noFuture: lastOfHalf || matchPoint[1 - t.index]!, wonLast: this.lastWinner === t.index,
        opponentLikelyEco: this.lastWinner === t.index && inHalf === 1 ? true : oppAvg < 2000,
      });
    }
    // Planners must never see the opponent's private buy decision; it is only used for events.
    const roundCtx: RoundCtx = {
      m, teams, agents, byId, rng: roundRng, attackerTeam, t: freeze,
      smokes: [], fires: [], pending: [], bomb: { carrierId: null, dropped: null, planted: null, defused: false },
      damageLog: new Map(), recentKills: [], ended: false, plan: null, defense: null,
      isLastRoundOfHalf: lastOfHalf, isMatchPointFor: matchPoint, saveCheck: ['', ''],
    };
    for (const t of teams) executeBuys(m, agents.filter((a) => a.team === t.index), buyTypes[t.index]!, t, freeze);

    // Bomb to a support/IGL where possible.
    const ts = agents.filter((a) => a.side === 'attacker');
    const pref = ts.filter((a) => a.roles[0] !== 'entry' && a.roles[0] !== 'awper');
    const carrier = roundRng.pick(pref.length ? pref : ts);
    carrier.bomb = true;
    roundCtx.bomb.carrierId = carrier.id;

    emit(m, { type: 'loadout', tMs: freeze, loadouts: agents.map(loadoutOf) });
    for (const a of agents) emit(m, { type: 'spawn', tMs: freeze, playerId: a.id, team: a.team, side: a.side, nodeId: a.node, pos: node(nav, a.node).pos });

    roundCtx.t = 0;
    const plan = planAttack(roundCtx, buyTypes[attackerTeam]!);
    planDefense(roundCtx);
    emit(m, { type: 'round_start', tMs: 0, attackerTeam, scores, buyTypes, plan: plan.description });

    const res = playRound(roundCtx);
    const winTeam = teams[res.winnerTeam]!;
    const loseTeam = teams[1 - res.winnerTeam]!;
    winTeam.score++;
    const newScores: [number, number] = [teams[0]!.score, teams[1]!.score];
    emit(m, { type: 'round_end', tMs: res.endMs, winnerTeam: res.winnerTeam, reason: res.reason, scores: newScores });

    // Settlement.
    const rw = rules.economy.winReward;
    const winReward =
      res.reason === 'bomb_detonated' ? rw.bombDetonated : res.reason === 'bomb_defused' ? rw.bombDefused : res.reason === 'time_expired' ? rw.timeExpired : rw.elimination;
    for (const a of agents.filter((x) => x.team === winTeam.index)) grantMoney(m, rules, a, winReward, 'round_win', res.endMs);
    loseTeam.lossStreak = Math.min(rules.economy.lossBonus.length, loseTeam.lossStreak + 1);
    winTeam.lossStreak = Math.max(0, winTeam.lossStreak - 1);
    const lb = lossBonus(rules, loseTeam.lossStreak);
    for (const a of agents.filter((x) => x.team === loseTeam.index)) {
      const timeoutSurvivor = rules.economy.noRewardForTimeoutSurvivors && res.reason === 'time_expired' && a.side === 'attacker' && a.alive;
      if (!timeoutSurvivor) grantMoney(m, rules, a, lb, 'round_loss', res.endMs);
      if (a.side === 'attacker' && res.planted) grantMoney(m, rules, a, rules.economy.attackerPlantLossBonus, 'plant_loss_bonus', res.endMs);
    }
    for (const a of agents) {
      if (!a.alive) stripEquipment(a);
      a.bomb = false;
    }

    // Cross-round memory (same information both teams could legitimately have).
    const att = teams[attackerTeam]!;
    const def = teams[1 - attackerTeam]!;
    for (const s of ['A', 'B'] as const) att.memory.defendersSeen[s] = att.memory.defendersSeen[s] * 0.6 + plan.earlySeen[s];
    if (roundCtx.bomb.planted) def.memory.executes[roundCtx.bomb.planted.site]++;
    else if (plan.phase === 'execute') def.memory.executes[plan.site] += 0.5;

    const decidedSite = roundCtx.bomb.planted?.site ?? (plan.phase !== 'setup' ? plan.site : null);
    for (const t of teams) {
      t.history.push({ won: res.winnerTeam === t.index, side: t.side, site: decidedSite, planted: !!roundCtx.bomb.planted, fast: res.endMs < 45000, endMs: res.endMs });
    }

    this.rounds.push({ index: r, attackerTeam, winnerTeam: res.winnerTeam, reason: res.reason, endMs: res.endMs, buyTypes, plan: plan.description, scoresAfter: newScores });
    this.lastWinner = res.winnerTeam;

    this.r = r + 1;
    const outcome = mapOutcome(f, newScores, r + 1);
    if (outcome !== null) {
      this.winner = outcome === 'draw' ? null : outcome;
      this.finished = true;
    }
    return this.rounds[this.rounds.length - 1]!;
  }

  /** Plays every remaining round. */
  finish(): void {
    while (this.step()) {
      /* keep playing */
    }
  }

  /** The finished map. Calling it before the map ends plays the remaining rounds. */
  result(): MapResult {
    if (this.cached) return this.cached;
    this.finish();
    const { m, teams, input } = this;
    const scores: [number, number] = [teams[0].score, teams[1].score];
    emit(m, { type: 'map_end', tMs: 0, winnerTeam: this.winner, scores });
    const body = {
      engineVersion: ENGINE_VERSION, matchId: input.matchId, mapId: input.map.id, seed: input.seed,
      teamIds: [input.teams[0].id, input.teams[1].id] as const, winnerTeam: this.winner, scores, rounds: this.rounds, events: m.events,
    };
    // The fingerprint (a hash of the full event log) is only needed for determinism checks: computed on first access.
    let fp: string | null = null;
    const result = { ...body } as unknown as MapResult;
    Object.defineProperty(result, 'fingerprint', { enumerable: true, get: () => (fp ??= fingerprint({ s: body.scores, e: body.events })) });
    this.cached = result;
    return result;
  }
}

export function simulateMap(input: MapSimInput): MapResult {
  return new MapSimulation(input).result();
}
