/**
 * Broadcast map renderer: a near-3D, three-quarter top-down rendering of a tile map.
 *
 * Geometry is exactly the simulation's tile data. Depth comes from drawing each solid block and
 * prop inside its own footprint:
 * - the top (roof, container lid) on the upper part of the footprint;
 * - the lit front wall face along the bottom edge;
 * - soft cast shadows onto the floor, and ambient occlusion at wall bases.
 *
 * Nothing extends into walkable cells, so no player is ever hidden. Materials use AI-generated
 * textures and sprites when present, with procedural fallbacks.
 */
import { TILES, type Material } from '../../core/match/maps/tilemap';
import type { MapDefinition } from '../../core/match/maps/types';
import { Rng } from '../../core/rng/prng';
import { loadImage, loadTrimmed, spriteUrl, textureUrl } from '../art/generated';
import { components, roundRect, type Comp } from '../viewer/art/mapArt';
import { materialTile, paletteFor, shade, waterTile } from '../viewer/art/textures';

const cache = new Map<string, Promise<HTMLCanvasElement>>();

/** Which generated texture paints each floor material. */
const TEXTURE_OF: Partial<Record<Material, string>> = {
  concrete: 'concrete', asphalt: 'asphalt', wood: 'wood', metal: 'metal', gravel: 'gravel', grass: 'grass', tile: 'tile',
  site: 'concrete', tspawn: 'asphalt', ctspawn: 'concrete', stairs: 'concrete', rails: 'gravel',
};
const FLOORS: readonly Material[] = ['concrete', 'asphalt', 'wood', 'metal', 'gravel', 'grass', 'tile', 'stairs', 'rails', 'site', 'tspawn', 'ctspawn'];
const ROOFS = ['roof_metal', 'roof_tar'] as const;
/** Roof tints: dark slate and steel tones, so roofs never read as walkable floor. */
const ROOF_TINTS = ['#2c333c', '#353d47', '#2a3a40', '#3a3d42', '#30363f'];
/** World units covered by one texture image (texture detail scale). */
const TEX_UNITS = 64;

export function renderBroadcastMap(map: MapDefinition, scale = 2): Promise<HTMLCanvasElement> {
  const key = `${map.id}@${map.version}@${scale}`;
  let p = cache.get(key);
  if (!p) {
    p = draw(map, scale);
    cache.set(key, p);
  }
  return p;
}

