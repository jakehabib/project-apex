/**
 * Event-driven 2D tactical renderer.
 *
 * It owns no simulation state: given the authoritative event log it reconstructs
 * positions, utility, bomb and combat visuals for any playback time. Playback
 * speed, pausing and seeking only change which instant is drawn.
 */
import 'pixi.js/unsafe-eval';
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { EventOf, MatchEvent, Side } from '../../core/match/events';
import { castRay, buildGrid, type MapGrid } from '../../core/match/maps/grid';
import type { MapDefinition, Vec2 } from '../../core/match/maps/types';
import { buildTracks, headingAt, positionAt, type Track } from '../../core/match/replay/positions';
import { MR12_STANDARD } from '../../core/match/rules/ruleset';
import { weaponById } from '../../core/match/rules/arsenal';
import { renderMapArt } from './art/mapArt';
import { radialSprite } from './art/textures';
import type { Playback } from './Playback';

const TEAM_COLOR: Record<Side, number> = { attacker: 0xff7a45, defender: 0x4aa8ff };
const UNIT_R = 13;
const CONE_R = 170;
const CONE_HALF = Math.PI / 5;
const CONE_RAYS = 24;

export interface ViewerUnit {
  readonly id: string;
  readonly name: string;
  readonly side: Side;
}

interface UnitSprite {
  readonly unit: ViewerUnit;
  readonly track: Track;
  readonly root: Container;
  readonly body: Graphics;
  readonly ring: Graphics;
  readonly plate: Container;
  readonly label: Text;
  readonly weapon: Text;
  lastHeading: Vec2;
  hp: { t: number; hp: number }[];
  weapons: { t: number; id: string }[];
}

interface RoundData {
  shots: EventOf<'damage'>[];
  kills: EventOf<'kill'>[];
  utility: EventOf<'utility'>[];
  flashes: EventOf<'flashed'>[];
  plant: EventOf<'plant'> | null;
  defuse: EventOf<'defuse'> | null;
  detonate: EventOf<'detonate'> | null;
  bombEvents: MatchEvent[];
  carrierAtStart: string | null;
}

interface UtilMeta {
  readonly ev: EventOf<'utility'>;
  readonly i: number;
}

const utilWeapon = (id: string) => id === 'frag' || id === 'cinder' || id === 'ember';
const weaponLabel = (id: string) => {
  try {
    return weaponById(id).name;
  } catch {
    return id;
  }
};

