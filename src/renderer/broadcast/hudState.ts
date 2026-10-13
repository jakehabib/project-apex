/**
 * Broadcast HUD state at any playback instant, derived only from the authoritative event log:
 * player HP, armour, money, weapons, utility, K/D, the kill feed, and round timeline markers.
 * Pure and cheap: recomputed every frame the HUD updates.
 */
import type { EventOf, MatchEvent, Side } from '../../core/match/events';
import { MR12_STANDARD } from '../../core/match/rules/ruleset';

export interface PlayerHud {
  readonly id: string;
  readonly team: number;
  readonly side: Side;
  readonly alive: boolean;
  readonly hp: number;
  readonly armor: number;
  readonly helmet: boolean;
  readonly money: number;
  readonly primary: string | null;
  readonly secondary: string;
  readonly utility: readonly string[];
  readonly kit: boolean;
  readonly bomb: boolean;
  /** Map totals up to this instant. */
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly roundKills: number;
  readonly flashed: boolean;
  readonly defusing: boolean;
  readonly planting: boolean;
}

export interface FeedItem {
  readonly key: number;
  readonly t: number;
  readonly killerId: string;
  readonly victimId: string;
  readonly killerTeam: number;
  readonly victimTeam: number;
  readonly weapon: string;
  readonly headshot: boolean;
  readonly trade: boolean;
  readonly assisterId: string | null;
}

export interface Marker {
  readonly t: number;
  readonly kind: 'kill' | 'plant' | 'defuse' | 'detonate' | 'end';
  readonly team: number | null;
  readonly label: string;
}

export interface RoundInfo {
  readonly roundIndex: number;
  readonly attackerTeam: number;
  readonly scoresBefore: readonly [number, number];
  readonly end: EventOf<'round_end'> | null;
  readonly plant: EventOf<'plant'> | null;
  readonly plan: string;
  readonly buyTypes: readonly [string, string];
  readonly markers: readonly Marker[];
  /** All rounds' winners so far (for the round history strip). */
  readonly history: readonly { winner: number; reason: string }[];
}

export interface HudState {
  readonly players: readonly PlayerHud[];
  readonly feed: readonly FeedItem[];
  /** Clock to show (ms): round time remaining, or bomb time once planted. */
  readonly clock: number;
  readonly bombPlanted: boolean;
  readonly scores: readonly [number, number];
}

/** Static facts about a round (computed once per round). */
export function roundInfo(events: readonly MatchEvent[], roundIndex: number): RoundInfo {
  const inRound = events.filter((e) => e.roundIndex === roundIndex);
  const start = inRound.find((e): e is EventOf<'round_start'> => e.type === 'round_start');
  const teamOf = new Map<string, number>();
  for (const e of inRound) if (e.type === 'spawn') teamOf.set(e.playerId, e.team);
  const markers: Marker[] = [];
  for (const e of inRound) {
    if (e.type === 'kill') markers.push({ t: e.tMs, kind: 'kill', team: teamOf.get(e.attackerId) ?? null, label: '' });
    else if (e.type === 'plant') markers.push({ t: e.tMs, kind: 'plant', team: teamOf.get(e.playerId) ?? null, label: `Planted ${e.site}` });
    else if (e.type === 'defuse') markers.push({ t: e.tMs, kind: 'defuse', team: teamOf.get(e.playerId) ?? null, label: 'Defused' });
    else if (e.type === 'detonate') markers.push({ t: e.tMs, kind: 'detonate', team: null, label: 'Detonated' });
    else if (e.type === 'round_end') markers.push({ t: e.tMs, kind: 'end', team: e.winnerTeam, label: e.reason.replace(/_/g, ' ') });
  }
  const history = events.filter((e): e is EventOf<'round_end'> => e.type === 'round_end' && e.roundIndex <= roundIndex).map((e) => ({ winner: e.winnerTeam, reason: e.reason }));
  return {
    roundIndex,
    attackerTeam: start?.attackerTeam ?? 0,
    scoresBefore: start?.scores ?? [0, 0],
    end: inRound.find((e): e is EventOf<'round_end'> => e.type === 'round_end') ?? null,
    plant: inRound.find((e): e is EventOf<'plant'> => e.type === 'plant') ?? null,
    plan: start?.plan ?? '',
    buyTypes: start?.buyTypes ?? ['', ''],
    markers,
    history,
  };
}

