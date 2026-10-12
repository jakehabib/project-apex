import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Stance } from '../../core/match/engine/match';
import type { MatchEvent } from '../../core/match/events';
import { mapById } from '../../core/match/maps';
import { MR12_STANDARD } from '../../core/match/rules/ruleset';
import type { MapRecap } from '../../core/match/stats/recap';
import { crestUrl } from '../art/generated';
import { useNav } from '../state/nav';
import { Playback, type Speed } from '../viewer/Playback';
import { TacticalRenderer } from '../viewer/TacticalRenderer';
import { finishMatch, getRecap, instruct, listTeams, setupMatch, stepRound, type TeamOption } from '../workers/matchClient';
import type { MatchSetupInfo } from '../workers/match.worker';
import { MatchRecapView } from './MatchRecap';
import './matchday.css';
import './viewer.css';

type Phase = 'setup' | 'loading' | 'live' | 'recap';
const POST_ROUND_MS = 2200;
const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const STANCES: { id: Stance; label: string; help: string }[] = [
  { id: 'aggressive', label: 'Aggressive', help: 'Faster hits, early CT info pushes, more force-buys.' },
  { id: 'balanced', label: 'Balanced', help: "The team's standard game plan." },
  { id: 'passive', label: 'Passive', help: 'Slower defaults, retake-minded defence, disciplined saves.' },
];

function Crest({ id, size = 48 }: { id: string; size?: number }) {
  const url = crestUrl(id);
  return url ? <img src={url} width={size} height={size} alt="" draggable={false} /> : <span className="md-crest-ph" style={{ width: size, height: size }} />;
}

