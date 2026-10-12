/**
 * In-game kit compositor. Base portraits are shot in a plain chroma-key green
 * top on a transparent background; this paints the current team's kit and
 * crest onto that top, keeping the photo's folds and shading, so a transfer
 * never needs a new generated image.
 */
export type KitPattern = 'raglan' | 'diagonal' | 'chevrons' | 'sidepanels' | 'yoke' | 'wave' | 'pinstripes' | 'sleeves';

export interface Kit {
  readonly base: string;
  readonly secondary: string;
  readonly trim: string;
  readonly pattern: KitPattern;
  readonly backdrop: readonly [string, string] | readonly string[];
}

interface Box {
  x0: number;
  y0: number;
  w: number;
  h: number;
}

/** 0..1: how strongly a pixel belongs to the chroma-key top. */
function keyWeight(r: number, g: number, _b: number): number {
  // The key top renders as a blue-leaning green with almost no red; skin and hair always carry more red than green.
  const lead = g - r;
  const byLead = Math.min(1, Math.max(0, (lead - 14) / 34));
  const byPurity = Math.min(1, Math.max(0, (lead / (g + 1) - 0.55) / 0.25));
  return byLead * byPurity;
}

function drawPattern(ctx: CanvasRenderingContext2D, kit: Kit, box: Box): void {
  const { x0, y0, w, h } = box;
  const X = (u: number) => x0 + u * w;
  const Y = (v: number) => y0 + v * h;
  const poly = (pts: [number, number][], color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    pts.forEach(([u, v], i) => (i ? ctx.lineTo(X(u), Y(v)) : ctx.moveTo(X(u), Y(v))));
    ctx.closePath();
    ctx.fill();
  };
  ctx.fillStyle = kit.base;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const s = kit.secondary;
  switch (kit.pattern) {
    case 'raglan':
      poly([[0.36, -0.1], [0.08, 0.5], [-0.2, 0.5], [-0.2, -0.1]], s);
      poly([[0.64, -0.1], [0.92, 0.5], [1.2, 0.5], [1.2, -0.1]], s);
      ctx.globalAlpha = 0.18;
      for (let i = 0; i < 4; i++) poly([[0.15 + i * 0.12, 1.1], [0.35 + i * 0.12, 1.1], [0.75 + i * 0.12, 0.3], [0.7 + i * 0.12, 0.3]], s);
      ctx.globalAlpha = 1;
      break;
    case 'diagonal':
      poly([[0.72, -0.1], [0.98, -0.1], [0.3, 1.1], [0.04, 1.1]], s);
      break;
    case 'chevrons':
      for (let i = 0; i < 3; i++) {
        const v = 0.3 + i * 0.11;
        poly([[0.15, v], [0.5, v + 0.14], [0.85, v], [0.85, v + 0.05], [0.5, v + 0.19], [0.15, v + 0.05]], s);
      }
      poly([[-0.2, 0.25], [0.15, 0.25], [0.15, 0.3], [-0.2, 0.3]], s);
      poly([[0.85, 0.25], [1.2, 0.25], [1.2, 0.3], [0.85, 0.3]], s);
      break;
    case 'sidepanels':
      poly([[-0.2, -0.1], [0.2, -0.1], [0.24, 1.1], [-0.2, 1.1]], s);
      poly([[0.8, -0.1], [1.2, -0.1], [1.2, 1.1], [0.76, 1.1]], s);
      ctx.globalAlpha = 0.12;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = h * 0.02;
      for (let i = 0; i < 6; i++) {
        ctx.beginPath();
        for (let u = 0.2; u <= 0.8; u += 0.02) ctx.lineTo(X(u), Y(0.35 + i * 0.1 + Math.sin(u * 14) * 0.015));
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    case 'yoke':
      poly([[-0.2, -0.1], [1.2, -0.1], [1.2, 0.24], [-0.2, 0.24]], s);
      poly([[-0.2, 0.24], [1.2, 0.24], [1.2, 0.265], [-0.2, 0.265]], kit.trim);
      break;
    case 'wave':
      ctx.fillStyle = s;
      ctx.beginPath();
      for (let u = -0.2; u <= 1.2; u += 0.02) ctx.lineTo(X(u), Y(0.42 - 0.12 * Math.sin((u + 0.1) * 4.2)));
      for (let u = 1.2; u >= -0.2; u -= 0.02) ctx.lineTo(X(u), Y(0.47 - 0.12 * Math.sin((u + 0.1) * 4.2)));
      ctx.fill();
      break;
    case 'pinstripes':
      for (let u = 0.03; u < 1; u += 0.055) poly([[u, -0.1], [u + 0.008, -0.1], [u + 0.008, 1.1], [u, 1.1]], s);
      poly([[-0.2, 0.08], [1.2, 0.08], [1.2, 0.13], [-0.2, 0.13]], s);
      break;
    case 'sleeves':
      poly([[-0.2, -0.1], [0.17, -0.1], [0.2, 0.55], [-0.2, 0.55]], s);
      poly([[0.83, -0.1], [1.2, -0.1], [1.2, 0.55], [0.8, 0.55]], s);
      poly([[0.205, 0.5], [0.225, 0.5], [0.235, 1.1], [0.215, 1.1]], kit.trim);
      poly([[0.775, 0.5], [0.795, 0.5], [0.785, 1.1], [0.765, 1.1]], kit.trim);
      break;
  }
  // Collar trim.
  ctx.strokeStyle = kit.trim;
  ctx.lineWidth = Math.max(2, h * 0.028);
  ctx.beginPath();
  ctx.ellipse(X(0.5), Y(0.0), w * 0.15, h * 0.07, 0, 0, Math.PI);
  ctx.stroke();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`failed to load ${src}`));
    img.src = src;
  });
}

