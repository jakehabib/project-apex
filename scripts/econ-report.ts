// Economy and utility calibration report (research brief §14).
// Usage: npm run sim:econ -- [maps=80]
// Every number is measured from engine events. The "reference" column holds game-design
// hypotheses or public genre conventions, NOT measured professional rates (see docs/ECONOMY_RESEARCH.md).
import { syntheticTeam } from '../src/core/match/engine/fixtures';
import { simulateMap } from '../src/core/match/engine/match';
import { MAP_POOL } from '../src/core/match/maps';
import { MR12_STANDARD } from '../src/core/match/rules/ruleset';
import { checkInvariants } from '../src/core/match/stats/invariants';
import type { BuyType, MatchEvent, Side } from '../src/core/match/events';

const N = Number(process.argv[2] ?? 80);
const UTIL_DMG = new Set(['frag', 'cinder', 'ember']);
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : '-');
const per = (n: number, d: number) => (d ? (n / d).toFixed(2) : '-');

const buys: Record<Side, Record<string, number>> = { attacker: {}, defender: {} };
const matchup = new Map<string, { n: number; w: number }>();
const thrown: Record<Side, Record<string, number>> = { attacker: {}, defender: {} };
const sideRounds: Record<Side, number> = { attacker: 0, defender: 0 };
let rounds = 0, plants = 0, plantedCtWins = 0, pickups = 0, drops = 0, awpDrops = 0, violations = 0;
let utilDamage = 0, flashedEvents = 0, flashAssists = 0;
const awp = { gunRounds: 0, withAwp: 0 };
const afterStreak: Record<string, number> = {};
const byMap = new Map<string, { rounds: number; smokes: number; flashes: number; fires: number; frags: number }>();

for (let i = 0; i < N; i++) {
  const map = MAP_POOL[i % MAP_POOL.length]!;
  const r = simulateMap({ matchId: 'econ', mapIndex: 0, seed: `econ-${i}`, map, ruleset: MR12_STANDARD,
    teams: [syntheticTeam('a', 55 + (i % 3) * 5, `ea${i % 30}`), syntheticTeam('b', 60, `eb${i % 30}`)], firstAttacker: (i % 2) as 0 | 1 });
  violations += checkInvariants(r.events, map, MR12_STANDARD).length;
  const mapRow = byMap.get(map.id) ?? { rounds: 0, smokes: 0, flashes: 0, fires: 0, frags: 0 };
  byMap.set(map.id, mapRow);
  const team = new Map<string, number>();
  const side = new Map<string, Side>();
  const awperOf = new Map<number, string>();
  let bt: readonly [BuyType, BuyType] = ['eco', 'eco'];
  let attacker = 0;
  let planted = false;
  const streak = [1, 1];
  const flashedBy = new Map<string, { by: string; until: number }>();
  let loadouts: Extract<MatchEvent, { type: 'loadout' }> | null = null;
  for (const e of r.events) {
    switch (e.type) {
      case 'loadout': loadouts = e; break;
      case 'spawn': team.set(e.playerId, e.team); side.set(e.playerId, e.side); break;
      case 'round_start': {
        rounds++; mapRow.rounds++; attacker = e.attackerTeam; bt = e.buyTypes; planted = false; flashedBy.clear();
        if (awperOf.size === 0) for (const [id, t] of team) if (id.endsWith('-p1')) awperOf.set(t, id); // fixture: p1 is the AWPer
        for (const t of [0, 1]) {
          const s: Side = t === attacker ? 'attacker' : 'defender';
          sideRounds[s]++;
          buys[s][bt[t]!] = (buys[s][bt[t]!] ?? 0) + 1;
          if (streak[t]! >= 3) afterStreak[bt[t]!] = (afterStreak[bt[t]!] ?? 0) + 1;
          if (bt[t] === 'full') {
            awp.gunRounds++;
            const l = loadouts?.loadouts.find((x) => x.playerId === awperOf.get(t));
            if (l?.primary === 'lance') awp.withAwp++;
          }
        }
        break;
      }
      case 'drop': drops++; if (e.itemId === 'lance') awpDrops++; break;
      case 'pickup': pickups++; break;
      case 'plant': planted = true; plants++; break;
      case 'utility': {
        const s = side.get(e.playerId)!;
        thrown[s][e.utility] = (thrown[s][e.utility] ?? 0) + 1;
        if (e.utility === 'smoke') mapRow.smokes++; else if (e.utility === 'flash') mapRow.flashes++; else if (e.utility === 'fire') mapRow.fires++; else mapRow.frags++;
        break;
      }
      case 'flashed': flashedEvents++; flashedBy.set(e.playerId, { by: e.byPlayerId, until: e.tMs + e.durationMs }); break;
      case 'damage': if (UTIL_DMG.has(e.weaponId)) utilDamage += e.amount; break;
      case 'kill': {
        const f = flashedBy.get(e.victimId);
        if (f && e.tMs <= f.until && f.by !== e.attackerId && team.get(f.by) === team.get(e.attackerId)) flashAssists++;
        break;
      }
      case 'round_end': {
        if (planted && e.winnerTeam !== attacker) plantedCtWins++;
        const key = `${bt[0]} v ${bt[1]}`;
        const m = matchup.get(key) ?? { n: 0, w: 0 };
        m.n++; if (e.winnerTeam === 0) m.w++;
        matchup.set(key, m);
        const lose = 1 - e.winnerTeam;
        streak[lose] = Math.min(5, streak[lose]! + 1);
        streak[e.winnerTeam] = Math.max(0, streak[e.winnerTeam]! - 1);
        break;
      }
      case 'side_switch': streak[0] = streak[1] = 1; break;
    }
  }
}

