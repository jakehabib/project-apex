/**
 * Broadcast match renderer (PixiJS): near-3D map art, operator figures, effects and the developer
 * tactical overlay. It owns no simulation state: everything drawn at time t is reconstructed from
 * the authoritative event log, so seeking, speed and pausing only change which instant is shown.
 */
import 'pixi.js/unsafe-eval';
import { Application, Container, Graphics, Sprite, Text, Texture } from 'pixi.js';
import type { EventOf, MatchEvent, Side } from '../../core/match/events';
import type { MapDefinition, Vec2 } from '../../core/match/maps/types';
import { buildTracks, headingAt, positionAt, type Track } from '../../core/match/replay/positions';
import { MR12_STANDARD } from '../../core/match/rules/ruleset';
import { loadTrimmed, spriteUrl } from '../art/generated';
import { radialSprite } from '../viewer/art/textures';
import type { Playback } from '../viewer/Playback';
import { renderBroadcastMap } from './mapArt';

export const SIDE_COLOR: Record<Side, number> = { attacker: 0xe8814c, defender: 0x49a7ef };
const SQUAD_COLORS = [0xf5d76e, 0x7ee0b5, 0xc59bff, 0xff9fb2, 0x8fd3ff, 0xffffff];
const FIG = 40; // operator figure size in map units (readable at broadcast zoom)

interface Unit {
  readonly id: string;
  readonly name: string;
  readonly side: Side;
  readonly team: number;
  readonly track: Track;
  readonly root: Container;
  readonly figure: Sprite | Graphics;
  readonly base: Graphics;
  readonly label: Text;
  readonly hp: { t: number; hp: number }[];
  heading: number;
}

interface RoundData {
  shots: EventOf<'damage'>[];
  kills: EventOf<'kill'>[];
  utility: EventOf<'utility'>[];
  flashes: EventOf<'flashed'>[];
  plant: EventOf<'plant'> | null;
  defuseStarts: EventOf<'defuse_start'>[];
  defuse: EventOf<'defuse'> | null;
  detonate: EventOf<'detonate'> | null;
  bombEvents: MatchEvent[];
  carrierAtStart: string | null;
  ai: EventOf<'ai'>[];
  spotted: EventOf<'spotted'>[];
}

const utilWeapon = (id: string) => id === 'frag' || id === 'cinder' || id === 'ember';

export class BroadcastRenderer {
  readonly app = new Application();
  private readonly camera = new Container();
  private readonly world = new Container();
  private readonly decals = new Graphics();
  private readonly utilLayer = new Container();
  private readonly fx = new Graphics();
  private readonly debug = new Graphics();
  private readonly debugText = new Container();
  private readonly units = new Map<string, Unit>();
  private data: RoundData | null = null;
  private host: HTMLElement | null = null;
  private destroyed = false;
  private smokeTex: Texture | null = null;
  private smokeEdgeTex: Texture | null = null;
  private fireTex: Texture | null = null;
  private figTex: Partial<Record<Side, Texture>> = {};
  private utilSprites: { sprite: Sprite; ev: EventOf<'utility'>; i: number }[] = [];
  private zoom = 1;
  private pan = { x: 0, y: 0 };
  private baseScale = 1;
  private drag: { x: number; y: number; px: number; py: number } | null = null;
  selectedId: string | null = null;
  showDebug = false;
  debugTeam: 0 | 1 | null = null;
  onFrame: ((t: number) => void) | null = null;

  constructor(
    private readonly map: MapDefinition,
    private readonly playback: Playback,
  ) {}

