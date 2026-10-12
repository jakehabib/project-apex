import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchEvent } from '../../core/match/events';
import { MAP_POOL, mapById } from '../../core/match/maps';
import { MR12_STANDARD } from '../../core/match/rules/ruleset';
import { weaponById } from '../../core/match/rules/arsenal';
import { useNav } from '../state/nav';
import { Playback, SPEEDS, type Speed } from '../viewer/Playback';
import { TacticalRenderer } from '../viewer/TacticalRenderer';
import { simulate, type SimResponse } from '../workers/simClient';
import './viewer.css';

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const POST_ROUND_MS = 2500;

function newSeed(): string {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return `apex-${a[0]!.toString(36)}`;
}

const weaponName = (id: string) => {
  try {
    return weaponById(id).name;
  } catch {
    return id === 'frag' ? 'Frag' : id === 'cinder' || id === 'ember' ? 'Fire' : id;
  }
};

export function ViewerProof() {
  const go = useNav((s) => s.go);
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TacticalRenderer | null>(null);
  const playbackRef = useRef(new Playback(60000));
  const [mapId, setMapId] = useState(MAP_POOL[0]!.id);
  const [seed, setSeed] = useState('apex-001');
  const [sim, setSim] = useState<SimResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [ui, setUi] = useState({ t: 0, paused: false, speed: 1 as Speed, fps: 0, backend: '' });
  const [selected, setSelected] = useState<string | null>(null);
  const fpsRef = useRef(0);

  useEffect(() => {
    const r = new TacticalRenderer(mapById(mapId), playbackRef.current);
    rendererRef.current = r;
    r.onFrame = (fps) => (fpsRef.current = fps);
    void r.init(hostRef.current!).catch((e: Error) => setError(`Renderer failed to start: ${e.message}`));
    return () => {
      r.destroy();
      rendererRef.current = null;
    };
  }, [mapId]);

  useEffect(() => {
    let cancelled = false;
    setSim(null);
    setError(null);
    simulate(seed, mapId)
      .then((res) => {
        if (cancelled) return;
        setSim(res);
        setRound(0);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [seed, mapId]);

  const names = useMemo(() => new Map((sim?.players ?? []).map((p) => [p.id, p.name])), [sim]);
  const roundEvents = useMemo(() => (sim ? sim.result.events.filter((e) => e.roundIndex === round) : []), [sim, round]);
  const roundEnd = roundEvents.find((e): e is Extract<MatchEvent, { type: 'round_end' }> => e.type === 'round_end');

  useEffect(() => {
    if (!sim || !roundEnd) return;
    const p = playbackRef.current;
    p.duration = roundEnd.tMs + POST_ROUND_MS;
    p.restart();
    rendererRef.current?.load(sim.result.events, round, names);
  }, [sim, round, roundEnd, names]);

  useEffect(() => {
    const id = setInterval(() => {
      const p = playbackRef.current;
      setUi({ t: p.t, paused: p.paused, speed: p.speed, fps: Math.round(fpsRef.current), backend: rendererRef.current?.backend ?? '' });
    }, 100);
    return () => clearInterval(id);
  }, []);

  // Auto-advance to the next round when one finishes.
  useEffect(() => {
    if (!sim || !autoAdvance || !ui.paused || ui.t < playbackRef.current.duration) return;
    if (round < sim.result.rounds.length - 1) setRound(round + 1);
  }, [ui, sim, round, autoAdvance]);

  useEffect(() => {
    if (rendererRef.current) rendererRef.current.selectedId = selected;
  }, [selected]);

  const setSpeed = useCallback((s: Speed) => (playbackRef.current.speed = s), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'SELECT') return;
      const p = playbackRef.current;
      if (e.code === 'Space') {
        e.preventDefault();
        p.toggle();
      } else if (e.key >= '1' && e.key <= '4') setSpeed(SPEEDS[Number(e.key) - 1]!);
      else if (e.key === 'ArrowRight') p.seek(p.t + 5000);
      else if (e.key === 'ArrowLeft') p.seek(p.t - 5000);
      else if (e.key.toLowerCase() === 'r') p.restart();
      else if (e.key.toLowerCase() === 'n' && sim) setRound((x) => Math.min(sim.result.rounds.length - 1, x + 1));
      else if (e.key.toLowerCase() === 'p') setRound((x) => Math.max(0, x - 1));
      else if (e.key.toLowerCase() === 'f' && rendererRef.current) {
        rendererRef.current.follow = !rendererRef.current.follow;
        if (rendererRef.current.follow) rendererRef.current.zoomTo(2.2);
      } else if (e.key === '0') rendererRef.current?.resetCamera();
      else if (e.key === 'Escape') go('title');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, setSpeed, sim]);

  const t = ui.t;
  const start = roundEvents.find((e): e is Extract<MatchEvent, { type: 'round_start' }> => e.type === 'round_start');
  const plant = roundEvents.find((e): e is Extract<MatchEvent, { type: 'plant' }> => e.type === 'plant');
  const attackerTeam = start?.attackerTeam ?? 0;
  const scores = t >= (roundEnd?.tMs ?? Infinity) ? roundEnd!.scores : (start?.scores ?? [0, 0]);
  const clock = plant && t >= plant.tMs ? MR12_STANDARD.timing.bombTimerMs - (t - plant.tMs) : MR12_STANDARD.timing.roundTimeMs - t;

  // Per-player live state derived from events up to t.
  const state = useMemo(() => {
    const m = new Map<string, { hp: number; alive: boolean; weapon: string; money: number; kills: number }>();
    const loadout = roundEvents.find((e): e is Extract<MatchEvent, { type: 'loadout' }> => e.type === 'loadout');
    for (const l of loadout?.loadouts ?? []) m.set(l.playerId, { hp: 100, alive: true, weapon: l.primary ?? l.secondary, money: l.money, kills: 0 });
    for (const e of roundEvents) {
      if (e.tMs > t) break;
      if (e.type === 'damage') m.get(e.victimId)!.hp = e.hpAfter;
      if (e.type === 'kill') {
        m.get(e.victimId)!.alive = false;
        const k = m.get(e.attackerId);
        if (k) k.kills++;
      }
      if (e.type === 'money') {
        const p = m.get(e.playerId);
        if (p) p.money = e.moneyAfter;
      }
    }
    return m;
  }, [roundEvents, t]);

  const feed = useMemo(() => {
    const out: { key: number; t: number; cls: string; text: string }[] = [];
    const nm = (id: string) => names.get(id) ?? id;
    const teamOfP = (id: string) => sim?.players.find((p) => p.id === id)?.team ?? 0;
    for (const e of roundEvents) {
      if (e.tMs > t) break;
      const side = (team: number) => (team === attackerTeam ? 'attacker' : 'defender');
      if (e.type === 'kill') out.push({ key: e.seq, t: e.tMs, cls: side(teamOfP(e.attackerId)), text: `${nm(e.attackerId)} ⟶ ${nm(e.victimId)} · ${weaponName(e.weaponId)}${e.headshot ? ' · HS' : ''}${e.tradeOfPlayerId ? ' · trade' : ''}` });
      if (e.type === 'plant') out.push({ key: e.seq, t: e.tMs, cls: 'attacker', text: `Bomb planted on ${e.site} by ${nm(e.playerId)}` });
      if (e.type === 'defuse') out.push({ key: e.seq, t: e.tMs, cls: 'defender', text: `Bomb defused by ${nm(e.playerId)}` });
      if (e.type === 'call') out.push({ key: e.seq, t: e.tMs, cls: side(e.team), text: `“${e.text}”` });
      if (e.type === 'timeout') out.push({ key: e.seq, t: e.tMs, cls: side(e.team), text: `Timeout: ${e.reason}` });
    }
    return out.slice(-7).reverse();
  }, [roundEvents, t, names, sim, attackerTeam]);

  const strip = (team: number) => {
    const side = team === attackerTeam ? 'attacker' : 'defender';
    return (
      <aside className={`v-strip v-strip-${side}`} aria-label={sim?.teamNames[team] ?? 'Team'}>
        <div className="v-strip-head">
          <span className="eyebrow">{side === 'attacker' ? 'Attack' : 'Defense'}</span>
          <span className="v-team-tag">{sim?.teamNames[team] ?? '—'}</span>
        </div>
        {(sim?.players ?? []).filter((p) => p.team === team).map((p) => {
          const st = state.get(p.id);
          const dead = st && !st.alive;
          return (
            <button key={p.id} className={`v-card ${selected === p.id ? 'is-selected' : ''} ${dead ? 'is-dead' : ''}`} onClick={() => setSelected(selected === p.id ? null : p.id)} aria-pressed={selected === p.id}>
              <span className="v-card-avatar">{p.name.charAt(0)}</span>
              <span className="v-card-main">
                <span className="v-card-name">{p.name}</span>
                <span className="v-card-where">{p.role} · {st ? weaponName(st.weapon) : ''} · ${st?.money ?? 0}</span>
                <span className="v-hp"><i style={{ width: `${st?.hp ?? 0}%` }} /></span>
              </span>
              <span className="v-card-stat mono">{st?.kills ?? 0}<small>kills</small></span>
            </button>
          );
        })}
        {!sim && !error && <div className="v-strip-empty">Simulating…</div>}
      </aside>
    );
  };

  return (
    <div className="viewer">
      <header className="v-top">
        <button className="btn btn-ghost btn-sm" onClick={() => go('title')} aria-label="Back to title (Esc)">← Menu</button>
        <div className="v-top-center">
          <span className="v-team v-team-atk">{scores[0]}</span>
          <div className="v-clock">
            <span className="eyebrow">{mapById(mapId).name} · Round {round + 1}</span>
            <span className={`mono v-clock-time ${plant && t >= plant.tMs ? 'is-bomb' : ''}`}>{fmt(clock)}</span>
            <span className="v-clock-sub">{start?.plan ?? ''}</span>
          </div>
          <span className="v-team v-team-def">{scores[1]}</span>
        </div>
        <div className="v-top-right mono">
          <span data-testid="fps">{ui.fps} FPS</span>
          <span data-testid="backend">{ui.backend}</span>
          {sim && <span>sim {sim.computeMs.toFixed(0)} ms</span>}
        </div>
      </header>

      <div className="v-body">
        {strip(0)}
        <div className="v-stage">
          <div ref={hostRef} className="v-canvas" data-testid="viewer-canvas" />
          {error && (
            <div className="v-overlay v-error" role="alert">
              <strong>Simulation unavailable</strong>
              <span>{error}</span>
              <button className="btn btn-sm" onClick={() => setSeed(newSeed())}>Try another seed</button>
            </div>
          )}
          {!sim && !error && <div className="v-overlay">Simulating full map…</div>}
          {roundEnd && t >= roundEnd.tMs && (
            <div className="v-round-banner">
              <strong>{sim?.teamNames[roundEnd.winnerTeam]} win the round</strong>
              <span>{roundEnd.reason.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>
        {strip(1)}
      </div>

      <footer className="v-bottom">
        <div className="v-transport" role="group" aria-label="Playback controls">
          <button className="btn btn-sm btn-icon" onClick={() => playbackRef.current.toggle()} aria-label={ui.paused ? 'Play (Space)' : 'Pause (Space)'} data-testid="play-toggle">{ui.paused ? '▶' : '❚❚'}</button>
          <button className="btn btn-sm btn-icon" onClick={() => playbackRef.current.restart()} aria-label="Restart round (R)">⟲</button>
          {SPEEDS.map((s, i) => (
            <button key={s} className="btn btn-sm" aria-pressed={ui.speed === s} onClick={() => setSpeed(s)} title={`Speed ${s}x (${i + 1})`}>{s}x</button>
          ))}
          <button className="btn btn-sm" onClick={() => rendererRef.current?.resetCamera()} title="Reset camera (0, or double-click the map)">⤢</button>
          <button className="btn btn-sm" disabled={!selected} onClick={() => { if (rendererRef.current) { rendererRef.current.follow = true; rendererRef.current.zoomTo(2.2); } }} title={selected ? 'Follow the selected player (F)' : 'Select a player card to follow'}>Follow</button>
          <input className="v-scrub" type="range" min={0} max={playbackRef.current.duration} step={100} value={t} onChange={(e) => playbackRef.current.seek(Number(e.target.value))} aria-label="Round timeline" />
        </div>
        <ol className="v-feed" aria-label="Event feed">
          {feed.map((l) => (
            <li key={l.key} className={`v-feed-${l.cls}`}><span className="mono">{fmt(l.t)}</span> {l.text}</li>
          ))}
          {feed.length === 0 && <li className="v-feed-empty">Kills, plants and calls appear here.</li>}
        </ol>
        <div className="v-seed">
          <select className="v-seed-input" value={mapId} onChange={(e) => setMapId(e.target.value)} aria-label="Map">
            {MAP_POOL.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input className="v-seed-input mono" value={seed} onChange={(e) => setSeed(e.target.value.slice(0, 40) || 'apex')} spellCheck={false} aria-label="Seed" />
          <button className="btn btn-sm" onClick={() => setSeed(newSeed())}>New match</button>
          <label className="v-auto"><input type="checkbox" checked={autoAdvance} onChange={(e) => setAutoAdvance(e.target.checked)} /> Auto-advance</label>
          {sim && <span className="mono v-print" title="Event-log fingerprint">#{sim.result.fingerprint.slice(0, 10)}</span>}
        </div>
        <div className="v-rounds" role="tablist" aria-label="Rounds">
          {(sim?.result.rounds ?? []).map((r) => (
            <button key={r.index} role="tab" aria-selected={r.index === round} className={`v-round-pip ${r.winnerTeam === 0 ? 'w0' : 'w1'} ${r.index === round ? 'is-current' : ''}`} onClick={() => setRound(r.index)} title={`Round ${r.index + 1}: ${sim?.teamNames[r.winnerTeam]} (${r.reason.replace(/_/g, ' ')})`}>
              {r.index + 1}
            </button>
          ))}
        </div>
      </footer>
    </div>
  );
}