const out: string[] = [];
out.push(`# Economy and utility report (${N} maps, ${rounds} rounds; invariant violations: ${violations})`, '');
out.push('## Buy types by side (measured)', '', '| Buy | T | CT |', '|---|---|---|');
for (const b of ['pistol', 'eco', 'half', 'force', 'bonus', 'full']) out.push(`| ${b} | ${pct(buys.attacker[b] ?? 0, sideRounds.attacker)} | ${pct(buys.defender[b] ?? 0, sideRounds.defender)} |`);
out.push('', '## Team A win rate by buy matchup (A buy v B buy; measured, rows with ≥ 15 rounds)', '', '| Matchup | Rounds | A wins |', '|---|---|---|');
for (const [k, m] of [...matchup].filter(([, m]) => m.n >= 15).sort((x, y) => y[1].n - x[1].n)) out.push(`| ${k} | ${m.n} | ${pct(m.w, m.n)} |`);
out.push('', '## Weapons and objectives (measured)', '');
out.push(`- AWP availability on full buys: ${pct(awp.withAwp, awp.gunRounds)} of team full-buy rounds have the AWPer on the sniper`);
out.push(`- Drops per round: ${per(drops, rounds)} (AWP drops ${awpDrops}); weapons recovered after rounds: ${per(pickups, rounds)} per round`);
out.push(`- Rounds with a plant: ${pct(plants, rounds)}; CT retake success after a plant: ${pct(plantedCtWins, plants)}`);
out.push(`- Buys after three or more straight losses: ${Object.entries(afterStreak).map(([k, v]) => `${k} ${v}`).join(', ')}`);
out.push('', '## Utility thrown per side-round (measured)', '', '| Kind | T | CT |', '|---|---|---|');
for (const k of ['smoke', 'flash', 'fire', 'frag']) out.push(`| ${k} | ${per(thrown.attacker[k] ?? 0, sideRounds.attacker)} | ${per(thrown.defender[k] ?? 0, sideRounds.defender)} |`);
out.push('', '| Map | Smokes/rd | Flashes/rd | Fires/rd | HE/rd |', '|---|---|---|---|---|');
for (const [id, m] of byMap) out.push(`| ${id} | ${per(m.smokes, m.rounds)} | ${per(m.flashes, m.rounds)} | ${per(m.fires, m.rounds)} | ${per(m.frags, m.rounds)} |`);
out.push('', `- Utility damage per round (both teams): ${per(utilDamage, rounds)}`);
out.push(`- Players flashed per round: ${per(flashedEvents, rounds)}; flash assists per round: ${per(flashAssists, rounds)}`);
console.log(out.join('\n'));