  async init(host: HTMLElement): Promise<void> {
    this.host = host;
    await this.app.init({ background: 0x0d1117, antialias: true, resizeTo: host, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true, preference: 'webgl' });
    if (this.destroyed) {
      this.app.destroy(true);
      return;
    }
    this.app.canvas.setAttribute('aria-label', `${this.map.name} broadcast view`);
    host.appendChild(this.app.canvas);
    this.smokeTex = Texture.from(radialSprite(128, 'rgba(214,218,222,0.97)', 'rgba(170,178,186,0)'));
    this.smokeEdgeTex = Texture.from(radialSprite(128, 'rgba(236,238,240,0.55)', 'rgba(200,205,210,0)'));
    this.fireTex = Texture.from(radialSprite(96, 'rgba(255,214,120,0.95)', 'rgba(255,70,10,0)'));
    for (const side of ['attacker', 'defender'] as const) {
      const img = await loadTrimmed(spriteUrl(side === 'attacker' ? 'operator_t' : 'operator_ct'));
      if (img) this.figTex[side] = Texture.from(img);
    }
    this.app.stage.addChild(this.camera);
    this.camera.addChild(this.world);
    this.world.sortableChildren = true;
    const art = await renderBroadcastMap(this.map, 2);
    if (this.destroyed) return;
    const mapSprite = new Sprite(Texture.from(art));
    mapSprite.width = this.map.width;
    mapSprite.height = this.map.height;
    mapSprite.zIndex = 0;
    this.world.addChild(mapSprite);
    this.addCallouts();
    this.decals.zIndex = 1;
    this.debug.zIndex = 2;
    this.utilLayer.zIndex = 15;
    this.fx.zIndex = 16;
    this.debugText.zIndex = 20;
    this.world.addChild(this.decals, this.debug, this.utilLayer, this.fx, this.debugText);
    this.app.renderer.on('resize', () => this.fit());
    this.bindCamera();
    this.fit();
    this.app.ticker.add((ticker) => {
      this.playback.advance(ticker.deltaMS);
      this.renderAt(this.playback.t);
      this.onFrame?.(this.playback.t);
    });
  }

  private addCallouts(): void {
    const seen = new Set<string>();
    for (const a of this.map.areas) {
      if (seen.has(a.callout) || a.site) continue;
      seen.add(a.callout);
      const xs = a.polygon.map((p) => p.x);
      const ys = a.polygon.map((p) => p.y);
      const t = new Text({ text: a.callout.toUpperCase(), style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 13, letterSpacing: 2, fill: 0xf1f5f9 }, resolution: 3 });
      t.alpha = 0.32;
      t.anchor.set(0.5);
      t.zIndex = 1;
      t.position.set((Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2);
      this.world.addChild(t);
    }
  }

