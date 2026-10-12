/**
 * Procedural material textures (Canvas 2D). Presentation only: uses its own
 * seeded stream, never the simulation RNG.
 */
import { Rng } from '../../../core/rng/prng';
import type { Material } from '../../../core/match/maps/tilemap';

export interface Palette {
  readonly concrete: string;
  readonly asphalt: string;
  readonly wood: string;
  readonly metal: string;
  readonly gravel: string;
  readonly grass: string;
  readonly tile: string;
  readonly water: string;
  readonly waterDeep: string;
  readonly roofs: readonly string[];
  readonly containers: readonly string[];
  readonly lamp: string;
}

export const PALETTES: Record<string, Palette> = {
  harbor: {
    concrete: '#5f6a72', asphalt: '#3b4249', wood: '#7a5a3a', metal: '#56636e', gravel: '#6d6556', grass: '#4d5f3e', tile: '#7d7b74',
    water: '#1f4f6b', waterDeep: '#123447', roofs: ['#2c3238', '#3a3f45', '#4a3d34', '#2f3a40', '#3d4a52'],
    containers: ['#a8432f', '#2f6f8f', '#c9862d', '#3f7a4a', '#7d3a6a', '#b0b4b8'], lamp: 'rgba(255, 196, 120, 0.22)',
  },
  switchyard: {
    concrete: '#6e6a62', asphalt: '#403d39', wood: '#6b4d32', metal: '#5c6168', gravel: '#77705f', grass: '#55613f', tile: '#857f72',
    water: '#26475a', waterDeep: '#15303f', roofs: ['#3a3430', '#4b4038', '#2f2c2a', '#5a4a3c', '#363b40'],
    containers: ['#8f3b2b', '#3d5f7a', '#b5762a', '#4c6b3f', '#5b4a7a', '#9a9a92'], lamp: 'rgba(255, 186, 110, 0.22)',
  },
};

export const paletteFor = (mapId: string): Palette => PALETTES[mapId] ?? PALETTES.harbor!;

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

function speckle(ctx: CanvasRenderingContext2D, rng: Rng, w: number, h: number, count: number, base: string, spread: number, size: number) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = shade(base, Math.round(rng.range(-spread, spread)));
    const s = rng.range(size * 0.4, size);
    ctx.fillRect(rng.range(0, w), rng.range(0, h), s, s);
  }
}