export class TacticalRenderer {
  readonly app = new Application();
  private readonly camera = new Container();
  private readonly world = new Container();
  private readonly decals = new Graphics();
  private readonly utilLayer = new Container();
  private readonly fx = new Graphics();
  private readonly overlay = new Graphics();
  private readonly units = new Map<string, UnitSprite>();
  private readonly grid: MapGrid;
  private data: RoundData | null = null;
  private host: HTMLElement | null = null;
  private destroyed = false;
  private smokeTex: Texture | null = null;
  private fireTex: Texture | null = null;
  private utilSprites: { sprite: Sprite; meta: UtilMeta }[] = [];
  private zoom = 1;
  private pan = { x: 0, y: 0 };
  private baseScale = 1;
  private drag: { x: number; y: number; px: number; py: number } | null = null;
  selectedId: string | null = null;
  follow = false;
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
      background: 0x070a0e,
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
    this.smokeTex = Texture.from(radialSprite(128, 'rgba(200,206,212,0.95)', 'rgba(170,178,186,0)'));
    this.fireTex = Texture.from(radialSprite(96, 'rgba(255,200,90,0.95)', 'rgba(255,80,20,0)'));
    this.app.stage.addChild(this.camera);
    this.camera.addChild(this.world);
    this.world.sortableChildren = true;
    this.world.addChild(this.drawTileMap());
    this.decals.zIndex = 1;
    this.overlay.zIndex = 2;
    this.utilLayer.zIndex = 15;
    this.fx.zIndex = 16;
    this.world.addChild(this.decals, this.overlay, this.utilLayer, this.fx);
    this.app.renderer.on('resize', () => this.fit());
    this.bindCamera();
    this.fit();
    this.app.ticker.add((ticker) => {
      this.playback.advance(ticker.deltaMS);
      this.renderAt(this.playback.t);
      this.onFrame?.(ticker.FPS);
    });
  }

  /** Loads one round of the authoritative event log. */
  load(events: readonly MatchEvent[], roundIndex: number, names: ReadonlyMap<string, string>): void {
    for (const s of this.units.values()) s.root.destroy({ children: true });
    this.units.clear();
    for (const u of this.utilSprites) u.sprite.destroy();
    this.utilSprites = [];
    this.decals.clear();
    const inRound = events.filter((e) => e.roundIndex === roundIndex);
    const of = <T extends MatchEvent['type']>(type: T) => inRound.filter((e): e is EventOf<T> => e.type === type);
    const loadout = of('loadout')[0];
    const allDamage = of('damage');
    this.data = {
      shots: allDamage.filter((e) => !utilWeapon(e.weaponId)),
      kills: of('kill'),
      utility: of('utility'),
      flashes: of('flashed'),
      plant: of('plant')[0] ?? null,
      defuse: of('defuse')[0] ?? null,
      detonate: of('detonate')[0] ?? null,
      bombEvents: inRound.filter((e) => e.type === 'bomb_drop' || e.type === 'bomb_pickup' || e.type === 'plant'),
      carrierAtStart: loadout?.loadouts.find((l) => l.bomb)?.playerId ?? null,
    };
    const tracks = buildTracks(events, roundIndex);
    for (const [id, track] of tracks) {
      const u = this.createUnit({ id, name: names.get(id) ?? id, side: track.side }, track);
      const l = loadout?.loadouts.find((x) => x.playerId === id);
      u.weapons = [{ t: -Infinity, id: l?.primary ?? l?.secondary ?? '' }];
      u.hp = [{ t: -Infinity, hp: 100 }, ...allDamage.filter((dd) => dd.victimId === id).map((dd) => ({ t: dd.tMs, hp: dd.hpAfter }))];
      this.units.set(id, u);
    }
    for (const ev of this.data.utility) {
      if (ev.utility !== 'smoke' && ev.utility !== 'fire') continue;
      const tex = ev.utility === 'smoke' ? this.smokeTex! : this.fireTex!;
      const puffs = ev.utility === 'smoke' ? 7 : 5;
      for (let i = 0; i < puffs; i++) {
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.visible = false;
        this.utilLayer.addChild(sprite);
        this.utilSprites.push({ sprite, meta: { ev, i } });
      }
    }
    this.renderAt(this.playback.t);
  }

  get backend(): string {
    return this.app.renderer?.name ?? 'starting';
  }

  resetCamera(): void {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.follow = false;
    this.fit();
  }

  zoomTo(z: number): void {
    this.zoom = Math.max(1, Math.min(4, z));
    this.applyCamera();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.app.renderer) this.app.destroy(true, { children: true });
  }

  // ------------------------------------------------------------------ camera
  private bindCamera(): void {
    const el = this.app.canvas;
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const before = this.screenToWorld(mx, my);
        this.zoom = Math.max(1, Math.min(4, this.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
        this.applyCamera();
        const after = this.screenToWorld(mx, my);
        const s = this.baseScale * this.zoom;
        this.pan.x += (after.x - before.x) * s;
        this.pan.y += (after.y - before.y) * s;
        this.applyCamera();
      },
      { passive: false },
    );
    el.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, y: e.clientY, px: this.pan.x, py: this.pan.y };
    });
    window.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this.pan.x = this.drag.px + (e.clientX - this.drag.x);
      this.pan.y = this.drag.py + (e.clientY - this.drag.y);
      this.follow = false;
      this.applyCamera();
    });
    window.addEventListener('pointerup', () => (this.drag = null));
    el.addEventListener('dblclick', () => this.resetCamera());
  }

  private screenToWorld(x: number, y: number): Vec2 {
    const s = this.baseScale * this.zoom;
    return { x: (x - this.camera.position.x) / s, y: (y - this.camera.position.y) / s };
  }

  private fit(): void {
    if (!this.host || !this.app.renderer) return;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    const pad = 12;
    this.baseScale = Math.min((w - pad * 2) / this.map.width, (h - pad * 2) / this.map.height);
    this.applyCamera();
  }

  private applyCamera(): void {
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    const s = this.baseScale * this.zoom;
    this.camera.scale.set(s);
    this.camera.position.set((w - this.map.width * s) / 2 + this.pan.x, (h - this.map.height * s) / 2 + this.pan.y);
  }

  // ------------------------------------------------------------------ static map
  private drawTileMap(): Container {
    const layer = new Container();
    const art = renderMapArt(this.map, 2);
    const sprite = new Sprite(Texture.from(art));
    sprite.width = this.map.width;
    sprite.height = this.map.height;
    layer.addChild(sprite);
    const seen = new Set<string>();
    for (const a of this.map.areas) {
      if (seen.has(a.callout) || a.site) continue;
      seen.add(a.callout);
      const xs = a.polygon.map((p) => p.x);
      const ys = a.polygon.map((p) => p.y);
      const t = new Text({
        text: a.callout.toUpperCase(),
        style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 14, letterSpacing: 2, fill: 0xe8eef3 },
        resolution: 3,
      });
      t.alpha = 0.4;
      t.anchor.set(0.5);
      t.position.set((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
      layer.addChild(t);
    }
    return layer;
  }

  // ------------------------------------------------------------------ units
  private createUnit(unit: ViewerUnit, track: Track): UnitSprite {
    const root = new Container();
    root.zIndex = 10;
    const color = TEAM_COLOR[unit.side];
    const ring = new Graphics();
    const body = new Graphics();
    const shadow = new Graphics().circle(3, 4, UNIT_R + 2).fill({ color: 0x000000, alpha: 0.45 });
    const initial = new Text({ text: unit.name.charAt(0), style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 14, fill: color }, resolution: 4 });
    initial.anchor.set(0.5);
    const plate = new Container();
    const label = new Text({ text: unit.name.toUpperCase(), style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 13, letterSpacing: 1, fill: 0xffffff }, resolution: 4 });
    label.anchor.set(0.5, 1);
    const weapon = new Text({ text: '', style: { fontFamily: 'Inter', fontWeight: '600', fontSize: 9, fill: 0xd0d8e0 }, resolution: 4 });
    weapon.anchor.set(0.5, 0);
    const bg = new Graphics();
    plate.addChild(bg, label);
    plate.position.set(0, -UNIT_R - 8);
    weapon.position.set(0, UNIT_R + 6);
    root.addChild(shadow, ring, body, initial, plate, weapon);
    this.world.addChild(root);
    bg.roundRect(-label.width / 2 - 5, -label.height - 2, label.width + 10, label.height + 2, 3).fill({ color: 0x06090d, alpha: 0.75 });
    bg.rect(-label.width / 2 - 5, -2, label.width + 10, 2).fill({ color });
    return { unit, track, root, body, ring, plate, label, weapon, lastHeading: { x: 0, y: unit.side === 'attacker' ? -1 : 1 }, hp: [], weapons: [] };
  }

  private hpAt(s: UnitSprite, t: number): number {
    let hp = 100;
    for (const h of s.hp) if (h.t <= t) hp = h.hp;
    return hp;
  }

  // ------------------------------------------------------------------ frame
  renderAt(t: number): void {
    const d = this.data;
    this.fx.clear();
    this.overlay.clear();
    this.updateUtility(t);
    if (d) {
      for (const u of d.utility) {
        if (t >= u.tMs && t < u.detonateMs) {
          // Grenade in flight along a lobbed arc.
          const k = (t - u.tMs) / (u.detonateMs - u.tMs);
          const x = u.from.x + (u.target.x - u.from.x) * k;
          const y = u.from.y + (u.target.y - u.from.y) * k - Math.sin(k * Math.PI) * 60;
          this.fx.circle(x, y, 4).fill({ color: 0xe8eef3 }).stroke({ width: 1.5, color: 0x000000, alpha: 0.6 });
        }
        const age = t - u.detonateMs;
        if (u.utility === 'flash' && age >= 0 && age < 450) {
          const k = age / 450;
          this.fx.circle(u.target.x, u.target.y, 30 + 160 * k).fill({ color: 0xffffff, alpha: 0.55 * (1 - k) });
        }
        if (u.utility === 'frag' && age >= 0 && age < 600) {
          const k = age / 600;
          this.fx.circle(u.target.x, u.target.y, 20 + 110 * k).fill({ color: 0xffa040, alpha: 0.45 * (1 - k) }).stroke({ width: 3, color: 0xffe0a0, alpha: 0.8 * (1 - k) });
        }
      }
      for (const e of d.shots) {
        if (e.tMs > t) break;
        const age = t - e.tMs;
        if (age > 140) continue;
        const k = 1 - age / 140;
        this.fx.moveTo(e.attackerPos.x, e.attackerPos.y).lineTo(e.victimPos.x, e.victimPos.y).stroke({ width: 2, color: 0xfff1c1, alpha: 0.85 * k });
        this.fx.circle(e.attackerPos.x, e.attackerPos.y, 9 * k + 3).fill({ color: 0xffd27a, alpha: 0.7 * k });
        this.fx.circle(e.victimPos.x, e.victimPos.y, 5).fill({ color: 0xff4040, alpha: 0.6 * k });
      }
      this.decals.clear();
      for (const k of d.kills) {
        if (k.tMs > t) break;
        this.decals.circle(k.victimPos.x, k.victimPos.y, 11).fill({ color: 0x5a0d0d, alpha: 0.55 });
        this.decals.circle(k.victimPos.x + 6, k.victimPos.y - 4, 5).fill({ color: 0x5a0d0d, alpha: 0.45 });
      }
      this.drawBomb(t, d);
    }

    for (const s of this.units.values()) this.drawUnit(s, t, d);

    if (this.follow && this.selectedId && this.zoom > 1) {
      const s = this.units.get(this.selectedId);
      if (s) {
        const w = this.app.renderer.width / this.app.renderer.resolution;
        const h = this.app.renderer.height / this.app.renderer.resolution;
        const sc = this.baseScale * this.zoom;
        this.pan.x = w / 2 - s.root.position.x * sc - (w - this.map.width * sc) / 2;
        this.pan.y = h / 2 - s.root.position.y * sc - (h - this.map.height * sc) / 2;
        this.applyCamera();
      }
    }
  }

  private updateUtility(t: number): void {
    for (const { sprite, meta } of this.utilSprites) {
      const { ev, i } = meta;
      const start = ev.detonateMs;
      const end = ev.detonateMs + ev.durationMs;
      if (t < start || t > end + 1500) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      const age = t - start;
      if (ev.utility === 'smoke') {
        const life = Math.min(1, age / 600) * Math.min(1, (end + 1500 - t) / 1500);
        const ang = (i / 7) * Math.PI * 2 + age * 0.00015;
        const r = i === 0 ? 0 : 34 + Math.sin(age * 0.0007 + i) * 6;
        sprite.position.set(ev.target.x + Math.cos(ang) * r, ev.target.y + Math.sin(ang) * r);
        const size = (i === 0 ? 130 : 96) * (0.6 + 0.4 * Math.min(1, age / 900));
        sprite.width = sprite.height = size;
        sprite.alpha = 0.92 * life;
      } else {
        if (t > end) {
          sprite.visible = false;
          continue;
        }
        const ang = (i / 5) * Math.PI * 2 + age * 0.0006;
        const r = i === 0 ? 0 : 24 + Math.sin(age * 0.004 + i * 2) * 8;
        sprite.position.set(ev.target.x + Math.cos(ang) * r, ev.target.y + Math.sin(ang) * r);
        sprite.width = sprite.height = 58 + Math.sin(age * 0.02 + i) * 14;
        sprite.alpha = (0.65 + Math.sin(age * 0.03 + i * 1.7) * 0.25) * Math.min(1, (end - t) / 600 + 0.2);
      }
    }
  }

  private drawUnit(s: UnitSprite, t: number, d: RoundData | null): void {
    const p = positionAt(s.track, t);
    s.root.position.set(p.x, p.y);
    const dead = s.track.diedAt !== null && t >= s.track.diedAt;
    const color = TEAM_COLOR[s.unit.side];
    s.body.clear();
    s.ring.clear();
    if (dead) {
      s.root.alpha = 0.6;
      s.body.moveTo(-7, -7).lineTo(7, 7).moveTo(7, -7).lineTo(-7, 7).stroke({ width: 3.5, color });
      s.plate.visible = false;
      s.weapon.visible = false;
      return;
    }
    s.root.alpha = 1;
    s.plate.visible = true;
    s.weapon.visible = this.zoom >= 1.6 || this.selectedId === s.unit.id;
    const h = headingAt(s.track, t);
    if (h) s.lastHeading = h;
    if (d) {
      for (let i = d.shots.length - 1; i >= 0; i--) {
        const e = d.shots[i]!;
        if (e.tMs > t || e.attackerId !== s.unit.id) continue;
        if (t - e.tMs < 600) {
          const dx = e.victimPos.x - p.x;
          const dy = e.victimPos.y - p.y;
          const len = Math.hypot(dx, dy) || 1;
          s.lastHeading = { x: dx / len, y: dy / len };
        }
        break;
      }
    }
    const ang = Math.atan2(s.lastHeading.y, s.lastHeading.x);
    this.overlay.moveTo(p.x, p.y);
    for (let i = 0; i <= CONE_RAYS; i++) {
      const a = ang - CONE_HALF + (2 * CONE_HALF * i) / CONE_RAYS;
      const dist = castRay(this.grid, p, a, CONE_R);
      this.overlay.lineTo(p.x + Math.cos(a) * dist, p.y + Math.sin(a) * dist);
    }
    this.overlay.closePath().fill({ color, alpha: this.selectedId === s.unit.id ? 0.18 : 0.08 });
    const hp = this.hpAt(s, t);
    s.body.circle(0, 0, UNIT_R).fill({ color: 0x0b1117 }).stroke({ width: 3, color });
    s.body.moveTo(Math.cos(ang) * (UNIT_R - 2), Math.sin(ang) * (UNIT_R - 2)).lineTo(Math.cos(ang) * (UNIT_R + 9), Math.sin(ang) * (UNIT_R + 9)).stroke({ width: 3, color: 0xe8eef3 });
    s.ring.arc(0, 0, UNIT_R + 4, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * hp) / 100).stroke({ width: 2.5, color: hp > 50 ? 0x4ade80 : hp > 20 ? 0xf5b84a : 0xff5a5f });
    if (this.selectedId === s.unit.id) s.ring.circle(0, 0, UNIT_R + 9).stroke({ width: 2, color: 0x3ee6c4 });
    if (d?.flashes.some((f) => f.playerId === s.unit.id && t >= f.tMs && t < f.tMs + f.durationMs)) s.ring.circle(0, 0, UNIT_R + 1).fill({ color: 0xffffff, alpha: 0.65 });
    const label = weaponLabel(s.weapons[0]?.id ?? '');
    if (s.weapon.text !== label) s.weapon.text = label;
  }

  private drawBomb(t: number, d: RoundData): void {
    let carrier = d.carrierAtStart;
    let dropped: Vec2 | null = null;
    for (const e of d.bombEvents) {
      if (e.tMs > t) break;
      if (e.type === 'bomb_drop') {
        carrier = null;
        dropped = e.pos;
      } else if (e.type === 'bomb_pickup') {
        carrier = e.playerId;
        dropped = null;
      } else if (e.type === 'plant') {
        carrier = null;
        dropped = null;
      }
    }
    const icon = (x: number, y: number, size: number) => {
      this.fx.roundRect(x - size, y - size * 0.7, size * 2, size * 1.4, 2).fill({ color: 0xd23c3c }).stroke({ width: 1.5, color: 0x200000 });
      this.fx.rect(x - size * 0.5, y - size * 0.25, size, size * 0.5).fill({ color: 0x1a1a1a });
    };
    if (carrier) {
      const s = this.units.get(carrier);
      if (s && !(s.track.diedAt !== null && t >= s.track.diedAt)) icon(s.root.position.x + UNIT_R, s.root.position.y + UNIT_R - 2, 5);
    }
    if (dropped) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.006);
      this.fx.circle(dropped.x, dropped.y, 14).stroke({ width: 2, color: 0xff5a5f, alpha: pulse });
      icon(dropped.x, dropped.y, 7);
    }
    if (d.plant && t >= d.plant.tMs) {
      const { x, y } = d.plant.pos;
      if (d.detonate && t >= d.detonate.tMs) {
        const age = t - d.detonate.tMs;
        if (age < 1500) {
          const k = age / 1500;
          this.fx.circle(x, y, 60 + 520 * k).fill({ color: 0xffb060, alpha: 0.6 * (1 - k) });
        }
        return;
      }
      const left = d.plant.tMs + MR12_STANDARD.timing.bombTimerMs - t;
      const defused = d.defuse && t >= d.defuse.tMs;
      const rate = left < 10000 ? 0.025 : 0.008;
      const pulse = defused ? 0 : 0.5 + 0.5 * Math.sin(t * rate);
      this.fx.circle(x, y, 18 + pulse * 16).stroke({ width: 2, color: defused ? 0x4aa8ff : 0xff3b3b, alpha: 0.9 - pulse * 0.5 });
      if (!defused) {
        const k = Math.max(0, left) / MR12_STANDARD.timing.bombTimerMs;
        this.fx.arc(x, y, 26, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k).stroke({ width: 3, color: 0xff5a5f, alpha: 0.85 });
      }
      icon(x, y, 8);
    }
  }
}
