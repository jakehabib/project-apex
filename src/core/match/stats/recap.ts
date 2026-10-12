/**
 * Match recap: everything the post-match page shows, derived only from the
 * map's events. Storylines are generated from what actually happened.
 */
import type { BuyType, MatchEvent, RoundOutcome } from '../events';
import { amrFromTotals, computeAmr, type AmrBreakdown } from './amr';

export interface RecapPlayer {
  readonly id: string;
  readonly team: number;
  readonly kills: number;
  readonly deaths: number;
  readonly assists: number;
  readonly amr: AmrBreakdown;
  readonly tSide: AmrBreakdown | null;
  readonly ctSide: AmrBreakdown | null;
  readonly openingKills: number;
  readonly openingDeaths: number;
  readonly clutchesWon: number;
  readonly multiKills: readonly [number, number, number, number];
}

export interface RecapRound {
  readonly index: number;
  readonly winnerTeam: number;
  readonly attackerTeam: number;
  readonly reason: RoundOutcome;
  readonly buyTypes: readonly [BuyType, BuyType];
  readonly scoresAfter: readonly [number, number];
  readonly highlight: string | null;
}

export interface Storyline {
  readonly kind: 'result' | 'comeback' | 'mvp' | 'clutch' | 'multikill' | 'pistol' | 'upset' | 'streak' | 'overtime' | 'half' | 'timeout' | 'coach';
  readonly title: string;
  readonly text: string;
  readonly round: number | null;
  readonly weight: number;
}

export interface MapRecap {
  readonly scores: readonly [number, number];
  readonly winnerTeam: number | null;
  readonly halftime: readonly [number, number] | null;
  readonly players: readonly RecapPlayer[];
  readonly mvpId: string | null;
  readonly rounds: readonly RecapRound[];
  readonly storylines: readonly Storyline[];
  readonly teamStats: readonly { readonly pistolWins: number; readonly ctRoundsWon: number; readonly tRoundsWon: number; readonly plants: number; readonly defuses: number; readonly ecoUpsets: number; readonly longestStreak: number }[];
}

type Names = (id: string) => string;

