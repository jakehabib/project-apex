/**
 * Map system v2: tile-authored maps.
 *
 * A map is an ASCII layout where each character is one square tile of
 * `cell` map units (default 20 = 2 m). Tiles define both simulation semantics
 * (walk/sight) and presentation material. Navigation is generated from the
 * walkable tiles (a lattice) plus named tactical spots, so maps can carry
 * real detail: irregular rooms, connectors, windows, water, dense cover.
 */
import type { MapArea, MapDefinition, MapStrategy, MapTheme, NavEdge, NavNode, NavNodeTag, SiteId, Vec2, ZoneKind } from './types';
import { hypot } from './types';

export type Material =
  | 'solid' | 'water' | 'concrete' | 'asphalt' | 'wood' | 'metal' | 'gravel' | 'grass' | 'tile'
  | 'site' | 'tspawn' | 'ctspawn' | 'stairs' | 'rails'
  | 'container' | 'crates' | 'lowcrate' | 'railing' | 'window' | 'pillar' | 'vehicle';

/** Walk/sight semantics: floor walk+see, low blocks walk only, high blocks both. */
export type TileClass = 'void' | 'floor' | 'low' | 'high';

export interface TileDef {
  readonly material: Material;
  readonly cls: TileClass;
  readonly site?: SiteId;
  readonly zone?: 'attacker_spawn' | 'defender_spawn';
}

/** Global legend. Every map uses the same characters. */
export const TILES: Readonly<Record<string, TileDef>> = {
  '#': { material: 'solid', cls: 'void' },
  '~': { material: 'water', cls: 'low' },
  '.': { material: 'concrete', cls: 'floor' },
  ',': { material: 'asphalt', cls: 'floor' },
  '=': { material: 'wood', cls: 'floor' },
  '-': { material: 'metal', cls: 'floor' },
  ':': { material: 'gravel', cls: 'floor' },
  '"': { material: 'grass', cls: 'floor' },
  '_': { material: 'tile', cls: 'floor' },
  s: { material: 'stairs', cls: 'floor' },
  r: { material: 'rails', cls: 'floor' },
  A: { material: 'site', cls: 'floor', site: 'A' },
  B: { material: 'site', cls: 'floor', site: 'B' },
  T: { material: 'tspawn', cls: 'floor', zone: 'attacker_spawn' },
  C: { material: 'ctspawn', cls: 'floor', zone: 'defender_spawn' },
  O: { material: 'container', cls: 'high' },
  o: { material: 'crates', cls: 'high' },
  p: { material: 'pillar', cls: 'high' },
  v: { material: 'vehicle', cls: 'high' },
  x: { material: 'lowcrate', cls: 'low' },
  h: { material: 'railing', cls: 'low' },
  w: { material: 'window', cls: 'low' },
};

export interface CalloutRegion {
  readonly name: string;
  /** Inclusive tile rectangle [col0, row0, col1, row1]. */
  readonly rect: readonly [number, number, number, number];
  readonly zone?: ZoneKind;
}

export interface SpotDef {
  /** Tile coordinates [col, row]; the spot sits at the tile centre. */
  readonly at: readonly [number, number];
  readonly tags?: readonly NavNodeTag[];
}

export interface TileMapSource {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly cell: number;
  readonly theme: MapTheme;
  readonly layout: readonly string[];
  readonly callouts: readonly CalloutRegion[];
  readonly spots: Readonly<Record<string, SpotDef>>;
  readonly strategy: MapStrategy;
}

export interface TileLayer {
  readonly cell: number;
  readonly cols: number;
  readonly rows: number;
  readonly chars: readonly string[];
}

const LATTICE = 2; // lattice node every 2 tiles

export function tileAt(src: { layout: readonly string[] }, col: number, row: number): TileDef {
  const ch = src.layout[row]?.[col] ?? '#';
  const t = TILES[ch];
  if (!t) throw new Error(`Unknown tile '${ch}' at ${col},${row}`);
  return t;
}

function centre(cell: number, col: number, row: number): Vec2 {
  return { x: (col + 0.5) * cell, y: (row + 0.5) * cell };
}

/**
 * Exact walkable-segment check over tiles (same Amanatides–Woo traversal as
 * grid.ts), so generated edges satisfy the simulation's movement legality.
 */
function walkableSegment(src: TileMapSource, a: Vec2, b: Vec2): boolean {
  const cs = src.cell;
  let c = Math.floor(a.x / cs);
  let r = Math.floor(a.y / cs);
  const cEnd = Math.floor(b.x / cs);
  const rEnd = Math.floor(b.y / cs);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const stepC = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepR = dy > 0 ? 1 : dy < 0 ? -1 : 0;
  const tDeltaC = stepC !== 0 ? Math.abs(cs / dx) : Infinity;
  const tDeltaR = stepR !== 0 ? Math.abs(cs / dy) : Infinity;
  let tMaxC = stepC > 0 ? ((c + 1) * cs - a.x) / dx : stepC < 0 ? (c * cs - a.x) / dx : Infinity;
  let tMaxR = stepR > 0 ? ((r + 1) * cs - a.y) / dy : stepR < 0 ? (r * cs - a.y) / dy : Infinity;
  for (let i = 0; i < 400; i++) {
    if (tileAt(src, c, r).cls !== 'floor') return false;
    if (c === cEnd && r === rEnd) return true;
    if (Math.min(tMaxC, tMaxR) > 1) return true;
    if (Math.abs(tMaxC - tMaxR) < 1e-9) {
      // Exactly through a corner: both side tiles must be walkable (matches grid.ts).
      if (tileAt(src, c + stepC, r).cls !== 'floor' || tileAt(src, c, r + stepR).cls !== 'floor') return false;
      tMaxC += tDeltaC;
      tMaxR += tDeltaR;
      c += stepC;
      r += stepR;
    } else if (tMaxC < tMaxR) {
      tMaxC += tDeltaC;
      c += stepC;
    } else {
      tMaxR += tDeltaR;
      r += stepR;
    }
  }
  return true;
}

