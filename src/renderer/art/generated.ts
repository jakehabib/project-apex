/**
 * AI-generated presentation art produced by `npm run art:make`: base player
 * portraits (chroma-key top, transparent background), team crests and map key
 * art. Files are discovered at build time; missing ones fall back to
 * placeholders. Nothing here affects the simulation.
 */
import mapSpec from '../../shared/art/maps.json';
import world from '../../shared/art/world.json';
import type { Kit } from './jersey';

const glob = {
  portraits: import.meta.glob<string>('../assets/generated/portraits/*.webp', { eager: true, query: '?url', import: 'default' }),
  logos: import.meta.glob<string>('../assets/generated/logos/*.webp', { eager: true, query: '?url', import: 'default' }),
  maps: import.meta.glob<string>('../assets/generated/maps/*.webp', { eager: true, query: '?url', import: 'default' }),
  textures: import.meta.glob<string>('../assets/generated/textures/*.webp', { eager: true, query: '?url', import: 'default' }),
  sprites: import.meta.glob<string>('../assets/generated/sprites/*.webp', { eager: true, query: '?url', import: 'default' }),
  icons: import.meta.glob<string>('../assets/generated/icons/*.webp', { eager: true, query: '?url', import: 'default' }),
};

const byId = (files: Record<string, string>) =>
  new Map(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.webp'.length), url]));

const urls = {
  portraits: byId(glob.portraits), logos: byId(glob.logos), maps: byId(glob.maps),
  textures: byId(glob.textures), sprites: byId(glob.sprites), icons: byId(glob.icons),
};

export const portraitUrl = (personId: string): string | null => urls.portraits.get(personId) ?? null;
export const crestUrl = (teamId: string): string | null => urls.logos.get(teamId) ?? null;
export const mapKeyArtUrl = (mapId: string): string | null => urls.maps.get(mapId) ?? null;
/** Seamless top-down material textures (viewer map renderer). */
export const textureUrl = (id: string): string | null => urls.textures.get(id) ?? null;
/** Top-down sprites: operators and map props. */
export const spriteUrl = (id: string): string | null => urls.sprites.get(id) ?? null;
/** HUD icons: weapons and equipment. */
export const iconUrl = (id: string): string | null => urls.icons.get(id) ?? null;

const imageCache = new Map<string, Promise<HTMLImageElement | null>>();
/** Loads an image once; resolves null when the asset is missing or fails (callers fall back to procedural art). */
export function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  let p = imageCache.get(url);
  if (!p) {
    p = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });
    imageCache.set(url, p);
  }
  return p;
}

export interface ArtTeam {
  readonly id: string;
  readonly name: string;
  readonly tag: string;
  readonly region: string;
  readonly kit: Kit;
}
export interface ArtPerson {
  readonly id: string;
  readonly team: string;
  readonly name: string;
  readonly nickname?: string;
  readonly nationality: string;
  readonly age: number;
  readonly role?: string;
}

export const ART_TEAMS = world.teams as unknown as readonly ArtTeam[];
export const ART_PLAYERS = world.players as readonly ArtPerson[];
export const ART_COACHES = world.coaches as readonly ArtPerson[];
export const MAP_ART_SPECS = mapSpec.items;
export const teamById = (id: string): ArtTeam | undefined => ART_TEAMS.find((t) => t.id === id);

const trimCache = new Map<string, Promise<HTMLCanvasElement | null>>();
/**
 * Loads a transparent sprite and crops it to its visible (alpha) bounds, so it can be fitted to an
 * exact footprint. Resolves null when missing.
 */
export function loadTrimmed(url: string | null): Promise<HTMLCanvasElement | null> {
  if (!url) return Promise.resolve(null);
  let p = trimCache.get(url);
  if (!p) {
    p = loadImage(url).then((img) => {
      if (!img) return null;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d', { willReadFrequently: true })!;
      g.drawImage(img, 0, 0);
      const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
      let x0 = width, y0 = height, x1 = -1, y1 = -1;
      for (let y = 0; y < height; y += 2)
        for (let x = 0; x < width; x += 2)
          if (data[(y * width + x) * 4 + 3]! > 24) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      if (x1 < 0) return null;
      const out = document.createElement('canvas');
      out.width = x1 - x0 + 2;
      out.height = y1 - y0 + 2;
      out.getContext('2d')!.drawImage(c, x0, y0, out.width, out.height, 0, 0, out.width, out.height);
      return out;
    });
    trimCache.set(url, p);
  }
  return p;
}
