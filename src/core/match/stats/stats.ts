/**
 * Canonical statistics: a pure fold over match events. Nothing displayed in the
 * game may be computed any other way.
 *
 * The player rating is AMR (APEX Match Rating, see amr.ts and docs/AMR_BRIEF.md).
 */
import type { MatchEvent, Side } from '../events';
import { amrFromTotals, computeAmr, type AmrBreakdown, type PlayerAmr } from './amr';

export interface PlayerStats {
  readonly playerId: string;
  team: number;
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshotKills: number;
  openingKills: number;
  openingDeaths: number;
  tradeKills: number;
  tradedDeaths: number;
  multiKills: [number, number, number, number]; // 2K,3K,4K,5K
  clutchesWon: number;
  clutchAttempts: number;
  kastRounds: number;
  survived: number;
  plants: number;
  defuses: number;
  utilityThrown: number;
  enemiesFlashed: number;
  utilityDamage: number;
}

export interface DerivedPlayerStats extends PlayerStats {
  readonly adr: number;
  readonly kast: number;
  readonly kpr: number;
  readonly hsPct: number;
  /** AMR for this map. */
  readonly rating: number;
  readonly amr: AmrBreakdown | null;
  readonly amrTotals: PlayerAmr | null;
}

export interface TeamStats {
  rounds: number;
  attackRounds: number;
  attackWins: number;
  defenseRounds: number;
  defenseWins: number;
  pistolWins: number;
  plants: number;
  defuses: number;
  /** Rounds won while on eco/force against a full buy. */
  upsetWins: number;
}

export interface MapStats {
  readonly players: Map<string, DerivedPlayerStats>;
  readonly teams: [TeamStats, TeamStats];
  readonly roundsPlayed: number;
}

const UTIL_WEAPONS = new Set(['frag', 'cinder', 'ember']);

const emptyPlayer = (playerId: string, team: number): PlayerStats => ({
  playerId, team, rounds: 0, kills: 0, deaths: 0, assists: 0, damage: 0, headshotKills: 0, openingKills: 0, openingDeaths: 0,
  tradeKills: 0, tradedDeaths: 0, multiKills: [0, 0, 0, 0], clutchesWon: 0, clutchAttempts: 0, kastRounds: 0, survived: 0,
  plants: 0, defuses: 0, utilityThrown: 0, enemiesFlashed: 0, utilityDamage: 0,
});

const emptyTeam = (): TeamStats => ({ rounds: 0, attackRounds: 0, attackWins: 0, defenseRounds: 0, defenseWins: 0, pistolWins: 0, plants: 0, defuses: 0, upsetWins: 0 });

