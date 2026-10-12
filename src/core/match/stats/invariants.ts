/**
 * Event-log invariant checker. Replays a map's events against the rules and
 * reports every violation. Used by the test suite and batch harness on every
 * simulated map; development builds can run it after every match.
 */
import type { MatchEvent, Side } from '../events';
import { buildGrid, hasLineOfSight, isWalkable, isWalkableSegment, siteAt } from '../maps/grid';
import type { MapDefinition, Vec2 } from '../maps/types';
import { ARSENAL, UTILITY } from '../rules/arsenal';
import { isSideSwitchBefore, mapOutcome, type Ruleset } from '../rules/ruleset';
import { RUN_SPEED } from '../engine/types';
import { hypot } from '../maps/types';

const UTIL_WEAPON = new Set(['frag', 'cinder', 'ember']);
const kindOf = (id: string) => UTILITY.find((u) => u.id === id)?.kind;

export function checkInvariants(events: readonly MatchEvent[], map: MapDefinition, rules: Ruleset): string[] {
  const v: string[] = [];
  const grid = buildGrid(map);
  const fail = (e: MatchEvent | null, msg: string) => v.push(`${e ? `#${e.seq} r${e.roundIndex} t${e.tMs} ${e.type}: ` : ''}${msg}`);

  const team = new Map<string, number>();
  const side = new Map<string, Side>();
  const money = new Map<string, number>();
  const hp = new Map<string, number>();
  const utility = new Map<string, string[]>();
  let scores: [number, number] = [0, 0];
  let lastSeq = -1;
  let lastRound = -1;
  let lastT = -Infinity;
  let attackerTeam: number | null = null;
  let prevAttacker: number | null = null;
  let plant: { t: number; site: string } | null = null;
  let defuseStart: { id: string; t: number; kit: boolean } | null = null;
  let defused = false;
  let roundStarts = 0;
  let roundEnds = 0;
  let mapEnded = false;
  let smokes: { pos: Vec2; from: number; until: number; r: number }[] = [];

  for (const e of events) {
    if (e.seq !== lastSeq + 1) fail(e, `seq gap (expected ${lastSeq + 1})`);
    lastSeq = e.seq;
    if (mapEnded) fail(e, 'event after map_end');
    if (e.roundIndex < lastRound) fail(e, 'round index went backwards');
    if (e.roundIndex !== lastRound) {
      lastRound = e.roundIndex;
      lastT = -Infinity;
    }
    if (e.tMs < lastT && e.type !== 'map_end') fail(e, `time went backwards (${lastT})`);
    if (e.type !== 'map_end') lastT = e.tMs;

    switch (e.type) {
      case 'map_start':
        break;
      case 'side_switch':
        for (const id of money.keys()) money.set(id, e.money);
        break;
      case 'loadout':
        for (const l of e.loadouts) {
          if (money.has(l.playerId) && money.get(l.playerId) !== l.money) fail(e, `${l.playerId} money ${l.money} != tracked ${money.get(l.playerId)}`);
          money.set(l.playerId, l.money);
          utility.set(l.playerId, [...l.utility]);
          if (l.money < 0 || l.money > rules.economy.maxMoney) fail(e, `${l.playerId} money out of bounds ${l.money}`);
          if (l.utility.length > 4) fail(e, `${l.playerId} carries ${l.utility.length} grenades`);
        }
        break;
      case 'buy': {
        const before = money.get(e.playerId);
        if (before === undefined) {
          if (rules.economy.startMoney - e.spent !== e.moneyAfter) fail(e, 'first buy does not start from start money');
          money.set(e.playerId, e.moneyAfter);
        } else {
          if (before - e.spent !== e.moneyAfter) fail(e, `buy arithmetic ${before} - ${e.spent} != ${e.moneyAfter}`);
          if (e.spent > before) fail(e, 'spent more than owned');
          money.set(e.playerId, e.moneyAfter);
        }
        const prices = e.items.map((i) => ARSENAL.find((w) => w.id === i)?.price ?? UTILITY.find((u) => u.id === i)?.price ?? ({ vest: 650, vest_helmet: 1000, helmet: 350, kit: 400 } as Record<string, number>)[i] ?? NaN);
        if (prices.some((p) => Number.isNaN(p))) fail(e, `unknown item in ${e.items.join(',')}`);
        if (prices.reduce((a, b) => a + b, 0) !== e.spent) fail(e, 'spent does not equal item prices');
        if (e.moneyAfter < 0) fail(e, 'negative money');
        break;
      }
      case 'money': {
        const before = money.get(e.playerId) ?? rules.economy.startMoney;
        if (e.reason === 'reset') {
          if (before + e.delta !== e.moneyAfter) fail(e, 'reset arithmetic');
          money.set(e.playerId, e.moneyAfter);
          break;
        }
        if (Math.max(0, Math.min(rules.economy.maxMoney, before + e.delta)) !== e.moneyAfter) fail(e, `money arithmetic ${before} + ${e.delta} != ${e.moneyAfter}`);
        money.set(e.playerId, e.moneyAfter);
        if (e.moneyAfter > rules.economy.maxMoney) fail(e, 'above max money');
        break;
      }
      case 'spawn':
        team.set(e.playerId, e.team);
        side.set(e.playerId, e.side);
        hp.set(e.playerId, 100);
        if (!isWalkable(grid, e.pos)) fail(e, 'spawn not walkable');
        break;
      case 'round_start': {
        roundStarts++;
        attackerTeam = e.attackerTeam;
        if (prevAttacker !== null) {
          const switched = attackerTeam !== prevAttacker;
          const should = isSideSwitchBefore(rules.format, e.roundIndex);
          if (switched !== should) fail(e, `side switch ${switched ? 'happened' : 'missing'} at round ${e.roundIndex}`);
        }
        prevAttacker = attackerTeam;
        if (e.scores[0] !== scores[0] || e.scores[1] !== scores[1]) fail(e, 'round_start scores mismatch');
        for (const [id, s] of side) if ((team.get(id) === attackerTeam) !== (s === 'attacker')) fail(e, `${id} on wrong side`);
        plant = null;
        defuseStart = null;
        defused = false;
        smokes = [];
        break;
      }
      case 'move': {
        if ((hp.get(e.playerId) ?? 0) <= 0) fail(e, `${e.playerId} moved while dead`);
        if (!isWalkableSegment(grid, e.from, e.to)) fail(e, `${e.playerId} illegal segment ${JSON.stringify(e.from)} -> ${JSON.stringify(e.to)}`);
        const speed = (hypot(e.to.x - e.from.x, e.to.y - e.from.y) / e.durationMs) * 1000;
        if (speed > RUN_SPEED * 1.02) fail(e, `${e.playerId} too fast: ${speed.toFixed(1)} u/s`);
        break;
      }
      case 'spotted':
        if ((hp.get(e.observerId) ?? 0) <= 0) fail(e, 'dead observer');
        if (!hasLineOfSight(grid, e.observerPos, e.targetPos)) fail(e, `${e.observerId} saw ${e.targetId} through a wall`);
        break;
      case 'utility': {
        if ((hp.get(e.playerId) ?? 0) <= 0) fail(e, 'dead player threw utility');
        const inv = utility.get(e.playerId) ?? [];
        const idx = inv.findIndex((id) => kindOf(id) === e.utility);
        if (idx < 0) fail(e, `${e.playerId} threw ${e.utility} they did not own`);
        else inv.splice(idx, 1);
        if (e.utility === 'smoke') // Engine activates smokes on the first tick at/after detonation (≤ 1 tick later).
        smokes.push({ pos: e.target, from: e.detonateMs + 50, until: e.detonateMs + e.durationMs, r: 72 });
        break;
      }
      case 'damage': {
        const before = hp.get(e.victimId) ?? 0;
        if (before <= 0) fail(e, `damage to dead ${e.victimId}`);
        if (e.amount <= 0 || e.amount > before) fail(e, `bad amount ${e.amount} (hp ${before})`);
        if (before - e.amount !== e.hpAfter) fail(e, `hp arithmetic ${before} - ${e.amount} != ${e.hpAfter}`);
        hp.set(e.victimId, e.hpAfter);
        if (!UTIL_WEAPON.has(e.weaponId)) {
          if ((hp.get(e.attackerId) ?? 0) <= 0) fail(e, `dead ${e.attackerId} fired`);
          if (!hasLineOfSight(grid, e.attackerPos, e.victimPos)) fail(e, `shot through a wall ${e.attackerId}->${e.victimId}`);
          for (const s of smokes) {
            if (e.tMs < s.from || e.tMs >= s.until) continue;
            const a = e.attackerPos;
            const b = e.victimPos;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const l2 = dx * dx + dy * dy;
            const k = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((s.pos.x - a.x) * dx + (s.pos.y - a.y) * dy) / l2));
            if (hypot(a.x + dx * k - s.pos.x, a.y + dy * k - s.pos.y) <= s.r - 0.001) fail(e, 'shot through an active smoke');
          }
        }
        break;
      }
      case 'kill': {
        if ((hp.get(e.victimId) ?? 1) !== 0) fail(e, `kill without lethal damage on ${e.victimId}`);
        hp.set(e.victimId, -1); // dead marker
        if (team.get(e.attackerId) === team.get(e.victimId)) fail(e, 'team kill');
        if (!UTIL_WEAPON.has(e.weaponId) && (hp.get(e.attackerId) ?? 0) <= 0) fail(e, 'killer was dead');
        break;
      }
      case 'plant': {
        if (side.get(e.playerId) !== 'attacker') fail(e, 'defender planted');
        if ((hp.get(e.playerId) ?? 0) <= 0) fail(e, 'dead planter');
        if (plant) fail(e, 'second plant');
        if (siteAt(grid, e.pos) !== e.site) fail(e, `plant outside site ${e.site}`);
        plant = { t: e.tMs, site: e.site };
        break;
      }
      case 'defuse_start':
        if (!plant) fail(e, 'defuse with no bomb');
        if (side.get(e.playerId) !== 'defender') fail(e, 'attacker defusing');
        defuseStart = { id: e.playerId, t: e.tMs, kit: e.withKit };
        break;
      case 'defuse_abort':
        defuseStart = null;
        break;
      case 'defuse': {
        if (!plant) fail(e, 'defuse with no bomb');
        if (!defuseStart || defuseStart.id !== e.playerId) fail(e, 'defuse without start');
        else {
          const need = defuseStart.kit ? rules.timing.defuseKitTimeMs : rules.timing.defuseTimeMs;
          if (e.tMs - defuseStart.t < need) fail(e, 'defuse too fast');
        }
        if (plant && e.tMs >= plant.t + rules.timing.bombTimerMs) fail(e, 'defused after detonation');
        if ((hp.get(e.playerId) ?? 0) <= 0) fail(e, 'dead defuser');
        defused = true;
        break;
      }
      case 'detonate':
        if (!plant || defused) fail(e, 'illegal detonation');
        else if (e.tMs !== plant.t + rules.timing.bombTimerMs && Math.abs(e.tMs - (plant.t + rules.timing.bombTimerMs)) >= 50) fail(e, 'detonation off-timer');
        break;
      case 'round_end': {
        roundEnds++;
        if (attackerTeam === null) break;
        const def = 1 - attackerTeam;
        const aliveOf = (t: number) => [...hp].filter(([id, h]) => team.get(id) === t && h > 0).length;
        const expectWinner =
          e.reason === 'attackers_eliminated' || e.reason === 'bomb_defused' || e.reason === 'time_expired' ? def : attackerTeam;
        if (e.winnerTeam !== expectWinner) fail(e, `winner ${e.winnerTeam} inconsistent with ${e.reason}`);
        if (e.reason === 'attackers_eliminated' && (aliveOf(attackerTeam) > 0 || plant)) fail(e, 'attackers not all dead / bomb planted');
        if (e.reason === 'defenders_eliminated' && aliveOf(def) > 0) fail(e, 'defenders not all dead');
        if (e.reason === 'bomb_defused' && !defused) fail(e, 'no defuse');
        if (e.reason === 'time_expired' && (plant || e.tMs < rules.timing.roundTimeMs)) fail(e, 'bad time expiry');
        if (e.reason === 'bomb_detonated' && !plant) fail(e, 'detonation without plant');
        const expected: [number, number] = [scores[0], scores[1]];
        expected[e.winnerTeam]!++;
        if (e.scores[0] !== expected[0] || e.scores[1] !== expected[1]) fail(e, `score ${e.scores.join('-')} expected ${expected.join('-')}`);
        scores = [e.scores[0], e.scores[1]];
        const outcome = mapOutcome(rules.format, scores, e.roundIndex + 1);
        const nextIsMore = events.some((x) => x.type === 'round_start' && x.roundIndex > e.roundIndex);
        if (outcome !== null && nextIsMore) fail(e, 'rounds played after the map was decided');
        if (outcome === null && !nextIsMore) fail(e, 'map stopped before it was decided');
        for (const id of hp.keys()) if ((hp.get(id) ?? 0) < 0) hp.set(id, 0);
        break;
      }
      case 'map_end':
        mapEnded = true;
        if (e.scores[0] !== scores[0] || e.scores[1] !== scores[1]) fail(e, 'final score mismatch');
        break;
    }
  }
  if (roundStarts !== roundEnds) fail(null, `round starts ${roundStarts} != ends ${roundEnds}`);
  if (!mapEnded) fail(null, 'no map_end');
  return v;
}