export function buildRecap(events: readonly MatchEvent[], teamNames: readonly [string, string], playerName: Names): MapRecap {
  const amr = computeAmr(events);
  const team = new Map<string, number>();
  for (const e of events) if (e.type === 'spawn') team.set(e.playerId, e.team);

  const rounds: RecapRound[] = [];
  const stories: Storyline[] = [];
  const ts = [0, 1].map(() => ({ pistolWins: 0, ctRoundsWon: 0, tRoundsWon: 0, plants: 0, defuses: 0, ecoUpsets: 0, longestStreak: 0 }));
  let attackerTeam = 0;
  let buyTypes: readonly [BuyType, BuyType] = ['full', 'full'];
  let alive = new Set<string>();
  let roundKills = new Map<string, number>();
  let clutch: { id: string; vs: number } | null = null;
  let halftime: [number, number] | null = null;
  let lastSwitch = 0;
  let streak = { team: -1, n: 0 };
  let biggestDeficit = [0, 0];
  let timeouts: { team: number; round: number; reason: string }[] = [];
  let coachCalls: { team: number; round: number; text: string }[] = [];
  let scores: readonly [number, number] = [0, 0];

  for (const e of events) {
    switch (e.type) {
      case 'side_switch':
        if (e.reason === 'half' && !halftime) halftime = [scores[0], scores[1]];
        lastSwitch = e.roundIndex;
        break;
      case 'round_start':
        attackerTeam = e.attackerTeam;
        buyTypes = e.buyTypes;
        alive = new Set(team.keys());
        roundKills = new Map();
        clutch = null;
        break;
      case 'timeout':
        timeouts.push({ team: e.team, round: e.roundIndex, reason: e.reason });
        break;
      case 'call':
        if (e.text.startsWith('Coach:')) coachCalls.push({ team: e.team, round: e.roundIndex, text: e.text.slice(7) });
        break;
      case 'plant':
        ts[team.get(e.playerId)!]!.plants++;
        break;
      case 'defuse':
        ts[team.get(e.playerId)!]!.defuses++;
        break;
      case 'kill': {
        alive.delete(e.victimId);
        if (team.get(e.attackerId) !== team.get(e.victimId)) roundKills.set(e.attackerId, (roundKills.get(e.attackerId) ?? 0) + 1);
        if (!clutch)
          for (const t of [0, 1]) {
            const mine = [...alive].filter((id) => team.get(id) === t);
            const theirs = [...alive].filter((id) => team.get(id) !== t);
            if (mine.length === 1 && theirs.length >= 2) {
              clutch = { id: mine[0]!, vs: theirs.length };
              break;
            }
          }
        break;
      }
      case 'round_end': {
        const r = e.roundIndex;
        const w = e.winnerTeam;
        const before = scores;
        scores = e.scores;
        let highlight: string | null = null;
        const s = ts[w]!;
        if (w === attackerTeam) s.tRoundsWon++;
        else s.ctRoundsWon++;
        if (r - lastSwitch === 0 && r < 24) {
          s.pistolWins++;
          stories.push({ kind: 'pistol', title: `${teamNames[w]} win the ${r === 0 ? 'first' : 'second'} pistol`, text: `Round ${r + 1} went to ${teamNames[w]} (${e.reason.replace(/_/g, ' ')}).`, round: r, weight: 2 });
        }
        if ((buyTypes[w] === 'eco' || buyTypes[w] === 'force') && buyTypes[1 - w] === 'full') {
          s.ecoUpsets++;
          highlight = `${buyTypes[w]} upset`;
          stories.push({ kind: 'upset', title: `${teamNames[w]} steal a round on a ${buyTypes[w]}`, text: `In round ${r + 1}, ${teamNames[w]} beat a full buy with a ${buyTypes[w]}, swinging the economy.`, round: r, weight: 3 });
        }
        if (clutch && team.get(clutch.id) === w) {
          highlight = `1v${clutch.vs} clutch`;
          stories.push({ kind: 'clutch', title: `${playerName(clutch.id)} wins a 1v${clutch.vs}`, text: `Round ${r + 1}: alone against ${clutch.vs}, ${playerName(clutch.id)} won it for ${teamNames[w]}.`, round: r, weight: 3 + clutch.vs });
        }
        for (const [id, k] of roundKills) {
          if (k >= 4) {
            highlight = k === 5 ? 'ACE' : '4K';
            stories.push({ kind: 'multikill', title: `${playerName(id)} ${k === 5 ? 'aces' : 'takes four'} in round ${r + 1}`, text: `${playerName(id)} killed ${k} opponents in a single round${team.get(id) === w ? ' and won it' : ', but the round was lost'}.`, round: r, weight: k === 5 ? 6 : 4 });
          }
        }
        streak = streak.team === w ? { team: w, n: streak.n + 1 } : { team: w, n: 1 };
        s.longestStreak = Math.max(s.longestStreak, streak.n);
        const deficit = scores[1 - w]! - scores[w]!;
        void before;
        for (const t of [0, 1]) biggestDeficit[t] = Math.max(biggestDeficit[t]!, scores[1 - t]! - scores[t]!);
        void deficit;
        rounds.push({ index: r, winnerTeam: w, attackerTeam, reason: e.reason, buyTypes, scoresAfter: scores, highlight });
        break;
      }
    }
  }

  const end = events.find((e): e is Extract<MatchEvent, { type: 'map_end' }> => e.type === 'map_end');
  const winnerTeam = end ? end.winnerTeam : null;
  const finalScores = end ? end.scores : scores;

  // Players and MVP.
  const players: RecapPlayer[] = [...amr.values()].map((p) => ({
    id: p.playerId, team: p.team, kills: p.total.kills, deaths: p.total.deaths, assists: p.total.assists, amr: amrFromTotals(p.total),
    tSide: p.bySide.attacker.rounds ? amrFromTotals(p.bySide.attacker) : null, ctSide: p.bySide.defender.rounds ? amrFromTotals(p.bySide.defender) : null,
    openingKills: p.total.openingKills, openingDeaths: p.total.openingDeaths, clutchesWon: p.total.clutchesWon, multiKills: [...p.total.multiKills] as [number, number, number, number],
  })).sort((a, b) => b.amr.amr - a.amr.amr);
  // MVP: best AMR, with a small edge for the winning side.
  const mvp = [...players].sort((a, b) => b.amr.amr + (b.team === winnerTeam ? 0.1 : 0) - (a.amr.amr + (a.team === winnerTeam ? 0.1 : 0)))[0];

  if (winnerTeam !== null) {
    const l = 1 - winnerTeam;
    stories.push({ kind: 'result', title: `${teamNames[winnerTeam]} win ${finalScores[winnerTeam]}–${finalScores[l]}`, text: resultLine(teamNames, winnerTeam, finalScores, halftime), round: null, weight: 10 });
    if (biggestDeficit[winnerTeam]! >= 4) stories.push({ kind: 'comeback', title: `Comeback from ${biggestDeficit[winnerTeam]} rounds down`, text: `${teamNames[winnerTeam]} trailed by as many as ${biggestDeficit[winnerTeam]} rounds and still closed it out.`, round: null, weight: 8 });
  } else stories.push({ kind: 'result', title: `Draw ${finalScores[0]}–${finalScores[1]}`, text: 'Neither side could separate.', round: null, weight: 10 });
  if (rounds.length > 24) stories.push({ kind: 'overtime', title: `Overtime: ${rounds.length - 24} extra rounds`, text: `Regulation ended 12–12 and the map needed ${Math.ceil((rounds.length - 24) / 6)} overtime set${rounds.length - 24 > 6 ? 's' : ''}.`, round: 24, weight: 7 });
  for (const t of [0, 1]) {
    if (ts[t]!.longestStreak >= 5) stories.push({ kind: 'streak', title: `${teamNames[t]} rattle off ${ts[t]!.longestStreak} straight`, text: `A run of ${ts[t]!.longestStreak} consecutive rounds for ${teamNames[t]}.`, round: null, weight: 4 + Math.min(4, ts[t]!.longestStreak - 5) });
  }
  if (mvp) stories.push({ kind: 'mvp', title: `MVP: ${playerName(mvp.id)} (${mvp.amr.amr.toFixed(2)} AMR)`, text: `${mvp.kills}–${mvp.deaths}, ${mvp.amr.adr.toFixed(0)} ADR, ${mvp.amr.kastPct.toFixed(0)}% KAST${mvp.openingKills ? `, ${mvp.openingKills} opening kills` : ''}${mvp.clutchesWon ? `, ${mvp.clutchesWon} clutch${mvp.clutchesWon > 1 ? 'es' : ''}` : ''}.`, round: null, weight: 9 });
  for (const to of timeouts) {
    const after = rounds.filter((r) => r.index >= to.round && r.index < to.round + 5);
    const won = after.filter((r) => r.winnerTeam === to.team).length;
    stories.push({ kind: 'timeout', title: `${teamNames[to.team]} timeout in round ${to.round + 1}`, text: `"${to.reason}". They won ${won} of the next ${after.length} rounds.`, round: to.round, weight: won >= 3 ? 4 : 2 });
  }
  for (const c of coachCalls) {
    const after = rounds.filter((r) => r.index >= c.round && r.index < c.round + 5);
    const won = after.filter((r) => r.winnerTeam === c.team).length;
    stories.push({ kind: 'coach', title: `Your call in round ${c.round + 1}: ${c.text}`, text: `${teamNames[c.team]} won ${won} of the next ${after.length} rounds after the call.`, round: c.round, weight: 5 });
  }
  return {
    scores: finalScores, winnerTeam, halftime, players, mvpId: mvp?.id ?? null, rounds,
    storylines: stories.sort((a, b) => b.weight - a.weight || (a.round ?? -1) - (b.round ?? -1)),
    teamStats: ts,
  };
}

function resultLine(names: readonly [string, string], w: number, s: readonly [number, number], half: readonly [number, number] | null): string {
  const l = 1 - w;
  if (!half) return `${names[w]} took the map ${s[w]}–${s[l]}.`;
  const led = half[w]! > half[l]! ? 'led' : half[w]! < half[l]! ? 'trailed' : 'were level';
  return `${names[w]} ${led} ${half[w]}–${half[l]} at the half and finished ${s[w]}–${s[l]}.`;
}
