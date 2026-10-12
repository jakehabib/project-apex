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
};

const byId = (files: Record<string, string>) =>
  new Map(Object.entries(files).map(([path, url]) => [path.slice(path.lastIndexOf('/') + 1, -'.webp'.length), url]));

const urls = { portraits: byId(glob.portraits), logos: byId(glob.logos), maps: byId(glob.maps) };

export const portraitUrl = (personId: string): string | null => urls.portraits.get(personId) ?? null;
export const crestUrl = (teamId: string): string | null => urls.logos.get(teamId) ?? null;
export const mapKeyArtUrl = (mapId: string): string | null => urls.maps.get(mapId) ?? null;

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