const cache = new Map<string, Promise<string>>();

/**
 * Returns an object URL of the portrait wearing `kit` with `crestUrl` on the chest.
 * Results are cached per (portrait, kit, crest, backdrop) combination.
 */
export function composeKitPortrait(portraitUrl: string, kit: Kit, crestUrl: string | null, opts: { size?: number; backdrop?: boolean } = {}): Promise<string> {
  const size = opts.size ?? 512;
  const key = JSON.stringify([portraitUrl, kit, crestUrl, size, opts.backdrop ?? true]);
  let hit = cache.get(key);
  if (!hit) {
    hit = compose(portraitUrl, kit, crestUrl, size, opts.backdrop ?? true);
    cache.set(key, hit);
  }
  return hit;
}

async function compose(portraitUrl: string, kit: Kit, crestUrl: string | null, size: number, backdrop: boolean): Promise<string> {
  const [img, crest] = await Promise.all([loadImage(portraitUrl), crestUrl ? loadImage(crestUrl) : Promise.resolve(null)]);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);
  const photo = ctx.getImageData(0, 0, size, size);
  const px = photo.data;

  // Mask, bounding box and the reference brightness of the key colour.
  const weight = new Float32Array(size * size);
  let x0 = size;
  let x1 = 0;
  let y0 = size;
  let y1 = 0;
  const greens: number[] = [];
  for (let i = 0, p = 0; i < weight.length; i++, p += 4) {
    if (px[p + 3]! < 8) continue;
    const wgt = keyWeight(px[p]!, px[p + 1]!, px[p + 2]!);
    weight[i] = wgt;
    if (wgt > 0.6) {
      const x = i % size;
      const y = (i / size) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      if ((i & 7) === 0) greens.push(px[p + 1]!);
    }
  }
  if (greens.length === 0) return canvas.toDataURL('image/webp', 0.92); // no key colour: leave untouched
  greens.sort((a, b) => a - b);
  const ref = greens[Math.floor(greens.length * 0.6)]!;

  // Kit layer (pattern + crest) in the top's bounding box.
  const box = { x0, y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  const kitCanvas = document.createElement('canvas');
  kitCanvas.width = kitCanvas.height = size;
  const kctx = kitCanvas.getContext('2d', { willReadFrequently: true })!;
  drawPattern(kctx, kit, box);
  if (crest) {
    // Wearer's left chest (viewer's right).
    const c = box.w * 0.17;
    kctx.drawImage(crest, box.x0 + box.w * 0.66 - c / 2, box.y0 + box.h * 0.2, c, c);
  }
  const kitPx = kctx.getImageData(0, 0, size, size).data;

  for (let i = 0, p = 0; i < weight.length; i++, p += 4) {
    const wgt = weight[i]!;
    if (wgt <= 0) continue;
    const shade = px[p + 1]! / ref;
    for (let c = 0; c < 3; c++) {
      const k = kitPx[p + c]!;
      const lit = shade <= 1 ? k * shade : k + (255 - k) * Math.min(1, (shade - 1) * 0.7);
      // Despill partially keyed edge pixels: pull green down toward the other channels.
      const orig = c === 1 ? Math.min(px[p + 1]!, Math.max(px[p]!, px[p + 2]!) + 10) : px[p + c]!;
      px[p + c] = Math.round(orig * (1 - wgt) + lit * wgt);
    }
  }
  ctx.clearRect(0, 0, size, size);
  if (backdrop) {
    const g = ctx.createRadialGradient(size * 0.5, size * 0.35, size * 0.05, size * 0.5, size * 0.5, size * 0.75);
    g.addColorStop(0, kit.backdrop[0] ?? '#1a2430');
    g.addColorStop(1, kit.backdrop[1] ?? '#06090d');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const person = document.createElement('canvas');
  person.width = person.height = size;
  person.getContext('2d')!.putImageData(photo, 0, 0);
  ctx.drawImage(person, 0, 0);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/webp', 0.92));
  return blob ? URL.createObjectURL(blob) : canvas.toDataURL('image/webp', 0.92);
}