export function computeMapStats(events: readonly MatchEvent[]): MapStats {
  const players = new Map<string, PlayerStats>();
  const teams: [TeamStats, TeamStats] = [emptyTeam(), emptyTeam()];
  const teamOf = new Map<string, number>();
  const sideOf = new Map<string, Side>();
  let roundsPlayed = 0;

  // Per-round scratch.
  let alive = new Set<string>();
  let roundKills = new Map<string, number>();
  let contributed = new Set<string>();
  let firstKillDone = false;
  let clutcher: { id: string; vs: number } | null = null;
  let attackerTeam = 0;
  let buyTypes: readonly [string, string] = ['full', 'full'];
  let roundIndexInHalf = 0;
  let lastSwitchRound = 0;

  const ps = (id: string) => {
    let p = players.get(id);
    if (!p) {
      p = emptyPlayer(id, teamOf.get(id) ?? 0);
      players.set(id, p);
    }
    return p;
  };

  for (const e of events) {
    switch (e.type) {
      case 'side_switch':
        lastSwitchRound = e.roundIndex;
        break;
      case 'spawn':
        teamOf.set(e.playerId, e.team);
        sideOf.set(e.playerId, e.side);
        ps(e.playerId).team = e.team;
        break;
      case 'round_start':
        alive = new Set([...teamOf.keys()]);
        roundKills = new Map();
        contributed = new Set();
        firstKillDone = false;
        clutcher = null;
        attackerTeam = e.attackerTeam;
        buyTypes = e.buyTypes;
        roundIndexInHalf = e.roundIndex - lastSwitchRound;
        break;
      case 'damage': {
        if (teamOf.get(e.attackerId) !== teamOf.get(e.victimId)) {
          ps(e.attackerId).damage += e.amount;
          if (UTIL_WEAPONS.has(e.weaponId)) ps(e.attackerId).utilityDamage += e.amount;
        }
        break;
      }
      case 'kill': {
        const killer = ps(e.attackerId);
        const victim = ps(e.victimId);
        alive.delete(e.victimId);
        const enemyKill = teamOf.get(e.attackerId) !== teamOf.get(e.victimId);
        if (enemyKill) {
          killer.kills++;
          if (e.headshot) killer.headshotKills++;
          roundKills.set(e.attackerId, (roundKills.get(e.attackerId) ?? 0) + 1);
          contributed.add(e.attackerId);
          if (!firstKillDone) {
            killer.openingKills++;
            victim.openingDeaths++;
            firstKillDone = true;
          }
          if (e.tradeOfPlayerId) {
            killer.tradeKills++;
            ps(e.tradeOfPlayerId).tradedDeaths++;
            contributed.add(e.tradeOfPlayerId); // KAST: traded death counts
          }
          for (const a of e.assisterIds) {
            ps(a).assists++;
            contributed.add(a);
          }
        }
        victim.deaths++;
        // Clutch detection: a player becomes the last one alive on their team.
        if (!clutcher) {
          for (const t of [0, 1]) {
            const mine = [...alive].filter((id) => teamOf.get(id) === t);
            const theirs = [...alive].filter((id) => teamOf.get(id) !== t);
            if (mine.length === 1 && theirs.length >= 1) {
              clutcher = { id: mine[0]!, vs: theirs.length };
              ps(mine[0]!).clutchAttempts++;
              break;
            }
          }
        }
        break;
      }
      case 'plant':
        ps(e.playerId).plants++;
        teams[teamOf.get(e.playerId)!]!.plants++;
        break;
      case 'defuse':
        ps(e.playerId).defuses++;
        teams[teamOf.get(e.playerId)!]!.defuses++;
        break;
      case 'utility':
        ps(e.playerId).utilityThrown++;
        break;
      case 'flashed':
        if (teamOf.get(e.byPlayerId) !== teamOf.get(e.playerId)) ps(e.byPlayerId).enemiesFlashed++;
        break;
      case 'round_end': {
        roundsPlayed++;
        for (const id of teamOf.keys()) {
          const p = ps(id);
          p.rounds++;
          if (alive.has(id)) {
            p.survived++;
            contributed.add(id);
          }
          if (contributed.has(id)) p.kastRounds++;
          const k = roundKills.get(id) ?? 0;
          if (k >= 2) p.multiKills[Math.min(k, 5) - 2]!++;
        }
        if (clutcher && teamOf.get(clutcher.id) === e.winnerTeam) ps(clutcher.id).clutchesWon++;
        for (const t of [0, 1] as const) {
          const ts = teams[t];
          ts.rounds++;
          const attacking = t === attackerTeam;
          if (attacking) ts.attackRounds++;
          else ts.defenseRounds++;
          if (e.winnerTeam === t) {
            if (attacking) ts.attackWins++;
            else ts.defenseWins++;
            if (roundIndexInHalf === 0 && buyTypes[t] === 'pistol') ts.pistolWins++;
            if ((buyTypes[t] === 'eco' || buyTypes[t] === 'force') && buyTypes[1 - t] === 'full') ts.upsetWins++;
          }
        }
        break;
      }
    }
  }

  const derived = new Map<string, DerivedPlayerStats>();
  const amr = computeAmr(events);
  for (const [id, p] of players) derived.set(id, derive(p, amr.get(id) ?? null));
  return { players: derived, teams, roundsPlayed };
}

export function derive(p: PlayerStats, amr: PlayerAmr | null = null): DerivedPlayerStats {
  const r = Math.max(1, p.rounds);
  const kpr = p.kills / r;
  const adr = p.damage / r;
  const kast = p.kastRounds / r;
  const breakdown = amr ? amrFromTotals(amr.total) : null;
  return { ...p, multiKills: [...p.multiKills] as [number, number, number, number], adr, kast, kpr, hsPct: p.kills ? p.headshotKills / p.kills : 0, rating: breakdown?.amr ?? 0, amr: breakdown, amrTotals: amr };
}
