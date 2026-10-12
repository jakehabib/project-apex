/**
 * AI-generated presentation art (portraits, map key art) produced by
 * `npm run art:make`. Files are discovered at build time, so a missing image
 * simply falls back to a placeholder; nothing here affects the simulation.
 */
import mapSpec from '../../shared/art/maps.json';
import portraitSpec from '../../shared/art/portraits.json';

const portraits = import.meta.glob<string>('../assets/generated/portraits/*.webp', { eager: true, query: '?url', import: 'default' });
const maps = import.meta.glob<string>('../assets/generated/maps/*.webp', { eager: true, query: '?url', import: 'default' });

const byId = (files: Record<string, string>) =>
  new Map(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.webp'.length), url]));

const portraitUrls = byId(portraits);
const mapUrls = byId(maps);

export const portraitUrl = (playerId: string): string | null => portraitUrls.get(playerId) ?? null;
export const mapKeyArtUrl = (mapId: string): string | null => mapUrls.get(mapId) ?? null;

export const PORTRAIT_SPECS = portraitSpec.items;
export const MAP_ART_SPECS = mapSpec.items;