  /** Loads one round of the event log. */
  load(events: readonly MatchEvent[], roundIndex: number, names: ReadonlyMap<string, string>): void {
    for (const u of this.units.values()) u.root.destroy({ children: true });
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
      defuseStarts: of('defuse_start'),
      defuse: of('defuse')[0] ?? null,
      detonate: of('detonate')[0] ?? null,
      bombEvents: inRound.filter((e) => e.type === 'bomb_drop' || e.type === 'bomb_pickup' || e.type === 'plant'),
      carrierAtStart: loadout?.loadouts.find((l) => l.bomb)?.playerId ?? null,
      ai: of('ai'),
      spotted: of('spotted'),
    };
    const teamOf = new Map(of('spawn').map((s) => [s.playerId, s.team]));
    for (const [id, track] of buildTracks(events, roundIndex)) {
      if (!teamOf.has(id)) continue;
      const u = this.createUnit(id, names.get(id) ?? id, track.side, teamOf.get(id)!, track);
      u.hp.push({ t: -Infinity, hp: 100 }, ...allDamage.filter((d) => d.victimId === id).map((d) => ({ t: d.tMs, hp: d.hpAfter })));
      this.units.set(id, u);
    }
    for (const ev of this.data.utility) {
      if (ev.utility !== 'smoke' && ev.utility !== 'fire') continue;
      const n = ev.utility === 'smoke' ? 11 : 9;
      for (let i = 0; i < n; i++) {
        const tex = ev.utility === 'smoke' ? (i >= 7 ? this.smokeEdgeTex! : this.smokeTex!) : this.fireTex!;
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        sprite.visible = false;
        if (ev.utility === 'fire') sprite.blendMode = 'add';
        this.utilLayer.addChild(sprite);
        this.utilSprites.push({ sprite, ev, i });
      }
    }
    this.renderAt(this.playback.t);
  }

  resetCamera(): void {
    this.zoom = 1;
    this.pan = { x: 0, y: 0 };
    this.fit();
  }

  destroy(): void {
    this.destroyed = true;
    if (this.app.renderer) this.app.destroy(true, { children: true });
  }

  // ---------------------------------------------------------------- camera
  private bindCamera(): void {
    const el = this.app.canvas;
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const before = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      this.zoom = Math.max(1, Math.min(4, this.zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
      this.applyCamera();
      const after = this.screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const s = this.baseScale * this.zoom;
      this.pan.x += (after.x - before.x) * s;
      this.pan.y += (after.y - before.y) * s;
      this.applyCamera();
    }, { passive: false });
    el.addEventListener('pointerdown', (e) => (this.drag = { x: e.clientX, y: e.clientY, px: this.pan.x, py: this.pan.y }));
    window.addEventListener('pointermove', (e) => {
      if (!this.drag) return;
      this.pan.x = this.drag.px + (e.clientX - this.drag.x);
      this.pan.y = this.drag.py + (e.clientY - this.drag.y);
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
    this.baseScale = Math.min((w - 16) / this.map.width, (h - 16) / this.map.height);
    this.applyCamera();
  }

  private applyCamera(): void {
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;
    const s = this.baseScale * this.zoom;
    this.camera.scale.set(s);
    this.camera.position.set((w - this.map.width * s) / 2 + this.pan.x, (h - this.map.height * s) / 2 + this.pan.y);
  }

  // ---------------------------------------------------------------- units
  private createUnit(id: string, name: string, side: Side, team: number, track: Track): Unit {
    const root = new Container();
    root.zIndex = 10;
    const base = new Graphics();
    const tex = this.figTex[side];
    let figure: Sprite | Graphics;
    if (tex) {
      const s = new Sprite(tex);
      s.anchor.set(0.5, 0.55);
      const k = FIG / Math.max(tex.width, tex.height);
      s.scale.set(k);
      figure = s;
    } else {
      figure = new Graphics().circle(0, 0, 10).fill({ color: 0x141b24 }).stroke({ width: 3, color: SIDE_COLOR[side] }).moveTo(0, -4).lineTo(0, -16).stroke({ width: 3, color: 0xf1f5f9 });
    }
    const label = new Text({ text: name.toUpperCase(), style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 12, letterSpacing: 1, fill: 0xf1f5f9, stroke: { color: 0x0d1117, width: 3 } }, resolution: 4 });
    label.anchor.set(0.5, 1);
    label.position.set(0, -FIG * 0.62);
    root.addChild(base, figure, label);
    this.world.addChild(root);
    return { id, name, side, team, track, root, figure, base, label, hp: [], heading: side === 'attacker' ? -Math.PI / 2 : Math.PI / 2 };
  }

  private hpAt(u: Unit, t: number): number {
    let hp = 100;
    for (const h of u.hp) if (h.t <= t) hp = h.hp;
    return hp;
  }

  // ---------------------------------------------------------------- frame
  renderAt(t: number): void {
    const d = this.data;
    this.fx.clear();
    this.updateUtility(t);
    if (d) {
      this.drawUtilityFx(t, d);
      this.drawShots(t, d);
      this.decals.clear();
      for (const k of d.kills) {
        if (k.tMs > t) break;
        const age = Math.min(1, (t - k.tMs) / 1200);
        this.decals.circle(k.victimPos.x + 2, k.victimPos.y + 3, 6 + 7 * age).fill({ color: 0x4a0b0b, alpha: 0.55 });
        this.decals.circle(k.victimPos.x + 8, k.victimPos.y - 3, 3 + 3 * age).fill({ color: 0x4a0b0b, alpha: 0.45 });
      }
      this.drawBomb(t, d);
    }
    for (const u of this.units.values()) this.drawUnit(u, t, d);
    this.drawDebug(t, d);
  }

  private drawShots(t: number, d: RoundData): void {
    for (const e of d.shots) {
      if (e.tMs > t) break;
      const age = t - e.tMs;
      if (age > 160) continue;
      const k = 1 - age / 160;
      const { attackerPos: a, victimPos: v } = e;
      this.fx.moveTo(a.x, a.y).lineTo(v.x, v.y).stroke({ width: 4, color: 0xffb347, alpha: 0.25 * k });
      this.fx.moveTo(a.x, a.y).lineTo(v.x, v.y).stroke({ width: 1.6, color: 0xfff4d0, alpha: 0.95 * k });
      this.fx.circle(v.x, v.y, 3 + 5 * (1 - k)).fill({ color: e.headshot ? 0xff3030 : 0xffc070, alpha: 0.8 * k });
    }
  }

  private drawUtilityFx(t: number, d: RoundData): void {
    for (const u of d.utility) {
      if (t >= u.tMs && t < u.detonateMs) {
        // Grenade in flight on a lobbed arc, with a small shadow on the ground.
        const k = (t - u.tMs) / (u.detonateMs - u.tMs);
        const x = u.from.x + (u.target.x - u.from.x) * k;
        const y = u.from.y + (u.target.y - u.from.y) * k;
        const lift = Math.sin(k * Math.PI) * 70;
        this.fx.ellipse(x + lift * 0.15, y + lift * 0.25, 4, 2.5).fill({ color: 0x000000, alpha: 0.35 });
        this.fx.circle(x, y - lift, 3.6).fill({ color: u.utility === 'flash' ? 0xf1f5f9 : u.utility === 'smoke' ? 0x9aa5b1 : u.utility === 'fire' ? 0xff8a3d : 0x6b8f4e }).stroke({ width: 1.2, color: 0x0d1117 });
      }
      const age = t - u.detonateMs;
      if (u.utility === 'flash' && age >= 0 && age < 520) {
        const k = age / 520;
        this.fx.circle(u.target.x, u.target.y, 40 + 190 * k).fill({ color: 0xffffff, alpha: 0.5 * (1 - k) });
        this.fx.circle(u.target.x, u.target.y, 16).fill({ color: 0xffffff, alpha: 0.9 * (1 - k) });
      }
      if (u.utility === 'frag' && age >= 0 && age < 700) {
        const k = age / 700;
        this.fx.circle(u.target.x, u.target.y, 20 + 120 * k).stroke({ width: 4 * (1 - k) + 1, color: 0xffe6b0, alpha: 0.85 * (1 - k) });
        this.fx.circle(u.target.x, u.target.y, 26 * (1 - k) + 6).fill({ color: 0xff9a40, alpha: 0.7 * (1 - k) });
        for (let i = 0; i < 10; i++) {
          const ang = (i / 10) * Math.PI * 2 + u.seq;
          const r = 30 + 90 * k;
          this.fx.circle(u.target.x + Math.cos(ang) * r, u.target.y + Math.sin(ang) * r, 1.8).fill({ color: 0xffd080, alpha: 1 - k });
        }
      }
      if (u.utility === 'fire' && age >= 0) {
        // Scorch mark that outlives the fire.
        this.fx.circle(u.target.x, u.target.y, 58).fill({ color: 0x120a06, alpha: Math.min(0.45, age / 2000) });
      }
    }
  }

  private updateUtility(t: number): void {
    for (const { sprite, ev, i } of this.utilSprites) {
      const start = ev.detonateMs;
      const end = ev.detonateMs + ev.durationMs;
      if (t < start || t > end + 1800) {
        sprite.visible = false;
        continue;
      }
      sprite.visible = true;
      const age = t - start;
      if (ev.utility === 'smoke') {
        // Billowing: puffs expand outwards from the canister, drift slowly, then thin out.
        const grow = Math.min(1, age / 1100);
        const fade = Math.min(1, (end + 1800 - t) / 1800);
        const ang = (i / 11) * Math.PI * 2 + age * 0.00012 + i;
        const ring = i === 0 ? 0 : i < 7 ? 30 : 58;
        const r = ring * grow + Math.sin(age * 0.0006 + i * 1.7) * 6;
        sprite.position.set(ev.target.x + Math.cos(ang) * r, ev.target.y + Math.sin(ang) * r);
        const size = (i === 0 ? 120 : i < 7 ? 100 : 80) * (0.35 + 0.65 * grow) * (1 + 0.04 * Math.sin(age * 0.001 + i));
        sprite.width = sprite.height = size;
        sprite.alpha = (i < 7 ? 0.95 : 0.7) * fade * Math.min(1, age / 250);
      } else {
        if (t > end) {
          sprite.visible = false;
          continue;
        }
        const flick = Math.sin(age * 0.035 + i * 2.3);
        const ang = (i / 9) * Math.PI * 2 + age * 0.0007;
        const r = i === 0 ? 0 : 18 + 14 * ((i * 37) % 10) / 10 + flick * 4;
        sprite.position.set(ev.target.x + Math.cos(ang) * r, ev.target.y + Math.sin(ang) * r - Math.abs(flick) * 3);
        sprite.width = sprite.height = 40 + flick * 12 + (i === 0 ? 20 : 0);
        sprite.alpha = (0.7 + 0.3 * flick) * Math.min(1, (end - t) / 700 + 0.15) * Math.min(1, age / 200);
      }
    }
  }

  private drawUnit(u: Unit, t: number, d: RoundData | null): void {
    const p = positionAt(u.track, t);
    const dead = u.track.diedAt !== null && t >= u.track.diedAt;
    const color = SIDE_COLOR[u.side];
    // Facing: the movement heading, overridden by the latest shot direction.
    const h = headingAt(u.track, t);
    if (h) u.heading = Math.atan2(h.y, h.x);
    let shotAt = -Infinity;
    if (d) {
      for (let i = d.shots.length - 1; i >= 0; i--) {
        const e = d.shots[i]!;
        if (e.tMs > t || e.attackerId !== u.id) continue;
        if (t - e.tMs < 700) {
          u.heading = Math.atan2(e.victimPos.y - p.y, e.victimPos.x - p.x);
          shotAt = e.tMs;
        }
        break;
      }
    }
    const moving = !!h && !dead;
    const recoil = t - shotAt < 90 ? (1 - (t - shotAt) / 90) * 3 : 0;
    const bob = moving ? Math.sin(t * 0.018) * 0.035 : 0;
    u.root.position.set(p.x - Math.cos(u.heading) * recoil, p.y - Math.sin(u.heading) * recoil);
    u.base.clear();
    if (dead) {
      u.root.alpha = 0.55;
      u.figure.rotation = u.heading + Math.PI / 2 + 0.9;
      u.figure.tint = 0x555555;
      u.label.visible = false;
      u.base.circle(0, 0, FIG * 0.32).stroke({ width: 2, color, alpha: 0.6 });
      return;
    }
    u.root.alpha = 1;
    u.figure.tint = 0xffffff;
    u.label.visible = true;
    u.figure.rotation = u.heading + Math.PI / 2;
    u.figure.scale.set((u.figure instanceof Sprite ? FIG / Math.max(u.figure.texture.width, u.figure.texture.height) : 1) * (1 + bob));
    const hp = this.hpAt(u, t);
    // Base ring: side colour, HP arc, view wedge.
    u.base.ellipse(3, 5, FIG * 0.42, FIG * 0.34).fill({ color: 0x000000, alpha: 0.35 });
    u.base.moveTo(0, 0).arc(0, 0, FIG * 1.1, u.heading - 0.5, u.heading + 0.5).closePath().fill({ color, alpha: 0.08 });
    u.base.circle(0, 0, FIG * 0.5).fill({ color, alpha: 0.18 }).stroke({ width: 3, color, alpha: 1 });
    u.base.arc(0, 0, FIG * 0.5 + 3.5, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * hp) / 100).stroke({ width: 2.2, color: hp > 50 ? 0x45c995 : hp > 20 ? 0xe5b35c : 0xe16c74 });
    if (this.selectedId === u.id) u.base.circle(0, 0, FIG * 0.5 + 8).stroke({ width: 2, color: 0x75c3fa });
    if (d?.flashes.some((f) => f.playerId === u.id && t >= f.tMs && t < f.tMs + f.durationMs)) u.base.circle(0, 0, FIG * 0.55).fill({ color: 0xffffff, alpha: 0.6 });
    if (t - shotAt < 70) {
      const mx = Math.cos(u.heading) * FIG * 0.62;
      const my = Math.sin(u.heading) * FIG * 0.62;
      this.fx.circle(p.x + mx, p.y + my, 6).fill({ color: 0xffe3a0, alpha: 0.9 });
      this.fx.circle(p.x + mx, p.y + my, 11).fill({ color: 0xffa040, alpha: 0.35 });
    }
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
    const icon = (x: number, y: number, s: number, blink: number) => {
      this.fx.roundRect(x - s, y - s * 0.7, s * 2, s * 1.4, 2).fill({ color: 0x2b2f33 }).stroke({ width: 1.2, color: 0x0d1117 });
      this.fx.circle(x + s * 0.45, y - s * 0.2, s * 0.28).fill({ color: 0xff2a2a, alpha: blink });
    };
    if (carrier) {
      const u = this.units.get(carrier);
      if (u && !(u.track.diedAt !== null && t >= u.track.diedAt)) icon(u.root.position.x + FIG * 0.45, u.root.position.y + FIG * 0.4, 5, 0.9);
    }
    if (dropped) {
      const pulse = 0.6 + 0.4 * Math.sin(t * 0.006);
      this.fx.circle(dropped.x, dropped.y, 14).stroke({ width: 2, color: 0xe16c74, alpha: pulse });
      icon(dropped.x, dropped.y, 7, pulse);
    }
    if (d.plant && t >= d.plant.tMs) {
      const { x, y } = d.plant.pos;
      if (d.detonate && t >= d.detonate.tMs) {
        const age = t - d.detonate.tMs;
        if (age < 1800) {
          const k = age / 1800;
          this.fx.circle(x, y, 40 + 560 * k).fill({ color: 0xffb060, alpha: 0.55 * (1 - k) });
          this.fx.circle(x, y, 30 + 300 * k).stroke({ width: 6 * (1 - k) + 1, color: 0xfff0d0, alpha: 0.8 * (1 - k) });
        }
        return;
      }
      const left = d.plant.tMs + MR12_STANDARD.timing.bombTimerMs - t;
      const defused = d.defuse && t >= d.defuse.tMs;
      const rate = left < 10000 ? 0.03 : 0.009;
      const pulse = defused ? 0 : 0.5 + 0.5 * Math.sin(t * rate);
      this.fx.circle(x, y, 18 + pulse * 18).stroke({ width: 2, color: defused ? 0x49a7ef : 0xff3b3b, alpha: 0.9 - pulse * 0.5 });
      if (!defused) {
        const k = Math.max(0, left) / MR12_STANDARD.timing.bombTimerMs;
        this.fx.arc(x, y, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * k).stroke({ width: 3, color: 0xe16c74, alpha: 0.9 });
        // Defuse in progress: a blue ring fills over the defuse time.
        const ds = [...d.defuseStarts].reverse().find((e) => e.tMs <= t);
        if (ds && t - ds.tMs < (ds.withKit ? MR12_STANDARD.timing.defuseKitTimeMs : MR12_STANDARD.timing.defuseTimeMs)) {
          const need = ds.withKit ? MR12_STANDARD.timing.defuseKitTimeMs : MR12_STANDARD.timing.defuseTimeMs;
          this.fx.arc(x, y, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ((t - ds.tMs) / need)).stroke({ width: 4, color: 0x49a7ef, alpha: 0.95 });
        }
      }
      icon(x, y, 8, pulse);
    }
  }

  // ---------------------------------------------------------------- developer tactical overlay
  private drawDebug(t: number, d: RoundData | null): void {
    this.debug.clear();
    for (const c of this.debugText.removeChildren()) c.destroy();
    if (!this.showDebug || !d) return;
    for (const team of [0, 1] as const) {
      if (this.debugTeam !== null && this.debugTeam !== team) continue;
      const latest = [...d.ai].reverse().find((e) => e.team === team && e.tMs <= t);
      if (!latest) continue;
      const squads = [...new Set(latest.assign.map((a) => a.squad))];
      for (const a of latest.assign) {
        const u = this.units.get(a.playerId);
        if (!u || (u.track.diedAt !== null && t >= u.track.diedAt) || !a.dest) continue;
        const col = SQUAD_COLORS[squads.indexOf(a.squad) % SQUAD_COLORS.length]!;
        const from = u.root.position;
        // Planned destination: dashed line and target marker.
        const dx = a.dest.x - from.x;
        const dy = a.dest.y - from.y;
        const len = Math.hypot(dx, dy);
        for (let s = 0; s < len; s += 18) {
          const k0 = s / len;
          const k1 = Math.min(1, (s + 9) / len);
          this.debug.moveTo(from.x + dx * k0, from.y + dy * k0).lineTo(from.x + dx * k1, from.y + dy * k1);
        }
        this.debug.stroke({ width: 2, color: col, alpha: 0.85 });
        this.debug.circle(a.dest.x, a.dest.y, 7).stroke({ width: 2, color: col, alpha: 0.9 });
        const tag = new Text({ text: `${a.role || a.squad} · ${a.why}`, style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 13, fill: col, stroke: { color: 0x000000, width: 3 } }, resolution: 4 });
        tag.position.set(from.x + FIG * 0.6, from.y + FIG * 0.2);
        this.debugText.addChild(tag);
      }
      // What this team knows: enemy sightings in the last 4 seconds, fading with age.
      for (const s of d.spotted) {
        if (s.tMs > t || t - s.tMs > 4000) continue;
        const obs = this.units.get(s.observerId);
        if (!obs || obs.team !== team) continue;
        const a = 1 - (t - s.tMs) / 4000;
        this.debug.circle(s.targetPos.x, s.targetPos.y, 9).stroke({ width: 1.5, color: team === 0 ? 0xffe08a : 0x9fe0ff, alpha: 0.8 * a });
        this.debug.moveTo(s.targetPos.x - 5, s.targetPos.y - 5).lineTo(s.targetPos.x + 5, s.targetPos.y + 5).moveTo(s.targetPos.x + 5, s.targetPos.y - 5).lineTo(s.targetPos.x - 5, s.targetPos.y + 5).stroke({ width: 1.5, color: team === 0 ? 0xffe08a : 0x9fe0ff, alpha: 0.8 * a });
      }
      // Belief pressure by area, next to each site label (and mid).
      const label = (pos: Vec2, area: string) => {
        const v = latest.pressure.find((p) => p.area === area)?.value ?? 0;
        const txt = new Text({ text: `${team === 0 ? 'T0' : 'T1'} believes ${area}: ${v.toFixed(1)}`, style: { fontFamily: 'Barlow Condensed', fontWeight: '700', fontSize: 15, fill: v >= 2 ? 0xe16c74 : v >= 1 ? 0xe5b35c : 0xa1aebd, stroke: { color: 0x000000, width: 3 } }, resolution: 4 });
        txt.position.set(pos.x - 60, pos.y + 60 + team * 14);
        this.debugText.addChild(txt);
      };
      label(this.map.sites.A.label, 'A');
      label(this.map.sites.B.label, 'B');
      label({ x: this.map.width / 2, y: this.map.height / 2 }, 'mid');
    }
  }
}
