/**
 * Map definitions are pure data. Geometry is authored as polygons in map units
 * (1 unit = 0.1 m). At load time the polygons are rasterized into a cell grid
 * (see grid.ts) which is the single authority for walkability and sight.
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export type Polygon = readonly Vec2[];

export type ZoneKind = 'attacker_spawn' | 'defender_spawn' | 'site' | 'mid' | 'route' | 'connector';

export interface MapArea {
  readonly id: string;
  /** Human callout shown in the viewer and in tactical notes. */
  readonly callout: string;
  readonly zone: ZoneKind;
  readonly polygon: Polygon;
  /** Optional site this area belongs to (bomb can be planted only inside site areas). */
  readonly site?: SiteId;
}

/** Obstacles inside walkable space. `high` blocks movement and sight; `low` blocks movement only and gives cover. */
export interface MapObstacle {
  readonly id: string;
  readonly kind: 'high' | 'low';
  readonly polygon: Polygon;
}

export type SiteId = 'A' | 'B';

export type NavNodeTag =
  | 'attacker_spawn'
  | 'defender_spawn'
  | 'plant'
  | 'hold'
  | 'choke'
  | 'mid'
  | 'lurk'
  | 'retake';

export interface NavNode {
  readonly id: string;
  readonly pos: Vec2;
  readonly callout: string;
  readonly tags: readonly NavNodeTag[];
  readonly site?: SiteId;
}

export interface NavEdge {
  readonly a: string;
  readonly b: string;
}

export interface MapDefinition {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly width: number;
  readonly height: number;
  /** Grid cell size in map units used for rasterization. */
  readonly cellSize: number;
  readonly theme: MapTheme;
  readonly areas: readonly MapArea[];
  readonly obstacles: readonly MapObstacle[];
  readonly nodes: readonly NavNode[];
  readonly edges: readonly NavEdge[];
  readonly sites: Readonly<Record<SiteId, { readonly label: Vec2 }>>;
  readonly strategy: MapStrategy;
}

export interface MapTheme {
  readonly void: number;
  readonly floor: number;
  readonly floorAlt: number;
  readonly wall: number;
  readonly obstacleHigh: number;
  readonly obstacleLow: number;
  readonly siteTint: number;
  readonly accent: number;
}

export const rect = (x: number, y: number, w: number, h: number): Polygon => [
  { x, y },
  { x: x + w, y },
  { x: x + w, y: y + h },
  { x, y: y + h },
];

export const dist = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);

/** An attacking approach into a site: gather at `stage`, push through `entry`, then clear `clear`. */
export interface SiteRoute {
  readonly id: string;
  readonly name: string;
  readonly stage: string;
  readonly entry: string;
  readonly clear: readonly string[];
}

export interface UtilityLineup {
  readonly route: string;
  readonly target: Vec2;
}

export interface SiteStrategy {
  readonly routes: readonly SiteRoute[];
  /** Attacker positions after the plant, in order of preference. */
  readonly postPlant: readonly string[];
  /** Defender anchor positions on this site, in order of preference. */
  readonly ctAnchors: readonly string[];
  /** Where defenders regroup before retaking this site. */
  readonly retakeStage: readonly string[];
  /** Attacker execute utility. */
  readonly execSmokes: readonly UtilityLineup[];
  readonly execFlashes: readonly UtilityLineup[];
  /** Defender delay utility (fire/frag) thrown at attacker entries. */
  readonly ctDelay: readonly UtilityLineup[];
}

/** Tactical knowledge authored per map; used by both teams' AI through the same rules. */
export interface MapStrategy {
  readonly sites: Readonly<Record<SiteId, SiteStrategy>>;
  /** Defender mid positions. */
  readonly midHolds: readonly string[];
  /** Attacker map-control positions for default plays. */
  readonly tControl: readonly string[];
  readonly lurks: readonly string[];
  /** Forward positions aggressive defenders take early for information. */
  readonly ctInfo: readonly string[];
}