async function draw(map: MapDefinition, scale: number): Promise<HTMLCanvasElement> {
  if (!map.tiles) throw new Error('renderBroadcastMap requires a tile map');
  const { cell: T, cols, rows, chars } = map.tiles;
  const pal = paletteFor(map.id);
  const rng = Rng.fromSeed(`bcast:${map.id}:${map.version}`);
  const texIds = [...new Set([...Object.values(TEXTURE_OF), 'water', 'rails', 'brick', ...ROOFS])];
  const spriteIds = ['container_red', 'container_teal', 'container_ochre', 'crates', 'crate_single', 'barrels', 'pallet', 'truck', 'car', 'forklift', 'boat', 'pillar', 'lowcrate'];
  const tex = new Map<string, HTMLImageElement>();
  const spr = new Map<string, CanvasImageSource & { width: number; height: number }>();
  await Promise.all([
    ...texIds.map(async (id) => {
      const img = await loadImage(textureUrl(id!));
      if (img) tex.set(id!, img);
    }),
    ...spriteIds.map(async (id) => {
      const img = await loadTrimmed(spriteUrl(id));
      if (img) spr.set(id, img);
    }),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = cols * T * scale;
  canvas.height = rows * T * scale;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);
  const W = cols * T;
  const H = rows * T;
  const tile = (c: number, r: number) => TILES[chars[r]?.[c] ?? '#']!;
  const isSolid = (c: number, r: number) => (chars[r]?.[c] ?? '#') === '#';

  const pattern = (id: string | undefined, fallback: () => HTMLCanvasElement, units = TEX_UNITS): CanvasPattern => {
    const img = id ? tex.get(id) : undefined;
    if (img) {
      const pat = ctx.createPattern(img, 'repeat')!;
      pat.setTransform(new DOMMatrix().scale(units / img.width));
      return pat;
    }
    const pat = ctx.createPattern(fallback(), 'repeat')!;
    pat.setTransform(new DOMMatrix().scale(0.5));
    return pat;
  };

  // ---- 1. Floors --------------------------------------------------------------
  ctx.fillStyle = '#0a0d11';
  ctx.fillRect(0, 0, W, H);
  const floorPat = new Map<Material, CanvasPattern>();
  for (const m of FLOORS) floorPat.set(m, pattern(TEXTURE_OF[m], () => materialTile(m, pal, map.id)));
  const floorOf = (c: number, r: number): Material | null => {
    const t = tile(c, r);
    if (FLOORS.includes(t.material)) return t.material;
    if ((t.cls === 'low' || t.cls === 'high') && t.material !== 'water') {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const n = tile(c + dc, r + dr);
        if (FLOORS.includes(n.material)) return n.material;
      }
      return 'concrete';
    }
    return null;
  };
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      const m = floorOf(c, r);
      if (!m) continue;
      ctx.fillStyle = floorPat.get(m)!;
      ctx.fillRect(c * T, r * T, T + 0.5, T + 0.5);
    }
  // Rail tracks: the rails texture runs vertically along each rail column.
  const railTex = tex.get('rails');
  for (const comp of components(chars, (ch) => ch === 'r')) {
    const vertical = comp.y1 - comp.y0 >= comp.x1 - comp.x0;
    ctx.save();
    ctx.beginPath();
    for (const [c, r] of comp.cells) ctx.rect(c * T, r * T, T, T);
    ctx.clip();
    if (railTex) {
      const pat = ctx.createPattern(railTex, 'repeat')!;
      const k = (T * 1.6) / railTex.width;
      const cx = ((comp.x0 + comp.x1 + 1) / 2) * T;
      const cy = ((comp.y0 + comp.y1 + 1) / 2) * T;
      pat.setTransform(new DOMMatrix().translate(vertical ? cx - T * 0.8 : 0, vertical ? 0 : cy - T * 0.8).rotate(vertical ? 0 : 90).scale(k));
      ctx.fillStyle = pat;
      ctx.fillRect(comp.x0 * T, comp.y0 * T, (comp.x1 - comp.x0 + 1) * T, (comp.y1 - comp.y0 + 1) * T);
    }
    ctx.restore();
  }
  // Stairs: step lines.
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1;
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      if (chars[r]![c] === 's') for (let k = 3; k < T; k += 5) {
        ctx.beginPath();
        ctx.moveTo(c * T, r * T + k);
        ctx.lineTo(c * T + T, r * T + k);
        ctx.stroke();
      }

  // ---- 2. Water ---------------------------------------------------------------
  ctx.fillStyle = pattern('water', () => waterTile(pal, map.id), 110);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (chars[r]![c] === '~') ctx.fillRect(c * T, r * T, T + 0.5, T + 0.5);
  // Quay edges: a lit lip and a dark waterline.
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (chars[r]![c] !== '~') continue;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        if (tile(c + dc, r + dr).cls !== 'floor') continue;
        const x = c * T + (dc === 1 ? T - 3 : 0);
        const y = r * T + (dr === 1 ? T - 3 : 0);
        ctx.fillStyle = 'rgba(0,0,0,0.45)';
        if (dc !== 0) ctx.fillRect(x, r * T, 3, T);
        else ctx.fillRect(c * T, y, T, 3);
        ctx.fillStyle = 'rgba(200,230,240,0.25)';
        if (dc !== 0) ctx.fillRect(dc === 1 ? c * T + T - 1 : c * T, r * T, 1, T);
        else ctx.fillRect(c * T, dr === 1 ? r * T + T - 1 : r * T, T, 1);
      }
    }

  // ---- 3. Site and spawn markings ----------------------------------------------
  for (const site of ['A', 'B'] as const) {
    ctx.fillStyle = 'rgba(229, 179, 92, 0.07)';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (chars[r]![c] === site) ctx.fillRect(c * T, r * T, T, T);
    ctx.strokeStyle = 'rgba(229, 179, 92, 0.6)';
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 2;
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        if (chars[r]![c] !== site) continue;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          if (chars[r + dr]?.[c + dc] === site || tile(c + dc, r + dr).cls !== 'floor') continue;
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
    // Painted site letter, worn into the floor.
    const lbl = map.sites[site].label;
    ctx.save();
    ctx.translate(lbl.x, lbl.y);
    ctx.font = '900 140px "Barlow Condensed", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = '#e5b35c';
    ctx.fillText(site, 0, 0);
    ctx.restore();
  }
  for (const [ch, color] of [['T', 'rgba(232, 129, 76, 0.08)'], ['C', 'rgba(73, 167, 239, 0.08)']] as const) {
    ctx.fillStyle = color;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (chars[r]![c] === ch) ctx.fillRect(c * T, r * T, T, T);
  }

  // ---- 4. Cast shadows and ambient occlusion ----------------------------------------
  // Heights: buildings tall, containers/vehicles medium, crates lower, low cover very low.
  const heightOf = (ch: string) => (ch === '#' ? 1 : 'Ov'.includes(ch) ? 0.6 : ch === 'o' || ch === 'p' ? 0.45 : 'xhw'.includes(ch) ? 0.15 : 0);
  for (const [h, blur, alpha] of [[1, 9, 0.5], [0.6, 6, 0.45], [0.45, 4, 0.42], [0.15, 2, 0.35]] as const) {
    const mask = document.createElement('canvas');
    mask.width = canvas.width;
    mask.height = canvas.height;
    const m = mask.getContext('2d')!;
    m.scale(scale, scale);
    m.fillStyle = '#000';
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (heightOf(chars[r]![c]!) === h) m.fillRect(c * T, r * T, T, T);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.filter = `blur(${blur * scale}px)`;
    // Light from the north-west: shadows fall south-east, longer for taller blocks.
    ctx.drawImage(mask, 9 * h * scale, 15 * h * scale);
    if (h === 1) {
      ctx.globalAlpha = 0.55;
      ctx.filter = `blur(${3 * scale}px)`;
      ctx.drawImage(mask, 0, 0);
    }
    ctx.restore();
  }

  // ---- 5. Props (three-quarter: top surface + front face inside the footprint) -----
  const contColors = ['container_red', 'container_teal', 'container_ochre'];
  for (const comp of components(chars, (ch) => 'OopvxhwX'.includes(ch))) drawProp(ctx, comp, T, rng, spr, contColors, pal.wood);

  // ---- 6. Buildings ---------------------------------------------------------------------
  const roofPats = ROOFS.map((id) => (tex.get(id) ? pattern(id, () => materialTile('concrete', pal, map.id), 90) : null));
  for (const roof of components(chars, (ch) => ch === '#')) {
    // Skip the outer frame of solid that only borders the map edge or water.
    const touchesFloor = roof.cells.some(([c, r]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dc, dr]) => tile(c + dc!, r + dr!).cls === 'floor' || tile(c + dc!, r + dr!).cls === 'low'));
    drawBuilding(ctx, roof, T, rng, roofPats, ROOF_TINTS, isSolid, touchesFloor);
  }

  // ---- 7. Lighting -----------------------------------------------------------------------
  ctx.save();
  ctx.globalCompositeOperation = 'soft-light';
  const sky = ctx.createLinearGradient(0, 0, W, H);
  sky.addColorStop(0, 'rgba(255, 236, 200, 0.35)');
  sky.addColorStop(1, 'rgba(40, 60, 90, 0.35)');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const lamps: [number, number][] = [];
  for (let i = 0; i < 26; i++) {
    const c = rng.int(1, cols - 2);
    const r = rng.int(1, rows - 2);
    if (tile(c, r).cls === 'floor' && lamps.every(([x, y]) => Math.hypot(x - c, y - r) > 7)) lamps.push([c + 0.5, r + 0.5]);
  }
  for (const [lc, lr] of lamps) {
    const g = ctx.createRadialGradient(lc * T, lr * T, 0, lc * T, lr * T, T * 4.5);
    g.addColorStop(0, 'rgba(255, 196, 120, 0.13)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(lc * T - T * 5, lr * T - T * 5, T * 10, T * 10);
  }
  ctx.restore();
  const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.78);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.5)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
  return canvas;
}

