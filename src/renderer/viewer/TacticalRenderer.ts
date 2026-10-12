/**
 * Event-driven 2D tactical renderer.
 *
 * It owns no simulation state: given the authoritative event log it reconstructs
 * positions for any playback time via core/replay. Playback speed, pausing and
 * seeking only change which instant is drawn.
 */
import 'pixi.js/unsafe-eval';
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { MatchEvent, Side } from '../../core/match/events';
import { buildGrid, castRay, type MapGrid } from '../../core/match/maps/grid';
import type { MapDefinition, Polygon, Vec2 } from '../../core/match/maps/types';
import { buildTracks, headingAt, positionAt, type Track } from '../../core/match/replay/positions';
import type { Playback } from './Playback';

const TEAM_COLOR: Record<Side, number> = { attacker: 0xff7a45, defender: 0x4aa8ff };
const UNIT_R = 15;
const CONE_R = 150;
const CONE_HALF = Math.PI / 5;
const CONE_RAYS = 28;

export interface ViewerUnit {
  readonly id: string;
  readonly name: string;
  readonly side: Side;
}

interface UnitSprite {
  readonly unit: ViewerUnit;
  readonly track: Track;
  readonly root: Container;
  readonly cone: Graphics;
  readonly ring: Graphics;
  readonly label: Text;
  lastHeading: Vec2;
}

const flat = (poly: Polygon): number[] => poly.flatMap((p) => [p.x, p.y]);

function centroid(poly: Polygon): Vec2 {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}

export class TacticalRenderer {
  readonly app = new Application();
  private readonly world = new Container();
  private readonly fx = new Graphics();
  private readonly units = new Map<string, UnitSprite>();
  private spots: Extract<MatchEvent, { type: 'spotted' }>[] = [];
  private shots: Extract<MatchEvent, { type: 'damage' }>[] = [];
  private host: HTMLElement | null = null;
  private readonly grid: MapGrid;
  private destroyed = false;
  selectedId: string | null = null;
  onFrame: ((fps: number) => void) | null = null;

  constructor(
    private readonly map: MapDefinition,
    private readonly playback: Playback,
  ) {
    this.grid = buildGrid(map);
  }

  async init(host: HTMLElement): Promise<void> {
    this.host = host;
    await this.app.init({
      background: this.map.theme.void,
      antialias: true,
      resizeTo: host,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      preference: 'webgl',
    });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    this.app.canvas.setAttribute('aria-label', `${this.map.name} tactical view`);
    host.appendChild(this.app.canvas);
    this.world.sortableChildren = true;
    this.app.stage.addChild(this.world);
    const mapLayer = this.drawMap();
    this.world.addChild(mapLayer);
    this.world.addChild(this.fx);
    this.app.renderer.on('resize', () => this.fit());
    this.fit();
    this.app.ticker.add((ticker) => {
      this.playback.advance(ticker.deltaMS);
      this.renderAt(this.playback.t);
      this.onFrame?.(ticker.FPS);
    });
  }

  /** Loads one round of the authoritative event log. */
  load(events: readonly MatchEvent[], roundIndex: number, names: ReadonlyMap<string, string>): void {
    for (const s of this.units.values()) {
      s.root.destroy({ children: true });
      s.cone.destroy();
    }
    this.units.clear();
    const tracks = buildTracks(events, roundIndex);
    const inRound = events.filter((e) => e.roundIndex === roundIndex);
    this.spots = inRound.filter((e): e is Extract<MatchEvent, { type: 'spotted' }> => e.type === 'spotted');
    this.shots = inRound.filter((e): e is Extract<MatchEvent, { type: 'damage' }> => e.type === 'damage' && !['frag', 'cinder', 'ember'].includes(e.weaponId));
    for (const [id, track] of tracks) {
      this.units.set(id, this.createUnit({ id, name: names.get(id) ?? id, side: track.side }, track));
    }
    this.renderAt(this.playback.t);
  }

  /** Active rendering backend: 'webgl', 'webgpu' or 'canvas' (software fallback). */
  get backend(): string {
    return this.app.renderer?.name ?? 'starting';
  }

