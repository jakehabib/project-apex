import { useCallback, useEffect, useRef, useState } from 'react';
import type { Stance } from '../../core/match/engine/match';
import type { MatchEvent } from '../../core/match/events';
import type { MapRecap } from '../../core/match/stats/recap';
import { crestUrl } from '../art/generated';
import { useNav } from '../state/nav';
import { Playback, type Speed } from '../viewer/Playback';
import { BroadcastView } from '../broadcast/BroadcastView';
import { finishMatch, getRecap, instruct, listTeams, setupMatch, stepRound, type TeamOption } from '../workers/matchClient';
import type { MatchSetupInfo } from '../workers/match.worker';
import { MatchRecapView } from './MatchRecap';
import './matchday.css';
import './viewer.css';

type Phase = 'setup' | 'loading' | 'live' | 'recap';
const POST_ROUND_MS = 2200;
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
  const playbackRef = useRef(new Playback(60000));
  const advancing = useRef(false);

  useEffect(() => {
    void listTeams().then((r) => {
      setTeams(r.teams);
      setMaps(r.maps);
    });
  }, []);


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
      loadRound(0);
      setPhase('live');
    } catch (e) {
      setErr((e as Error).message);
      setPhase('setup');
    }
  };

  const loadRound = useCallback((idx: number) => {
    const end = eventsRef.current.find((e) => e.roundIndex === idx && e.type === 'round_end');
    const p = playbackRef.current;
    p.duration = (end?.tMs ?? 60000) + POST_ROUND_MS;
    p.restart();
  }, []);

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
    <BroadcastView
      info={info!}
      events={eventsRef.current}
      round={round}
      playback={playbackRef.current}
      stance={stance}
      pendingStance={pendingStance}
      onCall={(s) => void call(s)}
      onSimToEnd={() => void simToEnd()}
      onSkipRound={() => playbackRef.current.seek(playbackRef.current.duration)}
      onMenu={() => go('title')}
    />
  );
}