/** Draws an image stretched over a rectangle, rotated 90° when the footprint is wider than tall. */
function drawFitted(ctx: CanvasRenderingContext2D, img: CanvasImageSource, x: number, y: number, w: number, h: number, rotate: boolean): void {
  ctx.save();
  if (rotate) {
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(Math.PI / 2);
    ctx.drawImage(img, -h / 2, -w / 2, h, w);
  } else ctx.drawImage(img, x, y, w, h);
  ctx.restore();
}

function frontFace(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, face: number, base: string): void {
  const g = ctx.createLinearGradient(0, y, 0, y + face);
  g.addColorStop(0, shade(base, -18));
  g.addColorStop(1, shade(base, -48));
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, face);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.fillRect(x, y - 0.6, w, 1.2);
}

function drawProp(ctx: CanvasRenderingContext2D, comp: Comp, T: number, rng: Rng, spr: Map<string, CanvasImageSource>, contColors: string[], wood: string): void {
  const x = comp.x0 * T;
  const y = comp.y0 * T;
  const w = (comp.x1 - comp.x0 + 1) * T;
  const h = (comp.y1 - comp.y0 + 1) * T;
  const wide = w > h;
  switch (comp.ch) {
    case 'O': {
      const id = rng.pick(contColors);
      const img = spr.get(id);
      const face = Math.min(7, h * 0.22);
      const base = id.includes('red') ? '#8e3b2e' : id.includes('teal') ? '#2f6d6a' : '#a07b2c';
      frontFace(ctx, x + 0.5, y + h - face, w - 1, face, base);
      if (img) drawFitted(ctx, img, x + 0.5, y + 0.5, w - 1, h - face, wide);
      else {
        ctx.fillStyle = base;
        ctx.fillRect(x + 0.5, y + 0.5, w - 1, h - face);
      }
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      break;
    }
    case 'o': {
      const big = spr.get('crates');
      const single = spr.get('crate_single');
      for (const [cx, cy] of comp.cells) {
        const bx = cx * T;
        const by = cy * T;
        const face = 4;
        frontFace(ctx, bx + 1, by + T - face, T - 2, face, wood);
        const img = (cx + cy) % 3 === 0 ? big ?? single : single ?? big;
        if (img) ctx.drawImage(img, bx + 1, by + 1, T - 2, T - face - 1);
        else {
          ctx.fillStyle = shade(wood, 15);
          ctx.fillRect(bx + 1, by + 1, T - 2, T - face - 1);
        }
      }
      break;
    }
    case 'v': {
      const area = w * h;
      const id = area >= T * T * 9 ? (wide ? 'truck' : 'boat') : area >= T * T * 6 ? 'truck' : rng.chance(0.5) ? 'car' : 'forklift';
      const img = spr.get(id) ?? spr.get('car');
      const face = 4;
      frontFace(ctx, x + 2, y + h - face, w - 4, face, '#3a4048');
      if (img) drawFitted(ctx, img, x + 0.5, y + 0.5, w - 1, h - face, wide);
      else {
        ctx.fillStyle = '#5a6672';
        roundRect(ctx, x + 2, y + 2, w - 4, h - face - 2, 3);
        ctx.fill();
      }
      break;
    }
    case 'p': {
      const img = spr.get('pillar');
      for (const [cx, cy] of comp.cells) {
        frontFace(ctx, cx * T + 3, cy * T + T - 5, T - 6, 4, '#3b4045');
        if (img) ctx.drawImage(img, cx * T + 2, cy * T + 1, T - 4, T - 5);
        else {
          ctx.fillStyle = '#4a5056';
          ctx.fillRect(cx * T + 3, cy * T + 2, T - 6, T - 6);
        }
      }
      break;
    }
    case 'x': {
      const img = spr.get('lowcrate') ?? spr.get('pallet');
      for (const [cx, cy] of comp.cells) {
        frontFace(ctx, cx * T + 2, cy * T + T - 4, T - 4, 2.5, '#6c6f72');
        if (img) ctx.drawImage(img, cx * T + 1.5, cy * T + 2, T - 3, T - 5);
        else {
          ctx.fillStyle = shade(wood, 25);
          ctx.fillRect(cx * T + 3, cy * T + 3, T - 6, T - 7);
        }
      }
      break;
    }
    case 'h': {
      // Railings: posts and a rail, slightly raised.
      for (const [cx, cy] of comp.cells) {
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        if (wide) {
          ctx.moveTo(cx * T, cy * T + T / 2 + 1.5);
          ctx.lineTo(cx * T + T, cy * T + T / 2 + 1.5);
        } else {
          ctx.moveTo(cx * T + T / 2 + 1.5, cy * T);
          ctx.lineTo(cx * T + T / 2 + 1.5, cy * T + T);
        }
        ctx.stroke();
        ctx.strokeStyle = '#d7dbe0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (wide) {
          ctx.moveTo(cx * T, cy * T + T / 2);
          ctx.lineTo(cx * T + T, cy * T + T / 2);
        } else {
          ctx.moveTo(cx * T + T / 2, cy * T);
          ctx.lineTo(cx * T + T / 2, cy * T + T);
        }
        ctx.stroke();
        ctx.fillStyle = '#f1f4f6';
        ctx.fillRect(cx * T + T / 2 - 2, cy * T + T / 2 - 2, 4, 4);
      }
      break;
    }
    case 'w': {
      for (const [cx, cy] of comp.cells) {
        ctx.fillStyle = '#2a3036';
        ctx.fillRect(cx * T, cy * T + 4, T, T - 8);
        ctx.fillStyle = 'rgba(150, 205, 235, 0.5)';
        ctx.fillRect(cx * T + 1.5, cy * T + 5.5, T - 3, T - 11);
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx * T + 4, cy * T + T - 7);
        ctx.lineTo(cx * T + 9, cy * T + 7);
        ctx.stroke();
      }
      break;
    }
  }
}

