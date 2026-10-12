/**
 * Renders a tile map's static art into a single high-resolution canvas:
 * textured floors, water with foam, rooftops, drop shadows and ambient
 * occlusion, props drawn as objects, painted site/spawn markings and lighting.
 * Rendered once per map and cached; the simulation never reads any of this.
 */
import { TILES, type Material } from '../../../core/match/maps/tilemap';
import type { MapDefinition } from '../../../core/match/maps/types';
import { Rng } from '../../../core/rng/prng';
import { materialTile, paletteFor, shade, waterTile, type Palette } from './textures';

const cache = new Map<string, HTMLCanvasElement>();

interface Comp {
  readonly ch: string;
  readonly cells: [number, number][];
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

function components(chars: readonly string[], pred: (ch: string) => boolean): Comp[] {
  const rows = chars.length;
  const cols = chars[0]!.length;
  const seen = new Uint8Array(rows * cols);
  const out: Comp[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = chars[r]![c]!;
      if (seen[r * cols + c] || !pred(ch)) continue;
      const cells: [number, number][] = [];
      const stack: [number, number][] = [[c, r]];
      seen[r * cols + c] = 1;
      let x0 = c, y0 = r, x1 = c, y1 = r;
      while (stack.length) {
        const [x, y] = stack.pop()!;
        cells.push([x, y]);
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen[ny * cols + nx]) continue;
          if (chars[ny]![nx] !== ch) continue;
          seen[ny * cols + nx] = 1;
          stack.push([nx, ny]);
        }
      }
      out.push({ ch, cells, x0, y0, x1, y1 });
    }
  }
  return out;
}

const FLOOR_MATERIALS: readonly Material[] = ['concrete', 'asphalt', 'wood', 'metal', 'gravel', 'grass', 'tile', 'stairs', 'rails', 'site', 'tspawn', 'ctspawn'];