export function compileTileMap(src: TileMapSource): MapDefinition {
  const rows = src.layout.length;
  const cols = src.layout[0]!.length;
  src.layout.forEach((line, i) => {
    if (line.length !== cols) throw new Error(`${src.id}: row ${i} has ${line.length} columns, expected ${cols}`);
  });
  for (const line of src.layout) for (const ch of line) if (!TILES[ch]) throw new Error(`${src.id}: unknown tile '${ch}'`);

  // Navigation lattice on walkable tiles.
  const nodes: NavNode[] = [];
  const latticeId = (c: number, r: number) => `n${c}_${r}`;
  const isFloor = (c: number, r: number) => c >= 0 && r >= 0 && c < cols && r < rows && tileAt(src, c, r).cls === 'floor';
  const calloutFor = (p: Vec2) => {
    const c = Math.floor(p.x / src.cell);
    const r = Math.floor(p.y / src.cell);
    return src.callouts.find((k) => c >= k.rect[0] && c <= k.rect[2] && r >= k.rect[1] && r <= k.rect[3])?.name ?? '';
  };
  for (let r = 0; r < rows; r += LATTICE) {
    for (let c = 0; c < cols; c += LATTICE) {
      // Prefer the tile itself; else a floor neighbour within the 2×2 block, so 2-wide corridors are covered.
      let pc = -1;
      let pr = -1;
      for (const [dc, dr] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
        if (isFloor(c + dc, r + dr)) {
          pc = c + dc;
          pr = r + dr;
          break;
        }
      }
      if (pc < 0) continue;
      const pos = centre(src.cell, pc, pr);
      const t = tileAt(src, pc, pr);
      nodes.push({ id: latticeId(c, r), pos, callout: calloutFor(pos), tags: [], ...(t.site ? { site: t.site } : {}) });
    }
  }
  const latticeNodes = [...nodes];
  // Named tactical spots become nodes too.
  for (const [id, s] of Object.entries(src.spots)) {
    const [c, r] = s.at;
    if (!isFloor(c, r)) throw new Error(`${src.id}: spot ${id} at ${c},${r} is not on floor`);
    const t = tileAt(src, c, r);
    const pos = centre(src.cell, c, r);
    nodes.push({ id, pos, callout: calloutFor(pos), tags: [...(s.tags ?? [])], ...(t.site ? { site: t.site } : {}) });
  }

  const edges: NavEdge[] = [];
  const seen = new Set<string>();
  const link = (a: NavNode, b: NavNode) => {
    const k = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
    if (seen.has(k) || a.id === b.id) return;
    if (!walkableSegment(src, a.pos, b.pos)) return;
    seen.add(k);
    edges.push({ a: a.id, b: b.id });
  };
  const byLattice = new Map(latticeNodes.map((n) => [n.id, n]));
  for (const n of latticeNodes) {
    const [c, r] = n.id.slice(1).split('_').map(Number) as [number, number];
    for (const [dc, dr] of [[LATTICE, 0], [0, LATTICE], [LATTICE, LATTICE], [LATTICE, -LATTICE]] as const) {
      const m = byLattice.get(latticeId(c + dc, r + dr));
      if (m) link(n, m);
    }
  }
  // Spots connect to every lattice node within 3 tiles that they can walk to directly.
  const spotNodes = nodes.slice(latticeNodes.length);
  for (const s of spotNodes) {
    for (const n of latticeNodes) if (hypot(n.pos.x - s.pos.x, n.pos.y - s.pos.y) <= src.cell * 3.2) link(s, n);
    for (const t of spotNodes) if (t !== s && hypot(t.pos.x - s.pos.x, t.pos.y - s.pos.y) <= src.cell * 3.2) link(s, t);
  }

  // Areas (callout regions) for labels, zones and lookup; sites/spawns come from tiles.
  const areas: MapArea[] = src.callouts.map((k, i) => {
    const [c0, r0, c1, r1] = k.rect;
    const x0 = c0 * src.cell;
    const y0 = r0 * src.cell;
    const x1 = (c1 + 1) * src.cell;
    const y1 = (r1 + 1) * src.cell;
    let site: SiteId | undefined;
    for (let r = r0; r <= r1 && !site; r++) for (let c = c0; c <= c1 && !site; c++) site = tileAt(src, c, r).site;
    return {
      id: `area${i}`,
      callout: k.name,
      zone: k.zone ?? (site ? 'site' : 'route'),
      polygon: [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }],
      ...(site ? { site } : {}),
    };
  });

  const siteLabel = (s: SiteId): Vec2 => {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (tileAt(src, c, r).site === s) {
      sx += c;
      sy += r;
      n++;
    }
    if (!n) throw new Error(`${src.id}: no site ${s} tiles`);
    return centre(src.cell, Math.round(sx / n), Math.round(sy / n));
  };

  return {
    id: src.id,
    name: src.name,
    version: src.version,
    width: cols * src.cell,
    height: rows * src.cell,
    cellSize: src.cell,
    theme: src.theme,
    areas,
    obstacles: [],
    nodes,
    edges,
    sites: { A: { label: siteLabel('A') }, B: { label: siteLabel('B') } },
    strategy: src.strategy,
    tiles: { cell: src.cell, cols, rows, chars: src.layout },
  };
}
