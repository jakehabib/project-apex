import { buildGrid, type MapGrid } from './grid';
import { dist, type MapDefinition, type NavNode, type NavNodeTag } from './types';

export interface NavGraph {
  readonly map: MapDefinition;
  readonly grid: MapGrid;
  readonly nodes: ReadonlyMap<string, NavNode>;
  readonly adjacency: ReadonlyMap<string, readonly { to: string; cost: number }[]>;
  /** All-pairs shortest paths (Floyd–Warshall): index, distance and next-hop matrices. */
  readonly index: ReadonlyMap<string, number>;
  readonly ids: readonly string[];
  readonly distance: Float64Array;
  readonly next: Int32Array;
  /** Side-safe routing: next hops that avoid the other side's half of the map. */
  readonly safeNext: { readonly attacker: Int32Array; readonly defender: Int32Array };
}

function floyd(n: number, ids: readonly string[], index: Map<string, number>, adjacency: Map<string, { to: string; cost: number }[]>, nodeCost: (j: number) => number) {
  const distance = new Float64Array(n * n).fill(Infinity);
  const next = new Int32Array(n * n).fill(-1);
  for (let i = 0; i < n; i++) {
    distance[i * n + i] = 0;
    next[i * n + i] = i;
    for (const { to, cost } of adjacency.get(ids[i]!)!) {
      const j = index.get(to)!;
      distance[i * n + j] = cost + nodeCost(j);
      next[i * n + j] = j;
    }
  }
  for (let k = 0; k < n; k++)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const via = distance[i * n + k]! + distance[k * n + j]!;
        // Strict improvement only, so ties keep the earlier (deterministic) choice.
        if (via < distance[i * n + j]! - 1e-9) {
          distance[i * n + j] = via;
          next[i * n + j] = next[i * n + k]!;
        }
      }
  return { distance, next };
}

const navCache = new Map<string, NavGraph>();

export function buildNav(map: MapDefinition): NavGraph {
  const key = `${map.id}@${map.version}`;
  const cached = navCache.get(key);
  if (cached) return cached;
  const nodes = new Map<string, NavNode>();
  for (const n of map.nodes) {
    if (nodes.has(n.id)) throw new Error(`Duplicate nav node ${n.id} on ${map.id}`);
    nodes.set(n.id, n);
  }
  const adjacency = new Map<string, { to: string; cost: number }[]>();
  for (const n of map.nodes) adjacency.set(n.id, []);
  for (const e of map.edges) {
    const a = nodes.get(e.a);
    const b = nodes.get(e.b);
    if (!a || !b) throw new Error(`Edge ${e.a}-${e.b} references unknown node on ${map.id}`);
    const cost = dist(a.pos, b.pos);
    adjacency.get(e.a)!.push({ to: e.b, cost });
    adjacency.get(e.b)!.push({ to: e.a, cost });
  }
  // Deterministic neighbour order regardless of authoring order.
  for (const list of adjacency.values()) list.sort((x, y) => (x.to < y.to ? -1 : x.to > y.to ? 1 : 0));
  const ids = map.nodes.map((n) => n.id);
  const index = new Map(ids.map((id, i) => [id, i]));
  const n = ids.length;
  const { distance, next } = floyd(n, ids, index, adjacency, () => 0);
  // Territory: which spawn is a node closer to (by path)? Safe routes penalise enemy territory.
  const spawnIdx = (tag: NavNodeTag) => map.nodes.filter((x) => x.tags.includes(tag)).map((x) => index.get(x.id)!);
  const tS = spawnIdx('attacker_spawn');
  const cS = spawnIdx('defender_spawn');
  const near = (set: number[], j: number) => Math.min(...set.map((i) => distance[i * n + j]!));
  const lean = ids.map((_, j) => near(tS, j) - near(cS, j)); // > 0: defender territory
  const safeNext = {
    attacker: floyd(n, ids, index, adjacency, (j) => (lean[j]! > 0 && !map.nodes[j]!.site ? 250 + lean[j]! * 0.5 : 0)).next,
    defender: floyd(n, ids, index, adjacency, (j) => (lean[j]! < 0 && !map.nodes[j]!.site ? 250 - lean[j]! * 0.5 : 0)).next,
  };
  const graph: NavGraph = { map, grid: buildGrid(map), nodes, adjacency, index, ids, distance, next, safeNext };
  navCache.set(key, graph);
  return graph;
}

export function nodesWithTag(graph: NavGraph, tag: NavNodeTag): NavNode[] {
  return graph.map.nodes.filter((n) => n.tags.includes(tag));
}

export function node(graph: NavGraph, id: string): NavNode {
  const n = graph.nodes.get(id);
  if (!n) throw new Error(`Unknown nav node ${id}`);
  return n;
}

/**
 * A* shortest path. `extraCost` lets decision layers penalise dangerous nodes
 * (e.g. known enemy positions) without mutating the graph. Ties are broken by
 * node id so results are deterministic.
 */
export function findPath(
  graph: NavGraph,
  from: string,
  to: string,
  extraCost?: (nodeId: string) => number,
  safeFor?: 'attacker' | 'defender',
): string[] | null {
  if (from === to) return [from];
  if (!extraCost) {
    const n = graph.ids.length;
    const nextM = safeFor ? graph.safeNext[safeFor] : graph.next;
    let i = graph.index.get(from);
    const j = graph.index.get(to);
    if (i === undefined || j === undefined) throw new Error(`Unknown nav node ${i === undefined ? from : to}`);
    if (nextM[i * n + j] === -1) return null;
    const path = [from];
    while (i !== j) {
      i = nextM[i! * n + j]!;
      path.push(graph.ids[i]!);
    }
    return path;
  }
  const goal = node(graph, to).pos;
  const g = new Map<string, number>([[from, 0]]);
  const came = new Map<string, string>();
  const open: { id: string; f: number }[] = [{ id: from, f: dist(node(graph, from).pos, goal) }];
  const closed = new Set<string>();
  while (open.length > 0) {
    let best = 0;
    for (let i = 1; i < open.length; i++) {
      const o = open[i]!;
      const b = open[best]!;
      if (o.f < b.f || (o.f === b.f && o.id < b.id)) best = i;
    }
    const cur = open.splice(best, 1)[0]!;
    if (cur.id === to) {
      const path = [to];
      let c = to;
      while (came.has(c)) {
        c = came.get(c)!;
        path.push(c);
      }
      return path.reverse();
    }
    if (closed.has(cur.id)) continue;
    closed.add(cur.id);
    for (const { to: nb, cost } of graph.adjacency.get(cur.id) ?? []) {
      if (closed.has(nb)) continue;
      const tentative = g.get(cur.id)! + cost + (extraCost ? extraCost(nb) : 0);
      if (tentative < (g.get(nb) ?? Infinity)) {
        g.set(nb, tentative);
        came.set(nb, cur.id);
        open.push({ id: nb, f: tentative + dist(node(graph, nb).pos, goal) });
      }
    }
  }
  return null;
}

export function pathLength(graph: NavGraph, path: readonly string[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += dist(node(graph, path[i - 1]!).pos, node(graph, path[i]!).pos);
  return total;
}

/** Shortest path length between two nodes (precomputed). */
export function pathDistance(graph: NavGraph, from: string, to: string): number {
  return graph.distance[graph.index.get(from)! * graph.ids.length + graph.index.get(to)!]!;
}
