import type { MapDefinition, Polygon, SiteId, Vec2 } from './types';

/** Cell classes. Order matters: later polygon layers overwrite earlier ones. */
export const Cell = { Void: 0, Floor: 1, High: 2, Low: 3 } as const;
export type Cell = (typeof Cell)[keyof typeof Cell];

export interface MapGrid {
  readonly mapId: string;
  readonly cols: number;
  readonly rows: number;
  readonly cellSize: number;
  readonly cells: Uint8Array;
  /** 0 = no site, 1 = A, 2 = B */
  readonly siteCells: Uint8Array;
  /** index into map.areas + 1, 0 = none */
  readonly areaCells: Uint16Array;
}

function pointInPolygon(px: number, py: number, poly: Polygon): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Vec2;
    const b = poly[j] as Vec2;
    if (a.y > py !== b.y > py && px < ((b.x - a.x) * (py - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function bounds(poly: Polygon) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of poly) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

const gridCache = new Map<string, MapGrid>();

export function buildGrid(map: MapDefinition): MapGrid {
  const key = `${map.id}@${map.version}`;
  const cached = gridCache.get(key);
  if (cached) return cached;

  const cs = map.cellSize;
  const cols = Math.ceil(map.width / cs);
  const rows = Math.ceil(map.height / cs);
  const cells = new Uint8Array(cols * rows);
  const siteCells = new Uint8Array(cols * rows);
  const areaCells = new Uint16Array(cols * rows);

  const paint = (poly: Polygon, fn: (idx: number) => void) => {
    const b = bounds(poly);
    const c0 = Math.max(0, Math.floor(b.minX / cs));
    const c1 = Math.min(cols - 1, Math.ceil(b.maxX / cs));
    const r0 = Math.max(0, Math.floor(b.minY / cs));
    const r1 = Math.min(rows - 1, Math.ceil(b.maxY / cs));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (pointInPolygon((c + 0.5) * cs, (r + 0.5) * cs, poly)) fn(r * cols + c);
      }
    }
  };

  map.areas.forEach((area, i) => {
    const site: SiteId | undefined = area.site;
    paint(area.polygon, (idx) => {
      cells[idx] = Cell.Floor;
      areaCells[idx] = i + 1;
      if (site) siteCells[idx] = site === 'A' ? 1 : 2;
    });
  });
  for (const ob of map.obstacles) {
    const v = ob.kind === 'high' ? Cell.High : Cell.Low;
    paint(ob.polygon, (idx) => {
      if (cells[idx] !== Cell.Void) cells[idx] = v;
    });
  }

  const grid: MapGrid = { mapId: map.id, cols, rows, cellSize: cs, cells, siteCells, areaCells };
  gridCache.set(key, grid);
  return grid;
}

export function cellAt(grid: MapGrid, p: Vec2): Cell {
  const c = Math.floor(p.x / grid.cellSize);
  const r = Math.floor(p.y / grid.cellSize);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return Cell.Void;
  return grid.cells[r * grid.cols + c] as Cell;
}

export function isWalkable(grid: MapGrid, p: Vec2): boolean {
  return cellAt(grid, p) === Cell.Floor;
}

export function siteAt(grid: MapGrid, p: Vec2): SiteId | null {
  const c = Math.floor(p.x / grid.cellSize);
  const r = Math.floor(p.y / grid.cellSize);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return null;
  const s = grid.siteCells[r * grid.cols + c];
  return s === 1 ? 'A' : s === 2 ? 'B' : null;
}

/**
 * Exact grid traversal (Amanatides & Woo) from a to b. Calls `blocked` for every
 * cell the segment passes through; returns false as soon as one is blocked.
 */
function traverse(grid: MapGrid, a: Vec2, b: Vec2, blocked: (cell: Cell) => boolean): boolean {
  const cs = grid.cellSize;
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
  const maxSteps = grid.cols + grid.rows + 4;
  for (let i = 0; i < maxSteps; i++) {
    if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return false;
    if (blocked(grid.cells[r * grid.cols + c] as Cell)) return false;
    if (c === cEnd && r === rEnd) return true;
    // Segment end reached (guards against float drift skipping the end cell).
    if (Math.min(tMaxC, tMaxR) > 1) return true;
    if (tMaxC < tMaxR) {
      tMaxC += tDeltaC;
      c += stepC;
    } else {
      tMaxR += tDeltaR;
      r += stepR;
    }
  }
  return true;
}

const opaque = (cell: Cell) => cell === Cell.Void || cell === Cell.High;
const losCache = new WeakMap<MapGrid, Map<number, boolean>>();

/**
 * True when nothing opaque (void or high obstacle) lies between a and b.
 * Results are cached per pair of cells: within a cell pair the exact segment
 * differs slightly, so the cache key uses cell centres (half-cell precision,
 * symmetric, deterministic).
 */
export function hasLineOfSight(grid: MapGrid, a: Vec2, b: Vec2): boolean {
  const cs = grid.cellSize;
  const ca = Math.floor(a.y / cs) * grid.cols + Math.floor(a.x / cs);
  const cb = Math.floor(b.y / cs) * grid.cols + Math.floor(b.x / cs);
  if (ca < 0 || cb < 0) return false;
  const total = grid.cols * grid.rows;
  const key = ca < cb ? ca * total + cb : cb * total + ca;
  let cache = losCache.get(grid);
  if (!cache) {
    cache = new Map();
    losCache.set(grid, cache);
  }
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  const lo = ca < cb ? ca : cb;
  const hi = ca < cb ? cb : ca;
  const pa = { x: ((lo % grid.cols) + 0.5) * cs, y: (Math.floor(lo / grid.cols) + 0.5) * cs };
  const pb = { x: ((hi % grid.cols) + 0.5) * cs, y: (Math.floor(hi / grid.cols) + 0.5) * cs };
  const v = traverse(grid, pa, pb, opaque);
  if (cache.size > 400_000) cache.clear();
  cache.set(key, v);
  return v;
}

/** Exact (uncached) line-of-sight between two precise points. */
export function hasLineOfSightExact(grid: MapGrid, a: Vec2, b: Vec2): boolean {
  return traverse(grid, a, b, opaque);
}

/** True when a straight walk from a to b stays on floor cells. */
export function isWalkableSegment(grid: MapGrid, a: Vec2, b: Vec2): boolean {
  return traverse(grid, a, b, (cell) => cell !== Cell.Floor);
}

/** Callout name of the area containing p (used for feed text and tactical notes). */
export function areaIndexAt(grid: MapGrid, p: Vec2): number {
  const c = Math.floor(p.x / grid.cellSize);
  const r = Math.floor(p.y / grid.cellSize);
  if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) return -1;
  return (grid.areaCells[r * grid.cols + c] ?? 0) - 1;
}

export function calloutAt(map: MapDefinition, grid: MapGrid, p: Vec2): string {
  const i = areaIndexAt(grid, p);
  return i >= 0 ? (map.areas[i]?.callout ?? 'Unknown') : 'Unknown';
}

/**
 * Distance a sight ray travels from `from` at `angle` before hitting an opaque
 * cell (void or high cover), capped at maxDist. Used for vision cones; uses the
 * same occupancy grid as hasLineOfSight.
 */
export function castRay(grid: MapGrid, from: Vec2, angle: number, maxDist: number): number {
  const step = grid.cellSize / 2;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let d = step; d <= maxDist; d += step) {
    const cell = cellAt(grid, { x: from.x + dx * d, y: from.y + dy * d });
    if (cell === Cell.Void || cell === Cell.High) return Math.max(0, d - step);
  }
  return maxDist;
}
