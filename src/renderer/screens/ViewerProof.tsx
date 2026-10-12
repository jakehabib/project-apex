import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchEvent } from '../../core/match/events';
import { buildGrid, calloutAt } from '../../core/match/maps/grid';
import { HARBOR } from '../../core/match/maps/harbor';
import { buildTracks, positionAt } from '../../core/match/replay/positions';
import type { ProofResult } from '../../core/match/spike/movementProof';
import { useNav } from '../state/nav';
import { Playback, SPEEDS, type Speed } from '../viewer/Playback';
import { TacticalRenderer } from '../viewer/TacticalRenderer';
import { simulate } from '../workers/simClient';
import './viewer.css';

const grid = buildGrid(HARBOR);
const fmt = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

function newSeed(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return `apex-${a[0]!.toString(36)}`;
}

export function ViewerProof() {
  const go = useNav((s) => s.go);
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TacticalRenderer | null>(null);
  const playbackRef = useRef(new Playback(45000));
  const [seed, setSeed] = useState('apex-001');
  const [result, setResult] = useState<ProofResult | null>(null);
  const [computeMs, setComputeMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [ui, setUi] = useState({ t: 0, paused: false, speed: 1 as Speed, fps: 0, backend: '' });
  const [selected, setSelected] = useState<string | null>(null);
  const fpsRef = useRef(0);

  // Renderer lifecycle.
  useEffect(() => {
    const r = new TacticalRenderer(HARBOR, playbackRef.current);
    rendererRef.current = r;
    r.onFrame = (fps) => (fpsRef.current = fps);
    void r.init(hostRef.current!).catch((e: Error) => setError(`Renderer failed to start: ${e.message}`));
    return () => {
      r.destroy();
      rendererRef.current = null;
    };
  }, []);

  // Authoritative simulation in the worker.
  useEffect(() => {
    let cancelled = false;
    setResult(null);
    setError(null);
    simulate(seed)
      .then(({ result: res, computeMs: ms }) => {
        if (cancelled) return;
        setResult(res);
        setComputeMs(ms);
        playbackRef.current.duration = res.durationMs;
        playbackRef.current.restart();
        rendererRef.current?.load(res.events, res.agents);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [seed]);

  // Low-frequency UI sync (10 Hz); the canvas animates at display rate independently.
  useEffect(() => {
    const id = setInterval(() => {
      const p = playbackRef.current;
      setUi({ t: p.t, paused: p.paused, speed: p.speed, fps: Math.round(fpsRef.current), backend: rendererRef.current?.backend ?? '' });
    }, 100);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (rendererRef.current) rendererRef.current.selectedId = selected;
  }, [selected]);

  const setSpeed = useCallback((s: Speed) => (playbackRef.current.speed = s), []);
  const seekBy = useCallback((d: number) => playbackRef.current.seek(playbackRef.current.t + d), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const p = playbackRef.current;
      if (e.code === 'Space') {
        e.preventDefault();
        p.toggle();
      } else if (e.key >= '1' && e.key <= '4') setSpeed(SPEEDS[Number(e.key) - 1]!);
      else if (e.key === 'ArrowRight') seekBy(5000);
      else if (e.key === 'ArrowLeft') seekBy(-5000);
      else if (e.key.toLowerCase() === 'r') p.restart();
      else if (e.key === 'Escape') go('title');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, seekBy, setSpeed]);

  const tracks = useMemo(() => (result ? buildTracks(result.events) : null), [result]);
  const t = ui.t;

  const feed = useMemo(() => {
    if (!result) return [];
    const name = (id: string) => result.agents.find((a) => a.id === id)?.name ?? id;
    const lines: { key: number; t: number; side: 'attacker' | 'defender'; text: string }[] = [];
    for (const e of result.events) {
      if (e.tMs > t) break;
      if (e.type === 'spotted') {
        const side = result.agents.find((a) => a.id === e.observerId)!.side;
        lines.push({ key: e.seq, t: e.tMs, side, text: `${name(e.observerId)} spots ${name(e.targetId)} · ${calloutAt(HARBOR, grid, e.targetPos)}` });
      } else if (e.type === 'hold') {
        const side = result.agents.find((a) => a.id === e.playerId)!.side;
        lines.push({ key: e.seq, t: e.tMs, side, text: `${name(e.playerId)} holds ${HARBOR.nodes.find((n) => n.id === e.nodeId)?.callout ?? ''}` });
      }
    }
    return lines.slice(-7).reverse();
  }, [result, t]);

  const unitStatus = (id: string) => {
    if (!result || !tracks) return { where: '—', moving: false, spotted: 0 };
    const tr = tracks.get(id)!;
    const pos = positionAt(tr, t);
    const moving = tr.segments.some((s) => t >= s.t0 && t < s.t1);
    const spotted = new Set(result.events.filter((e): e is Extract<MatchEvent, { type: 'spotted' }> => e.type === 'spotted' && e.observerId === id && e.tMs <= t).map((e) => e.targetId)).size;
    return { where: calloutAt(HARBOR, grid, pos), moving, spotted };
  };

  const strip = (side: 'attacker' | 'defender') => (
    <aside className={`v-strip v-strip-${side}`} aria-label={side === 'attacker' ? 'Attackers' : 'Defenders'}>
      <div className="v-strip-head">
        <span className="eyebrow">{side === 'attacker' ? 'Attack' : 'Defense'}</span>
        <span className="v-team-tag">{side === 'attacker' ? 'ATK' : 'DEF'}</span>
      </div>
      {(result?.agents ?? []).filter((a) => a.side === side).map((a) => {
        const st = unitStatus(a.id);
        return (
          <button key={a.id} className={`v-card ${selected === a.id ? 'is-selected' : ''}`} onClick={() => setSelected(selected === a.id ? null : a.id)} aria-pressed={selected === a.id}>
            <span className="v-card-avatar">{a.name.charAt(0)}</span>
            <span className="v-card-main">
              <span className="v-card-name">{a.name}</span>
              <span className="v-card-where">{st.moving ? 'Moving · ' : 'Set · '}{st.where}</span>
            </span>
            <span className="v-card-stat mono" title="Enemies personally sighted">
              {st.spotted}
              <small>seen</small>
            </span>
          </button>
        );
      })}
      {!result && !error && <div className="v-strip-empty">Simulating…</div>}
    </aside>
  );

  return (
    <div className="viewer">
      <header className="v-top">
        <button className="btn btn-ghost btn-sm" onClick={() => go('title')} aria-label="Back to title (Esc)">
          ← Menu
        </button>
        <div className="v-top-center">
          <span className="v-team v-team-atk">ATK</span>
          <div className="v-clock">
            <span className="eyebrow">{HARBOR.name}</span>
            <span className="mono v-clock-time">{fmt(t)}</span>
            <span className="v-clock-sub">Movement &amp; sightline proof</span>
          </div>
          <span className="v-team v-team-def">DEF</span>
        </div>
        <div className="v-top-right mono">
          <span title="Rendering frames per second" data-testid="fps">{ui.fps} FPS</span>
          <span title="Active rendering backend" data-testid="backend">{ui.backend}</span>
          {result && <span title="Simulation compute time in worker">sim {computeMs.toFixed(1)} ms</span>}
        </div>
      </header>

      <div className="v-body">
        {strip('attacker')}
        <div className="v-stage">
          <div ref={hostRef} className="v-canvas" data-testid="viewer-canvas" />
          {error && (
            <div className="v-overlay v-error" role="alert">
              <strong>Simulation unavailable</strong>
              <span>{error}</span>
              <button className="btn btn-sm" onClick={() => setSeed(newSeed())}>Try another seed</button>
            </div>
          )}
          {!result && !error && <div className="v-overlay">Running seeded simulation…</div>}
          <div className="v-legend">
            <span><i className="dot atk" /> Attacker</span>
            <span><i className="dot def" /> Defender</span>
            <span><i className="line" /> Sightline contact</span>
            <span className="v-legend-note">No combat in Phase 0: agents move and record what they can actually see.</span>
          </div>
        </div>
        {strip('defender')}
      </div>

      <footer className="v-bottom">
        <div className="v-transport" role="group" aria-label="Playback controls">
          <button className="btn btn-sm btn-icon" onClick={() => playbackRef.current.toggle()} aria-label={ui.paused ? 'Play (Space)' : 'Pause (Space)'} data-testid="play-toggle">
            {ui.paused ? '▶' : '❚❚'}
          </button>
          <button className="btn btn-sm btn-icon" onClick={() => playbackRef.current.restart()} aria-label="Restart (R)">⟲</button>
          {SPEEDS.map((s, i) => (
            <button key={s} className="btn btn-sm" aria-pressed={ui.speed === s} onClick={() => setSpeed(s)} title={`Speed ${s}x (${i + 1})`}>
              {s}x
            </button>
          ))}
          <input
            className="v-scrub"
            type="range"
            min={0}
            max={result?.durationMs ?? 45000}
            step={100}
            value={t}
            onChange={(e) => playbackRef.current.seek(Number(e.target.value))}
            aria-label="Timeline"
          />
          <span className="mono v-dur">{fmt(result?.durationMs ?? 0)}</span>
        </div>
        <ol className="v-feed" aria-label="Event feed" aria-live="off">
          {feed.map((l) => (
            <li key={l.key} className={`v-feed-${l.side}`}>
              <span className="mono">{fmt(l.t)}</span> {l.text}
            </li>
          ))}
          {feed.length === 0 && <li className="v-feed-empty">Contacts and set-ups will appear here.</li>}
        </ol>
        <div className="v-seed">
          <label className="eyebrow" htmlFor="seed">Seed</label>
          <input id="seed" className="v-seed-input mono" value={seed} onChange={(e) => setSeed(e.target.value.slice(0, 40) || 'apex')} spellCheck={false} />
          <button className="btn btn-sm" onClick={() => setSeed(newSeed())}>New seed</button>
          {result && <span className="mono v-print" title="Event-log fingerprint: identical seed ⇒ identical fingerprint">#{result.fingerprint.slice(0, 12)}</span>}
        </div>
      </footer>
    </div>
  );
}