/** Everything the HUD shows at playback time `t` of round `roundIndex`. */
export function hudAt(events: readonly MatchEvent[], roundIndex: number, t: number, info: RoundInfo): HudState {
  const before = events.filter((e) => e.roundIndex < roundIndex);
  const inRound = events.filter((e) => e.roundIndex === roundIndex);
  const now = inRound.filter((e) => e.tMs <= t || e.type === 'loadout' || e.type === 'spawn' || e.type === 'buy');
  const loadout = inRound.find((e): e is EventOf<'loadout'> => e.type === 'loadout');
  const kills = new Map<string, number>();
  const deaths = new Map<string, number>();
  const assists = new Map<string, number>();
  const count = (m: Map<string, number>, id: string) => m.set(id, (m.get(id) ?? 0) + 1);
  for (const e of before) if (e.type === 'kill') {
    count(kills, e.attackerId);
    count(deaths, e.victimId);
    for (const a of e.assisterIds) count(assists, a);
  }
  const roundKills = new Map<string, number>();
  const players: PlayerHud[] = [];
  const spawns = inRound.filter((e): e is EventOf<'spawn'> => e.type === 'spawn');
  for (const s of spawns) {
    const l = loadout?.loadouts.find((x) => x.playerId === s.playerId);
    let hp = 100;
    let armor = l?.armor ?? 0;
    let money = l?.money ?? 0;
    let alive = true;
    let bomb = l?.bomb ?? false;
    const util = [...(l?.utility ?? [])];
    let flashedUntil = -1;
    let defusing = false;
    let planting = false;
    for (const e of now) {
      if (e.type === 'damage' && e.victimId === s.playerId && e.tMs <= t) {
        hp = e.hpAfter;
        armor = e.armorAfter;
      } else if (e.type === 'kill' && e.tMs <= t) {
        if (e.victimId === s.playerId) {
          alive = false;
          bomb = false;
        }
        if (e.attackerId === s.playerId) count(roundKills, s.playerId);
      } else if (e.type === 'money' && e.playerId === s.playerId && e.tMs <= t) money = e.moneyAfter;
      else if (e.type === 'utility' && e.playerId === s.playerId && e.tMs <= t) {
        const i = util.findIndex((u) => u === e.utility || (e.utility === 'fire' && (u === 'cinder' || u === 'ember')));
        if (i >= 0) util.splice(i, 1);
      } else if (e.type === 'flashed' && e.playerId === s.playerId && e.tMs <= t) flashedUntil = e.tMs + e.durationMs;
      else if (e.type === 'bomb_drop' && e.playerId === s.playerId && e.tMs <= t) bomb = false;
      else if (e.type === 'bomb_pickup' && e.playerId === s.playerId && e.tMs <= t) bomb = true;
      else if (e.type === 'plant' && e.playerId === s.playerId && e.tMs <= t) {
        bomb = false;
        planting = false;
      } else if (e.type === 'plant_start' && e.playerId === s.playerId && e.tMs <= t) planting = true;
      else if (e.type === 'plant_abort' && e.playerId === s.playerId && e.tMs <= t) planting = false;
      else if (e.type === 'defuse_start' && e.playerId === s.playerId && e.tMs <= t) defusing = true;
      else if ((e.type === 'defuse_abort' || e.type === 'defuse') && e.playerId === s.playerId && e.tMs <= t) defusing = false;
    }
    let k = kills.get(s.playerId) ?? 0;
    let dth = deaths.get(s.playerId) ?? 0;
    let as = assists.get(s.playerId) ?? 0;
    for (const e of now) if (e.type === 'kill' && e.tMs <= t) {
      if (e.attackerId === s.playerId) k++;
      if (e.victimId === s.playerId) dth++;
      if (e.assisterIds.includes(s.playerId)) as++;
    }
    players.push({
      id: s.playerId, team: s.team, side: s.side, alive, hp: alive ? hp : 0, armor: alive ? armor : 0, helmet: l?.helmet ?? false, money,
      primary: l?.primary ?? null, secondary: l?.secondary ?? '', utility: util, kit: l?.kit ?? false, bomb,
      kills: k, deaths: dth, assists: as, roundKills: roundKills.get(s.playerId) ?? 0, flashed: flashedUntil > t, defusing, planting,
    });
  }
  const teamOf = new Map(spawns.map((s) => [s.playerId, s.team]));
  const feed: FeedItem[] = now
    .filter((e): e is EventOf<'kill'> => e.type === 'kill' && e.tMs <= t)
    .map((e) => ({
      key: e.seq, t: e.tMs, killerId: e.attackerId, victimId: e.victimId, killerTeam: teamOf.get(e.attackerId) ?? 0, victimTeam: teamOf.get(e.victimId) ?? 0,
      weapon: e.weaponId, headshot: e.headshot, trade: e.tradeOfPlayerId !== null, assisterId: e.assisterIds[0] ?? null,
    }));
  const plant = info.plant && t >= info.plant.tMs ? info.plant : null;
  const clock = plant ? MR12_STANDARD.timing.bombTimerMs - (t - plant.tMs) : MR12_STANDARD.timing.roundTimeMs - Math.max(0, t);
  const scores = info.end && t >= info.end.tMs ? info.end.scores : info.scoresBefore;
  return { players, feed, clock, bombPlanted: !!plant, scores };
}