/** A 128×128 seamless-ish pattern tile for a floor material. */
export function materialTile(material: Material, p: Palette, seed: string): HTMLCanvasElement {
  const S = 128;
  const [c, ctx] = canvas(S, S);
  const rng = Rng.fromSeed(`art:${seed}:${material}`);
  switch (material) {
    case 'concrete':
    case 'site':
    case 'tspawn':
    case 'ctspawn': {
      ctx.fillStyle = p.concrete;
      ctx.fillRect(0, 0, S, S);
      speckle(ctx, rng, S, S, 900, p.concrete, 14, 2.2);
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0.5, 0.5, S - 1, S - 1); // slab seams
      for (let i = 0; i < 2; i++) {
        ctx.beginPath();
        let x = rng.range(0, S);
        let y = rng.range(0, S);
        ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += rng.range(-14, 14);
          y += rng.range(-14, 14);
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.22)';
        ctx.stroke();
      }
      break;
    }
    case 'asphalt': {
      ctx.fillStyle = p.asphalt;
      ctx.fillRect(0, 0, S, S);
      speckle(ctx, rng, S, S, 1600, p.asphalt, 12, 1.6);
      break;
    }
    case 'wood': {
      ctx.fillStyle = p.wood;
      ctx.fillRect(0, 0, S, S);
      const plank = 16;
      for (let y = 0; y < S; y += plank) {
        ctx.fillStyle = shade(p.wood, Math.round(rng.range(-14, 10)));
        ctx.fillRect(0, y, S, plank - 1);
        for (let g = 0; g < 7; g++) {
          ctx.strokeStyle = `rgba(40,25,10,${rng.range(0.08, 0.2).toFixed(2)})`;
          ctx.beginPath();
          const gy = y + rng.range(2, plank - 3);
          ctx.moveTo(0, gy);
          ctx.bezierCurveTo(S * 0.3, gy + rng.range(-2, 2), S * 0.6, gy + rng.range(-2, 2), S, gy);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(20,12,4,0.55)';
        ctx.fillRect(0, y + plank - 1, S, 1);
        const seam = rng.range(10, S - 10);
        ctx.fillRect(seam, y, 1, plank - 1);
        ctx.fillStyle = 'rgba(30,30,30,0.6)';
        ctx.fillRect(seam - 4, y + 4, 2, 2); // nail heads
        ctx.fillRect(seam + 3, y + plank - 7, 2, 2);
      }
      break;
    }
    case 'metal': {
      ctx.fillStyle = shade(p.metal, -10);
      ctx.fillRect(0, 0, S, S);
      ctx.strokeStyle = shade(p.metal, 25);
      ctx.lineWidth = 2;
      for (let i = 0; i <= S; i += 8) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, S);
        ctx.stroke();
      }
      ctx.strokeStyle = shade(p.metal, 5);
      ctx.lineWidth = 1;
      for (let i = 0; i <= S; i += 4) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(S, i);
        ctx.stroke();
      }
      break;
    }
    case 'gravel': {
      ctx.fillStyle = p.gravel;
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 1100; i++) {
        ctx.fillStyle = shade(p.gravel, Math.round(rng.range(-30, 24)));
        ctx.beginPath();
        ctx.arc(rng.range(0, S), rng.range(0, S), rng.range(0.6, 2.2), 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'grass': {
      ctx.fillStyle = p.grass;
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 900; i++) {
        ctx.strokeStyle = shade(p.grass, Math.round(rng.range(-20, 25)));
        const x = rng.range(0, S);
        const y = rng.range(0, S);
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + rng.range(-2, 2), y - rng.range(2, 5));
        ctx.stroke();
      }
      break;
    }
    case 'tile': {
      const t = 16;
      for (let y = 0; y < S; y += t)
        for (let x = 0; x < S; x += t) {
          ctx.fillStyle = shade(p.tile, ((x + y) / t) % 2 === 0 ? 6 : -6) ;
          ctx.fillRect(x, y, t, t);
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x, y + t - 1, t, 1);
          ctx.fillRect(x + t - 1, y, 1, t);
        }
      speckle(ctx, rng, S, S, 200, p.tile, 12, 1.5);
      break;
    }
    case 'stairs': {
      ctx.fillStyle = shade(p.concrete, 8);
      ctx.fillRect(0, 0, S, S);
      for (let y = 0; y < S; y += 10) {
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillRect(0, y + 8, S, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(0, y, S, 1);
      }
      break;
    }
    case 'rails': {
      ctx.fillStyle = p.gravel;
      ctx.fillRect(0, 0, S, S);
      speckle(ctx, rng, S, S, 700, p.gravel, 26, 2);
      for (let y = 4; y < S; y += 16) {
        ctx.fillStyle = shade(p.wood, -18);
        ctx.fillRect(0, y, S, 7); // sleepers
      }
      break;
    }
    default: {
      ctx.fillStyle = p.concrete;
      ctx.fillRect(0, 0, S, S);
    }
  }
  return c;
}

export function waterTile(p: Palette, seed: string): HTMLCanvasElement {
  const S = 128;
  const [c, ctx] = canvas(S, S);
  const rng = Rng.fromSeed(`art:${seed}:water`);
  const g = ctx.createLinearGradient(0, 0, S, S);
  g.addColorStop(0, p.water);
  g.addColorStop(1, p.waterDeep);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  ctx.strokeStyle = 'rgba(180, 220, 240, 0.12)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 26; i++) {
    const x = rng.range(0, S);
    const y = rng.range(0, S);
    const w = rng.range(8, 22);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + w / 2, y - 3, x + w, y);
    ctx.stroke();
  }
  return c;
}

/** Soft radial sprite used for smokes, fire, lamps and glows. */
export function radialSprite(size: number, inner: string, outer: string): HTMLCanvasElement {
  const [c, ctx] = canvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export { shade };
