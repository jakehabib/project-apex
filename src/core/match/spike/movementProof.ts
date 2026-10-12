/**
 * PHASE 0 SPIKE — deterministic movement & spotting proof.
 *
 * This is NOT the match engine. It proves the pipeline the real engine will use:
 * seeded RNG -> agent decisions on the nav graph -> timed, legal movement ->
 * line-of-sight checks on the authoritative grid -> append-only event log ->
 * the viewer animating purely from that log. No combat, economy or objective.
 */
import { Rng } from '../../rng/prng';
import { fingerprint } from '../../util/hash';
import type { MatchEvent, MatchEventInput, Side } from '../events';
import { hasLineOfSight } from '../maps/grid';
import { buildNav, findPath, node, nodesWithTag, type NavGraph } from '../maps/nav';
import { dist, type MapDefinition, type Vec2 } from '../maps/types';

export const PROOF_ENGINE_VERSION = 'apex-proof/1';

/** Knife-out run speed in map units per second (0.1 m units => 5.0 m/s). */
const RUN_SPEED = 50;
const SPOT_RANGE = 1400;

export interface ProofConfig {
  readonly seed: string;
  readonly map: MapDefinition;
  readonly durationMs?: number;
  readonly tickMs?: number;
}

export interface ProofAgent {
  readonly id: string;
  readonly name: string;
  readonly team: string;
  readonly side: Side;
}

export interface ProofResult {
  readonly engineVersion: string;
  readonly seed: string;
  readonly mapId: string;
  readonly agents: readonly ProofAgent[];
  readonly targetSite: 'A' | 'B';
  readonly events: readonly MatchEvent[];
  readonly durationMs: number;
  readonly fingerprint: string;
}

interface AgentState {
  readonly agent: ProofAgent;
  at: string;
  path: string[];
  moving: { to: string; arriveAt: number } | null;
  startAt: number;
  holdFacing: Vec2 | null;
}

const ATTACKER_NAMES = ['Vex', 'Rook', 'Juno', 'Sable', 'Kite'];
const DEFENDER_NAMES = ['Ward', 'Lumen', 'Pax', 'Onyx', 'Tarn'];