  destroy(): void {
    this.destroyed = true;
    if (this.app.renderer) this.app.destroy(true, { children: true });
  }

  private fit(): void {
    if (!this.host) return;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    const pad = 24;
    const scale = Math.min((w - pad * 2) / this.map.width, (h - pad * 2) / this.map.height);
    this.world.scale.set(scale);
    this.world.position.set((w - this.map.width * scale) / 2, (h - this.map.height * scale) / 2);
  }

  private drawMap(): Container {
    const { theme } = this.map;
    const layer = new Container();
    const g = new Graphics();

    // Outer wall mass, then wall face, then floor: union outlines appear only at real boundaries.
    for (const a of this.map.areas) g.poly(flat(a.polygon)).stroke({ width: 26, color: 0x0c1218, join: 'miter' });
    for (const a of this.map.areas) g.poly(flat(a.polygon)).stroke({ width: 12, color: theme.wall, join: 'miter' });
    for (const a of this.map.areas) {
      const color = a.zone === 'mid' || a.zone === 'connector' ? theme.floorAlt : theme.floor;
      g.poly(flat(a.polygon)).fill({ color });
    }
    // Floor detail grid, very subtle.
    for (let x = 0; x <= this.map.width; x += 40) g.moveTo(x, 0).lineTo(x, this.map.height);
    for (let y = 0; y <= this.map.height; y += 40) g.moveTo(0, y).lineTo(this.map.width, y);
    g.stroke({ width: 1, color: 0x000000, alpha: 0.12 });
    // Re-cover the void so the grid only shows on floors.
    layer.addChild(g);

    const zones = new Graphics();
    for (const a of this.map.areas) {
      if (a.site) zones.poly(flat(a.polygon)).fill({ color: theme.siteTint, alpha: 0.07 });
      if (a.zone === 'attacker_spawn') zones.poly(flat(a.polygon)).fill({ color: TEAM_COLOR.attacker, alpha: 0.06 });
      if (a.zone === 'defender_spawn') zones.poly(flat(a.polygon)).fill({ color: TEAM_COLOR.defender, alpha: 0.06 });
    }
    layer.addChild(zones);

    const ob = new Graphics();
    for (const o of this.map.obstacles) {
      const pts = flat(o.polygon);
      if (o.kind === 'high') {
        ob.poly(pts.map((v, i) => v + (i % 2 === 0 ? 7 : 9))).fill({ color: 0x000000, alpha: 0.35 });
        ob.poly(pts).fill({ color: theme.obstacleHigh }).stroke({ width: 2, color: 0x7d93a6, alpha: 0.6 });
      } else {
        ob.poly(pts).fill({ color: theme.obstacleLow }).stroke({ width: 2, color: 0x5b6e80, alpha: 0.5 });
        const c = centroid(o.polygon);
        ob.moveTo(c.x - 8, c.y - 8).lineTo(c.x + 8, c.y + 8).moveTo(c.x + 8, c.y - 8).lineTo(c.x - 8, c.y + 8).stroke({ width: 2, color: 0x6c8195, alpha: 0.5 });
      }
    }
    layer.addChild(ob);

    for (const a of this.map.areas) {
      const c = centroid(a.polygon);
      const t = new Text({
        text: a.callout.toUpperCase(),
        style: { fontFamily: 'Barlow Condensed', fontWeight: '600', fontSize: 17, letterSpacing: 2, fill: 0x9fb2c4 },
        resolution: 3,
      });
      t.alpha = 0.42;
      t.anchor.set(0.5);
      t.position.set(c.x, a.site ? c.y + 90 : c.y);
      layer.addChild(t);
    }
    for (const s of ['A', 'B'] as const) {
      const t = new Text({
        text: s,
        style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 96, fill: theme.siteTint },
        resolution: 3,
      });
      t.alpha = 0.85;
      t.anchor.set(0.5);
      t.position.set(this.map.sites[s].label.x, this.map.sites[s].label.y);
      layer.addChild(t);
    }
    return layer;
  }

  private createUnit(unit: ViewerUnit, track: Track): UnitSprite {
    const root = new Container();
    const cone = new Graphics();
    const ring = new Graphics();
    const color = TEAM_COLOR[unit.side];
    const body = new Graphics()
      .circle(0, 0, UNIT_R + 3)
      .fill({ color: 0x06090d, alpha: 0.85 })
      .circle(0, 0, UNIT_R)
      .fill({ color })
      .circle(0, 0, UNIT_R - 5)
      .fill({ color: 0x0b1117 });
    const initial = new Text({
      text: unit.name.charAt(0),
      style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 16, fill: color },
      resolution: 4,
    });
    initial.anchor.set(0.5);
    const label = new Text({
      text: unit.name.toUpperCase(),
      style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 15, letterSpacing: 1, fill: 0xeef3f7 },
      resolution: 4,
    });
    label.anchor.set(0.5, 0);
    label.position.set(0, UNIT_R + 5);
    this.world.addChild(cone);
    root.addChild(ring, body, initial, label);
    this.world.addChild(root);
    return { unit, track, root, cone, ring, label, lastHeading: { x: unit.side === 'attacker' ? 0 : 0, y: unit.side === 'attacker' ? -1 : 1 } };
  }

  renderAt(t: number): void {
    for (const s of this.units.values()) {
      const p = positionAt(s.track, t);
      s.root.position.set(p.x, p.y);
      const dead = s.track.diedAt !== null && t >= s.track.diedAt;
      s.root.alpha = dead ? 0.28 : 1;
      if (dead) {
        s.cone.clear();
        s.ring.clear().moveTo(-8, -8).lineTo(8, 8).moveTo(8, -8).lineTo(-8, 8).stroke({ width: 3, color: 0xff5a5f });
        continue;
      }
      const h = headingAt(s.track, t);
      if (h) s.lastHeading = h;
      const ang = Math.atan2(s.lastHeading.y, s.lastHeading.x);
      const color = TEAM_COLOR[s.unit.side];
      // Vision cone clipped by the authoritative sight grid: never drawn through walls.
      s.cone.clear().moveTo(p.x, p.y);
      for (let i = 0; i <= CONE_RAYS; i++) {
        const a = ang - CONE_HALF + (2 * CONE_HALF * i) / CONE_RAYS;
        const d = castRay(this.grid, p, a, CONE_R);
        s.cone.lineTo(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d);
      }
      s.cone.closePath().fill({ color, alpha: 0.1 });
      const selected = this.selectedId === s.unit.id;
      s.ring.clear();
      s.root.alpha = 1;
      if (selected) s.ring.circle(0, 0, UNIT_R + 9).stroke({ width: 3, color: 0x3ee6c4 });
      s.root.zIndex = selected ? 2 : 1;
    }

    this.fx.clear();
    // Shot tracers straight from damage events.
    for (const e of this.shots) {
      if (e.tMs > t) break;
      const age = t - e.tMs;
      if (age > 160) continue;
      const shooter = this.units.get(e.attackerId);
      const color = shooter ? TEAM_COLOR[shooter.unit.side] : 0xffffff;
      this.fx.moveTo(e.attackerPos.x, e.attackerPos.y).lineTo(e.victimPos.x, e.victimPos.y).stroke({ width: 2, color: 0xfff1c1, alpha: 0.9 * (1 - age / 160) });
      this.fx.circle(e.attackerPos.x, e.attackerPos.y, 7).fill({ color, alpha: 0.8 * (1 - age / 160) });
    }
    for (const e of this.spots) {
      if (e.tMs > t) break;
      const age = t - e.tMs;
      if (age > 1400) continue;
      const obs = this.units.get(e.observerId);
      if (!obs) continue;
      const color = TEAM_COLOR[obs.unit.side];
      if (age < 700) {
        const k = 1 - age / 700;
        this.fx.moveTo(e.observerPos.x, e.observerPos.y).lineTo(e.targetPos.x, e.targetPos.y).stroke({ width: 2.5, color, alpha: 0.65 * k });
      }
      const k2 = age / 1400;
      this.fx.circle(e.targetPos.x, e.targetPos.y, 18 + 40 * k2).stroke({ width: 3, color, alpha: 0.7 * (1 - k2) });
    }
  }
}