export function MatchDay() {
  const go = useNav((s) => s.go);
  const [phase, setPhase] = useState<Phase>('setup');
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [maps, setMaps] = useState<{ id: string; name: string }[]>([]);
  const [home, setHome] = useState('polararc');
  const [away, setAway] = useState('ironvale');
  const [mapId, setMapId] = useState('harbor');
  const [info, setInfo] = useState<MatchSetupInfo | null>(null);
  const [recap, setRecap] = useState<MapRecap | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const eventsRef = useRef<MatchEvent[]>([]);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const [stance, setStance] = useState<Stance>('balanced');
  const [pendingStance, setPendingStance] = useState<Stance | null>(null);
  const [ui, setUi] = useState({ t: 0, speed: 1 as Speed, paused: false });
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<TacticalRenderer | null>(null);
  const playbackRef = useRef(new Playback(60000));
  const advancing = useRef(false);

  useEffect(() => {
    void listTeams().then((r) => {
      setTeams(r.teams);
      setMaps(r.maps);
    });
  }, []);

  const names = useMemo(() => new Map((info?.players ?? []).map((p) => [p.id, p.name])), [info]);

  const start = async (mode: 'play' | 'sim') => {
    setErr(null);
    setPhase('loading');
    try {
      const seed = `md-${home}-${away}-${mapId}-${Date.now() % 100000}`;
      const s = await setupMatch(home, away, mapId, seed);
      setInfo(s.info);
      eventsRef.current = [...s.events];
      setStance('balanced');
      setPendingStance(null);
      if (mode === 'sim') {
        await finishMatch();
        const r = await getRecap();
        setRecap(r.recap);
        setPhase('recap');
        return;
      }
      const first = await stepRound();
      eventsRef.current.push(...first.events);
      setDone(first.done);
      setRound(0);
      setPhase('live');
    } catch (e) {
      setErr((e as Error).message);
      setPhase('setup');
    }
  };

  // Renderer lifecycle while live.
  useEffect(() => {
    if (phase !== 'live' || !info) return;
    const r = new TacticalRenderer(mapById(info.mapId), playbackRef.current);
    rendererRef.current = r;
    void r.init(hostRef.current!).then(() => loadRound(0));
    return () => {
      r.destroy();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, info]);

  const loadRound = useCallback(
    (idx: number) => {
      const end = eventsRef.current.find((e) => e.roundIndex === idx && e.type === 'round_end');
      const p = playbackRef.current;
      p.duration = (end?.tMs ?? 60000) + POST_ROUND_MS;
      p.restart();
      rendererRef.current?.load(eventsRef.current, idx, names);
    },
    [names],
  );

  // Clock for the HUD.
  useEffect(() => {
    if (phase !== 'live') return;
    const id = setInterval(() => {
      const p = playbackRef.current;
      setUi({ t: p.t, speed: p.speed, paused: p.paused });
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  // When a round finishes playing, simulate the next one (calls made during the round apply to it).
  useEffect(() => {
    if (phase !== 'live' || advancing.current) return;
    const p = playbackRef.current;
    if (!ui.paused || ui.t < p.duration) return;
    advancing.current = true;
    void (async () => {
      if (done) {
        const r = await getRecap();
        setRecap(r.recap);
        setPhase('recap');
      } else {
        const next = await stepRound();
        eventsRef.current.push(...next.events);
        setDone(next.done);
        if (pendingStance) {
          setStance(pendingStance);
          setPendingStance(null);
        }
        setRound((x) => x + 1);
        loadRound(round + 1);
      }
      advancing.current = false;
    })();
  }, [ui, phase, done, round, loadRound, pendingStance]);

  const call = async (s: Stance) => {
    await instruct(0, s);
    setPendingStance(s === stance ? null : s);
  };
  const simToEnd = async () => {
    setPhase('loading');
    await finishMatch();
    const r = await getRecap();
    setRecap(r.recap);
    setPhase('recap');
  };

  const roundEvents = eventsRef.current.filter((e) => e.roundIndex === round);
  const rs = roundEvents.find((e): e is Extract<MatchEvent, { type: 'round_start' }> => e.type === 'round_start');
  const re = roundEvents.find((e): e is Extract<MatchEvent, { type: 'round_end' }> => e.type === 'round_end');
  const plant = roundEvents.find((e): e is Extract<MatchEvent, { type: 'plant' }> => e.type === 'plant');
  const scores = re && ui.t >= re.tMs ? re.scores : (rs?.scores ?? [0, 0]);
  const clock = plant && ui.t >= plant.tMs ? MR12_STANDARD.timing.bombTimerMs - (ui.t - plant.tMs) : MR12_STANDARD.timing.roundTimeMs - ui.t;
  const myAttack = rs ? rs.attackerTeam === 0 : true;
  const feed = roundEvents
    .filter((e) => e.tMs <= ui.t && (e.type === 'kill' || e.type === 'plant' || e.type === 'defuse' || e.type === 'call' || e.type === 'timeout'))
    .slice(-6)
    .reverse()
    .map((e) => {
      const n = (id: string) => names.get(id) ?? id;
      const text = e.type === 'kill' ? `${n(e.attackerId)} ⟶ ${n(e.victimId)}` : e.type === 'plant' ? `Bomb planted on ${e.site}` : e.type === 'defuse' ? `Defused by ${n(e.playerId)}` : e.type === 'call' ? `${info?.teamNames[e.team]}: “${e.text}”` : e.type === 'timeout' ? `Timeout: ${e.reason}` : '';
      return { key: e.seq, text };
    });

  if (phase === 'recap' && recap && info) return <MatchRecapView recap={recap} info={info} onDone={() => setPhase('setup')} />;

  if (phase === 'setup' || phase === 'loading')
    return (
      <main className="md-setup" data-testid="matchday-setup">
        <header className="md-head">
          <button className="btn btn-ghost" onClick={() => go('title')}>← Back</button>
          <div>
            <div className="eyebrow">Match day</div>
            <h1 className="display md-title">Prepare the match</h1>
          </div>
        </header>
        <div className="md-versus">
          {[{ v: home, set: setHome, label: 'Your team' }, { v: away, set: setAway, label: 'Opponent' }].map((side, i) => (
            <div key={i} className="md-side">
              <Crest id={side.v} size={120} />
              <label className="md-field">
                <span>{side.label}</span>
                <select value={side.v} onChange={(e) => side.set(e.target.value)} data-testid={i === 0 ? 'md-home' : 'md-away'}>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.id === (i === 0 ? away : home)}>
                      {t.name} · {t.strength} OVR
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
          <div className="md-vs display">VS</div>
        </div>
        <label className="md-field md-map">
          <span>Map</span>
          <select value={mapId} onChange={(e) => setMapId(e.target.value)}>
            {maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </label>
        <div className="md-actions">
          <button className="btn btn-primary md-big" disabled={phase === 'loading'} onClick={() => void start('play')} data-testid="md-play">
            Play match
            <small>Watch live, make the calls</small>
          </button>
          <button className="btn md-big" disabled={phase === 'loading'} onClick={() => void start('sim')} data-testid="md-sim">
            Sim match
            <small>Straight to the result</small>
          </button>
        </div>
        {phase === 'loading' && <p className="md-note">Simulating…</p>}
        {err && <p className="md-note md-err">{err}</p>}
      </main>
    );

  return (
    <div className="viewer md-live" data-testid="matchday-live">
      <header className="v-top">
        <button className="btn btn-ghost btn-sm" onClick={() => go('title')}>← Menu</button>
        <div className="v-top-center">
          <span className="v-team v-team-atk"><small className="md-tn">{info?.teamNames[0]}</small>{scores[0]}</span>
          <div className="v-clock">
            <span className="eyebrow">{mapById(info!.mapId).name} · Round {round + 1}</span>
            <span className={`mono v-clock-time ${plant && ui.t >= plant.tMs ? 'is-bomb' : ''}`}>{fmt(clock)}</span>
            <span className="v-clock-sub">{myAttack ? 'You are attacking' : 'You are defending'}</span>
          </div>
          <span className="v-team v-team-def">{scores[1]}<small className="md-tn">{info?.teamNames[1]}</small></span>
        </div>
        <div className="v-top-right">
          <button className="btn btn-sm" onClick={() => void simToEnd()} data-testid="md-simend">Sim to end</button>
        </div>
      </header>
      <div className="md-body">
        <div className="v-stage">
          <div ref={hostRef} className="v-canvas" />
          {re && ui.t >= re.tMs && (
            <div className="v-round-banner">
              <strong>{info?.teamNames[re.winnerTeam]} win the round</strong>
              <span>{re.reason.replace(/_/g, ' ')}</span>
            </div>
          )}
        </div>
        <aside className="md-panel">
          <h3 className="md-h3">Your call</h3>
          <div className="md-stances">
            {STANCES.map((s) => (
              <button key={s.id} className={`md-stance ${(pendingStance ?? stance) === s.id ? 'is-on' : ''}`} onClick={() => void call(s.id)} title={s.help} data-testid={`stance-${s.id}`}>
                <b>{s.label}</b>
                <small>{s.help}</small>
              </button>
            ))}
          </div>
          <p className="md-hint">{pendingStance ? `“${STANCES.find((x) => x.id === pendingStance)!.label}” will be called in the next freeze time.` : `Current plan: ${STANCES.find((x) => x.id === stance)!.label}.`}</p>
          <h3 className="md-h3">Speed</h3>
          <div className="md-speeds">
            {([1, 2, 4] as const).map((s) => (
              <button key={s} className={`btn btn-sm ${ui.speed === s ? 'is-on' : ''}`} onClick={() => (playbackRef.current.speed = s)} data-testid={`speed-${s}`}>{s}x</button>
            ))}
            <button className="btn btn-sm" onClick={() => playbackRef.current.toggle()}>{ui.paused ? '▶' : '❚❚'}</button>
          </div>
          <h3 className="md-h3">This round</h3>
          <ol className="md-feed">{feed.length ? feed.map((f) => <li key={f.key}>{f.text}</li>) : <li className="md-dim">Freeze time…</li>}</ol>
          <p className="md-dim">{rs?.plan && !myAttack ? '' : rs?.plan}</p>
        </aside>
      </div>
    </div>
  );
}