export function runMovementProof(config: ProofConfig): ProofResult {
  const durationMs = config.durationMs ?? 45000;
  const tickMs = config.tickMs ?? 50;
  const graph = buildNav(config.map);
  const rng = Rng.fromSeed(config.seed);
  const planRng = rng.fork('plan');
  const routeRng = rng.fork('routes');

  const events: MatchEvent[] = [];
  let seq = 0;
  const emit = (e: MatchEventInput) => {
    events.push({ ...e, seq: seq++, roundIndex: 0 });
  };

  emit({ type: 'map_start', tMs: 0, mapId: config.map.id, seed: config.seed, engineVersion: PROOF_ENGINE_VERSION, teams: ['ATK', 'DEF'] });

  const targetSite = planRng.chance(0.5) ? 'A' : 'B';
  const attackerSpawns = planRng.shuffle(nodesWithTag(graph, 'attacker_spawn'));
  const defenderSpawns = planRng.shuffle(nodesWithTag(graph, 'defender_spawn'));
  // Distinct destinations on the target site: plant spots first, then site holds.
  const siteSpots = planRng.shuffle(graph.map.nodes.filter((n) => n.site === targetSite && n.tags.includes('plant')))
    .concat(planRng.shuffle(graph.map.nodes.filter((n) => n.site === targetSite && !n.tags.includes('plant'))));

  // Defender setup: two on A, two on B, one mid (a common default).
  const holdsA = planRng.shuffle(graph.map.nodes.filter((n) => n.site === 'A' && n.tags.includes('hold')));
  const holdsB = planRng.shuffle(graph.map.nodes.filter((n) => n.site === 'B' && n.tags.includes('hold')));
  const holdsMid = planRng.shuffle(graph.map.nodes.filter((n) => n.tags.includes('mid') && n.tags.includes('hold')));
  const defenderGoals = [holdsA[0], holdsA[1], holdsMid[0], holdsB[0], holdsB[1]].map((n) => n!.id);

  const agents: AgentState[] = [];
  for (let i = 0; i < 5; i++) {
    const spawn = attackerSpawns[i % attackerSpawns.length]!;
    const goal = siteSpots[i % siteSpots.length]!;
    // Per-agent route preference: seeded noise on node costs varies the chosen lanes.
    const noise = new Map<string, number>();
    for (const n of graph.map.nodes) noise.set(n.id, routeRng.range(0, 260));
    const path = findPath(graph, spawn.id, goal.id, (id) => noise.get(id) ?? 0) ?? [spawn.id];
    agents.push({
      agent: { id: `atk${i}`, name: ATTACKER_NAMES[i]!, team: 'ATK', side: 'attacker' },
      at: spawn.id,
      path: path.slice(1),
      moving: null,
      startAt: planRng.int(0, 3000),
      holdFacing: null,
    });
  }
  for (let i = 0; i < 5; i++) {
    const spawn = defenderSpawns[i % defenderSpawns.length]!;
    const path = findPath(graph, spawn.id, defenderGoals[i]!) ?? [spawn.id];
    agents.push({
      agent: { id: `def${i}`, name: DEFENDER_NAMES[i]!, team: 'DEF', side: 'defender' },
      at: spawn.id,
      path: path.slice(1),
      moving: null,
      startAt: planRng.int(0, 800),
      holdFacing: null,
    });
  }

  for (const a of agents) {
    emit({ type: 'spawn', tMs: 0, playerId: a.agent.id, team: a.agent.team, side: a.agent.side, nodeId: a.at, pos: node(graph, a.at).pos });
  }

  const spotted = new Set<string>();
  const positions = new Map<string, Vec2>();
  const moveStart = new Map<string, { from: Vec2; to: Vec2; t0: number; dur: number }>();

  for (let t = 0; t <= durationMs; t += tickMs) {
    for (const a of agents) {
      if (a.moving && t >= a.moving.arriveAt) {
        a.at = a.moving.to;
        a.moving = null;
        moveStart.delete(a.agent.id);
      }
      if (!a.moving && t >= a.startAt && a.path.length > 0) {
        const next = a.path.shift()!;
        const from = node(graph, a.at).pos;
        const to = node(graph, next).pos;
        const durationMsMove = Math.round((dist(from, to) / RUN_SPEED) * 1000);
        a.moving = { to: next, arriveAt: t + durationMsMove };
        moveStart.set(a.agent.id, { from, to, t0: t, dur: durationMsMove });
        emit({ type: 'move', tMs: t, playerId: a.agent.id, fromNode: a.at, toNode: next, from, to, durationMs: durationMsMove });
      } else if (!a.moving && a.path.length === 0 && !a.holdFacing && t >= a.startAt) {
        a.holdFacing = facingForHold(graph, a);
        emit({ type: 'hold', tMs: t, playerId: a.agent.id, nodeId: a.at, facing: a.holdFacing });
      }
      positions.set(a.agent.id, currentPos(graph, a, t, moveStart));
    }

    // Spotting uses the authoritative grid; each observer learns only what it can see.
    for (const obs of agents) {
      for (const tgt of agents) {
        if (obs.agent.side === tgt.agent.side) continue;
        const key = `${obs.agent.id}>${tgt.agent.id}`;
        if (spotted.has(key)) continue;
        const p = positions.get(obs.agent.id)!;
        const q = positions.get(tgt.agent.id)!;
        if (dist(p, q) <= SPOT_RANGE && hasLineOfSight(graph.grid, p, q)) {
          spotted.add(key);
          emit({ type: 'spotted', tMs: t, observerId: obs.agent.id, targetId: tgt.agent.id, observerPos: p, targetPos: q });
        }
      }
    }
  }

  emit({ type: 'proof_end', tMs: durationMs });

  const result = {
    engineVersion: PROOF_ENGINE_VERSION,
    seed: config.seed,
    mapId: config.map.id,
    agents: agents.map((a) => a.agent),
    targetSite,
    events,
    durationMs,
  } as const;
  return { ...result, fingerprint: fingerprint(result) };
}

function currentPos(graph: NavGraph, a: AgentState, t: number, moves: Map<string, { from: Vec2; to: Vec2; t0: number; dur: number }>): Vec2 {
  const m = moves.get(a.agent.id);
  if (!m) return node(graph, a.at).pos;
  const k = m.dur === 0 ? 1 : Math.min(1, Math.max(0, (t - m.t0) / m.dur));
  return { x: m.from.x + (m.to.x - m.from.x) * k, y: m.from.y + (m.to.y - m.from.y) * k };
}

/** Face the most likely enemy approach: the neighbour farthest from own spawn side. */
function facingForHold(graph: NavGraph, a: AgentState): Vec2 {
  const here = node(graph, a.at).pos;
  const spawnTag = a.agent.side === 'attacker' ? 'defender_spawn' : 'attacker_spawn';
  const enemySpawn = nodesWithTag(graph, spawnTag)[0]!.pos;
  const dx = enemySpawn.x - here.x;
  const dy = enemySpawn.y - here.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}