function drawBuilding(
  ctx: CanvasRenderingContext2D,
  roof: Comp,
  T: number,
  rng: Rng,
  roofPats: (CanvasPattern | null)[],
  roofColors: readonly string[],
  isSolid: (c: number, r: number) => boolean,
  visible: boolean,
): void {
  const color = rng.pick(roofColors);
  const pat = rng.pick(roofPats.filter((p): p is CanvasPattern => !!p).length ? roofPats.filter((p): p is CanvasPattern => !!p) : [null]);
  ctx.save();
  ctx.beginPath();
  for (const [c, r] of roof.cells) ctx.rect(c * T, r * T, T + 0.4, T + 0.4);
  ctx.clip();
  ctx.fillStyle = pat ?? color;
  ctx.fillRect(roof.x0 * T, roof.y0 * T, (roof.x1 - roof.x0 + 1) * T, (roof.y1 - roof.y0 + 1) * T);
  // Tint so neighbouring buildings differ and the roof sits darker than the floor.
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.6;
  ctx.fillRect(roof.x0 * T, roof.y0 * T, (roof.x1 - roof.x0 + 1) * T, (roof.y1 - roof.y0 + 1) * T);
  ctx.globalAlpha = 1;
  // Rooftop units on larger roofs.
  const units = Math.floor(roof.cells.length / 35);
  const inside = new Set(roof.cells.map(([c, r]) => `${c},${r}`));
  for (let i = 0; i < units; i++) {
    const [c, r] = rng.pick(roof.cells);
    if (!inside.has(`${c + 1},${r}`) || !inside.has(`${c},${r + 1}`) || !inside.has(`${c + 1},${r + 1}`)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(c * T + 6, r * T + 8, T + 6, T - 2);
    ctx.fillStyle = shade(color, 40);
    ctx.fillRect(c * T + 3, r * T + 4, T + 6, T - 3);
    ctx.fillStyle = shade(color, 15);
    ctx.fillRect(c * T + 3, r * T + T - 1, T + 6, 3);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(c * T + 3 + (T + 6) / 2, r * T + 4 + (T - 3) / 2, 5.5, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (!visible) return;
  // Walls: the south-facing wall face is visible inside the bottom of each edge cell; parapets on top.
  const wall = '#6b6f74';
  for (const [c, r] of roof.cells) {
    // Crisp outer edge: a dark outline where the building meets open ground.
    ctx.fillStyle = 'rgba(5,7,10,0.85)';
    if (!isSolid(c, r - 1)) ctx.fillRect(c * T, r * T - 0.5, T + 0.4, 1.2);
    if (!isSolid(c - 1, r)) ctx.fillRect(c * T - 0.5, r * T, 1.2, T);
    if (!isSolid(c + 1, r)) ctx.fillRect(c * T + T - 0.7, r * T, 1.2, T);
    if (!isSolid(c, r + 1)) {
      const face = T * 0.42;
      const g = ctx.createLinearGradient(0, r * T + T - face, 0, r * T + T);
      g.addColorStop(0, shade(wall, 6));
      g.addColorStop(1, shade(wall, -40));
      ctx.fillStyle = g;
      ctx.fillRect(c * T, r * T + T - face, T + 0.4, face);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let k = 2; k < T; k += 5) ctx.fillRect(c * T + k, r * T + T - face + 1, 0.8, face - 1);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fillRect(c * T, r * T + T - face - 1, T + 0.4, 1.4);
    }
    if (!isSolid(c, r - 1)) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(c * T, r * T + 0.7, T + 0.4, 1.6);
    }
    if (!isSolid(c - 1, r)) {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(c * T, r * T, 1.6, T);
    }
    if (!isSolid(c + 1, r)) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(c * T + T - 2, r * T, 2, T);
    }
  }
}