export function renderMapArt(map: MapDefinition, scale = 2): HTMLCanvasElement {
  const key = `${map.id}@${map.version}@${scale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (!map.tiles) throw new Error('renderMapArt requires a tile map');
  const { cell: T, cols, rows, chars } = map.tiles;
  const p = paletteFor(map.id);
  const rng = Rng.fromSeed(`art:${map.id}:${map.version}`);
  const canvas = document.createElement('canvas');
  canvas.width = cols * T * scale;
  canvas.height = rows * T * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  const W = cols * T;
  const H = rows * T;
  const tile = (c: number, r: number) => TILES[chars[r]?.[c] ?? '#']!;

  // ---- 1. Floors (patterned) -------------------------------------------------
  const patterns = new Map<Material, CanvasPattern>();
  for (const m of FLOOR_MATERIALS) {
    const pat = ctx.createPattern(materialTile(m, p, map.id), 'repeat')!;
    pat.setTransform(new DOMMatrix().scale(0.5));
    patterns.set(m, pat);
  }
  ctx.fillStyle = '#0b0f13';
  ctx.fillRect(0, 0, W, H);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = tile(c, r);
      // Props stand on the surrounding floor material.
      let mat: Material | null = FLOOR_MATERIALS.includes(t.material) ? t.material : null;
      if (!mat && (t.cls === 'low' || t.cls === 'high') && t.material !== 'water') {
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const n = tile(c + dc, r + dr);
          if (FLOOR_MATERIALS.includes(n.material)) {
            mat = n.material;
            break;
          }
        }
        mat ??= 'concrete';
      }
      if (!mat) continue;
      ctx.fillStyle = patterns.get(mat)!;
      ctx.fillRect(c * T, r * T, T + 0.5, T + 0.5);
    }
  }

  // ---- 2. Water + foam --------------------------------------------------------
  const wpat = ctx.createPattern(waterTile(p, map.id), 'repeat')!;
  wpat.setTransform(new DOMMatrix().scale(0.6));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (chars[r]![c] === '~') {
        ctx.fillStyle = wpat;
        ctx.fillRect(c * T, r * T, T + 0.5, T + 0.5);
      }
  ctx.strokeStyle = 'rgba(210, 235, 245, 0.35)';
  ctx.lineWidth = 1.4;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (chars[r]![c] !== '~') continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = tile(c + dc, r + dr);
        if (n.cls === 'floor') {
          ctx.beginPath();
          const x = c * T + (dc === 1 ? T - 2 : dc === -1 ? 2 : 0);
          const y = r * T + (dr === 1 ? T - 2 : dr === -1 ? 2 : 0);
          if (dc !== 0) {
            ctx.moveTo(x, r * T);
            ctx.lineTo(x, r * T + T);
          } else {
            ctx.moveTo(c * T, y);
            ctx.lineTo(c * T + T, y);
          }
          ctx.stroke();
        }
      }
    }

  // ---- 3. Site and spawn markings --------------------------------------------
  for (const site of ['A', 'B'] as const) {
    ctx.fillStyle = 'rgba(232, 163, 61, 0.10)';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (chars[r]![c] === site) ctx.fillRect(c * T, r * T, T, T);
    // Hazard border on the site edge.
    ctx.strokeStyle = 'rgba(240, 180, 60, 0.55)';
    ctx.setLineDash([5, 4]);
    ctx.lineWidth = 2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (chars[r]![c] !== site) continue;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (chars[r + dr]?.[c + dc] === site) continue;
          if (tile(c + dc, r + dr).cls !== 'floor') continue;
          ctx.beginPath();
          if (dc !== 0) {
            const x = c * T + (dc === 1 ? T - 1 : 1);
            ctx.moveTo(x, r * T);
            ctx.lineTo(x, r * T + T);
          } else {
            const y = r * T + (dr === 1 ? T - 1 : 1);
            ctx.moveTo(c * T, y);
            ctx.lineTo(c * T + T, y);
          }
          ctx.stroke();
        }
      }
    ctx.setLineDash([]);
    const lbl = map.sites[site].label;
    ctx.save();
    ctx.translate(lbl.x, lbl.y);
    ctx.rotate(rng.range(-0.08, 0.08));
    ctx.font = '900 150px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#f0b43c';
    ctx.fillText(site, 0, 0);
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#f0b43c';
    ctx.strokeText(site, 0, 0);
    ctx.restore();
  }
  for (const [ch, color] of [['T', 'rgba(255, 122, 69, 0.10)'], ['C', 'rgba(74, 168, 255, 0.10)']] as const) {
    ctx.fillStyle = color;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (chars[r]![c] === ch) ctx.fillRect(c * T, r * T, T, T);
  }

  // ---- 4. Shadows and ambient occlusion from walls/high props -----------------
  const mask = document.createElement('canvas');
  mask.width = canvas.width;
  mask.height = canvas.height;
  const mctx = mask.getContext('2d')!;
  mctx.scale(scale, scale);
  mctx.fillStyle = '#000';
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (tile(c, r).cls === 'void' || tile(c, r).cls === 'high') mctx.fillRect(c * T, r * T, T, T);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 0.45;
  ctx.filter = `blur(${6 * scale}px)`;
  ctx.drawImage(mask, 7 * scale, 10 * scale); // cast shadow (light from the north-west)
  ctx.globalAlpha = 0.5;
  ctx.filter = `blur(${3 * scale}px)`;
  ctx.drawImage(mask, 0, 0); // ambient occlusion at wall bases
  ctx.restore();

  // ---- 5. Props -----------------------------------------------------------------
  const props = components(chars, (ch) => 'OopvxhwX'.includes(ch));
  for (const comp of props) drawProp(ctx, comp, T, p, rng);

  // ---- 6. Rooftops (solid areas) -------------------------------------------------
  const roofs = components(chars, (ch) => ch === '#');
  for (const roof of roofs) drawRoof(ctx, roof, T, p, rng, cols, rows);

  // ---- 7. Lighting: lamp pools near pillars and along open areas, then vignette ----
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const lamps: [number, number][] = [];
  for (const comp of props) if (comp.ch === 'p') lamps.push([(comp.x0 + comp.x1 + 1) / 2, (comp.y0 + comp.y1 + 1) / 2]);
  for (let i = 0; i < 18; i++) {
    const c = rng.int(0, cols - 1);
    const r = rng.int(0, rows - 1);
    if (tile(c, r).cls === 'floor' && lamps.every(([x, y]) => Math.hypot(x - c, y - r) > 8)) lamps.push([c + 0.5, r + 0.5]);
  }
  for (const [lc, lr] of lamps) {
    const g = ctx.createRadialGradient(lc * T, lr * T, 0, lc * T, lr * T, T * 5);
    g.addColorStop(0, p.lamp);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lc * T - T * 5, lr * T - T * 5, T * 10, T * 10);
  }
  ctx.restore();
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  cache.set(key, canvas);
  return canvas;
}

function drawProp(ctx: CanvasRenderingContext2D, comp: Comp, T: number, p: Palette, rng: Rng): void {
  const x = comp.x0 * T;
  const y = comp.y0 * T;
  const w = (comp.x1 - comp.x0 + 1) * T;
  const h = (comp.y1 - comp.y0 + 1) * T;
  const horizontal = w >= h;
  ctx.save();
  switch (comp.ch) {
    case 'O': {
      // Shipping container: corrugated steel, door end, roof dents.
      const base = rng.pick(p.containers);
      ctx.fillStyle = shade(base, -10);
      ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
      ctx.strokeStyle = shade(base, 18);
      ctx.lineWidth = 1;
      const step = 4;
      if (horizontal) for (let i = x + 3; i < x + w - 2; i += step) ctx.strokeRect(i, y + 2, 0.5, h - 4);
      else for (let i = y + 3; i < y + h - 2; i += step) ctx.strokeRect(x + 2, i, w - 4, 0.5);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x + 1, y + 1, w - 2, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      if (horizontal) ctx.fillRect(x + w - 6, y + 1, 5, h - 2);
      else ctx.fillRect(x + 1, y + h - 6, w - 2, 5);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
      break;
    }
    case 'o': {
      // Stacked wooden crates.
      for (const [cx, cy] of comp.cells) {
        const bx = cx * T + 1;
        const by = cy * T + 1;
        ctx.fillStyle = shade(p.wood, 18 + Math.round(rng.range(-8, 8)));
        ctx.fillRect(bx, by, T - 2, T - 2);
        ctx.strokeStyle = shade(p.wood, -30);
        ctx.lineWidth = 1.2;
        ctx.strokeRect(bx + 0.5, by + 0.5, T - 3, T - 3);
        ctx.beginPath();
        ctx.moveTo(bx + 2, by + 2);
        ctx.lineTo(bx + T - 4, by + T - 4);
        ctx.moveTo(bx + T - 4, by + 2);
        ctx.lineTo(bx + 2, by + T - 4);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.10)';
        ctx.fillRect(bx, by, T - 2, 2);
      }
      break;
    }
    case 'x': {
      // Low pallets / sandbag-height crates.
      for (const [cx, cy] of comp.cells) {
        const bx = cx * T + 3;
        const by = cy * T + 3;
        ctx.fillStyle = shade(p.wood, 30);
        ctx.fillRect(bx, by, T - 6, T - 6);
        ctx.fillStyle = shade(p.wood, 5);
        for (let i = 0; i < 3; i++) ctx.fillRect(bx, by + 2 + i * 5, T - 6, 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.45)';
        ctx.strokeRect(bx + 0.5, by + 0.5, T - 7, T - 7);
      }
      break;
    }
    case 'p': {
      for (const [cx, cy] of comp.cells) {
        const g = ctx.createLinearGradient(cx * T, cy * T, cx * T + T, cy * T + T);
        g.addColorStop(0, '#6b7176');
        g.addColorStop(1, '#2e3236');
        ctx.fillStyle = g;
        ctx.fillRect(cx * T + 2, cy * T + 2, T - 4, T - 4);
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.strokeRect(cx * T + 2.5, cy * T + 2.5, T - 5, T - 5);
      }
      break;
    }
    case 'v': {
      // Top-down vehicle: body, cab, windscreen, wheels.
      const body = rng.pick(['#3d4c5c', '#5a3b32', '#c9c3b5', '#2d3a2e', '#a4402d']);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      if (horizontal) {
        ctx.fillRect(x + 6, y - 1, 6, 3); ctx.fillRect(x + w - 12, y - 1, 6, 3);
        ctx.fillRect(x + 6, y + h - 2, 6, 3); ctx.fillRect(x + w - 12, y + h - 2, 6, 3);
      } else {
        ctx.fillRect(x - 1, y + 6, 3, 6); ctx.fillRect(x + w - 2, y + 6, 3, 6);
        ctx.fillRect(x - 1, y + h - 12, 3, 6); ctx.fillRect(x + w - 2, y + h - 12, 3, 6);
      }
      ctx.fillStyle = body;
      roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 4);
      ctx.fill();
      ctx.fillStyle = 'rgba(160, 200, 220, 0.55)';
      if (horizontal) ctx.fillRect(x + w - 14, y + 4, 5, h - 8);
      else ctx.fillRect(x + 4, y + 6, w - 8, 5);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fillRect(x + 3, y + 3, w - 6, 2);
      break;
    }
    case 'h': {
      ctx.strokeStyle = '#c8ccd0';
      ctx.lineWidth = 2;
      for (const [cx, cy] of comp.cells) {
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(cx * T, cy * T + T / 2);
          ctx.lineTo(cx * T + T, cy * T + T / 2);
        } else {
          ctx.moveTo(cx * T + T / 2, cy * T);
          ctx.lineTo(cx * T + T / 2, cy * T + T);
        }
        ctx.stroke();
        ctx.fillStyle = '#e4e7ea';
        ctx.fillRect(cx * T + T / 2 - 1.5, cy * T + T / 2 - 1.5, 3, 3);
      }
      break;
    }
    case 'w': {
      for (const [cx, cy] of comp.cells) {
        ctx.fillStyle = 'rgba(150, 205, 235, 0.45)';
        ctx.fillRect(cx * T + 1, cy * T + 5, T - 2, T - 10);
        ctx.strokeStyle = '#2a3036';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx * T + 1, cy * T + 5, T - 2, T - 10);
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx * T + 4, cy * T + T - 7);
        ctx.lineTo(cx * T + 10, cy * T + 7);
        ctx.stroke();
      }
      break;
    }
  }
  ctx.restore();
}

function drawRoof(ctx: CanvasRenderingContext2D, roof: Comp, T: number, p: Palette, rng: Rng, cols: number, rows: number): void {
  const color = rng.pick(p.roofs);
  const style = rng.int(0, 2);
  const inside = new Set(roof.cells.map(([c, r]) => `${c},${r}`));
  for (const [c, r] of roof.cells) {
    ctx.fillStyle = shade(color, Math.round(rng.range(-3, 3)));
    ctx.fillRect(c * T, r * T, T + 0.5, T + 0.5);
  }
  // Roof surface detail.
  ctx.save();
  ctx.beginPath();
  for (const [c, r] of roof.cells) ctx.rect(c * T, r * T, T + 0.5, T + 0.5);
  ctx.clip();
  const x0 = roof.x0 * T;
  const y0 = roof.y0 * T;
  const w = (roof.x1 - roof.x0 + 1) * T;
  const h = (roof.y1 - roof.y0 + 1) * T;
  if (style === 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let i = (w > h ? y0 : x0); i < (w > h ? y0 + h : x0 + w); i += 6) {
      ctx.beginPath();
      if (w > h) {
        ctx.moveTo(x0, i);
        ctx.lineTo(x0 + w, i);
      } else {
        ctx.moveTo(i, y0);
        ctx.lineTo(i, y0 + h);
      }
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < (roof.cells.length * 6); i++) {
      const [c, r] = rng.pick(roof.cells);
      ctx.fillStyle = `rgba(255,255,255,${rng.range(0.02, 0.06).toFixed(3)})`;
      ctx.fillRect(c * T + rng.range(0, T), r * T + rng.range(0, T), 1.5, 1.5);
    }
  }
  // Vents / AC units on larger roofs.
  const units = Math.floor(roof.cells.length / 40);
  for (let i = 0; i < units; i++) {
    const [c, r] = rng.pick(roof.cells);
    if (!inside.has(`${c + 1},${r}`) || !inside.has(`${c},${r + 1}`)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(c * T + 4, r * T + 6, T + 4, T - 2);
    ctx.fillStyle = shade(color, 30);
    ctx.fillRect(c * T + 2, r * T + 3, T + 4, T - 2);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(c * T + 2 + (T + 4) / 2, r * T + 3 + (T - 2) / 2, 5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  // Parapet: highlight edges facing open floor.
  for (const [c, r] of roof.cells) {
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows || inside.has(`${nc},${nr}`)) continue;
      ctx.fillStyle = dr === -1 || dc === -1 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.4)';
      if (dc !== 0) ctx.fillRect(c * T + (dc === 1 ? T - 2 : 0), r * T, 2, T);
      else ctx.fillRect(c * T, r * T + (dr === 1 ? T - 2 : 0), T, 2);
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
