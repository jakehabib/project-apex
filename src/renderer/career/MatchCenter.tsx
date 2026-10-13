import { useCallback, useEffect, useRef, useState } from 'react';
import type { Stance } from '../../core/match/engine/match';
import type { MatchEvent } from '../../core/match/events';
import type { MapRecap } from '../../core/match/stats/recap';
import { BroadcastView } from '../broadcast/BroadcastView';
import { Crest } from '../components/Crest';
import { MatchRecapView } from '../screens/MatchRecap';
import '../screens/matchday.css';
import '../screens/viewer.css';
import { Playback, type Speed } from '../viewer/Playback';
import { career } from '../workers/careerClient';
import type { MatchSetupInfo } from '../workers/match.worker';
import { useCareer } from './store';
import { Ovr } from './ui';

type Phase = 'preview' | 'loading' | 'live' | 'recap' | 'done';
const POST_ROUND_MS = 2200;

/** The club's pending series: preview, live maps with calls, recaps, and the result. */
export function MatchCenter() {
  const v = useCareer((s) => s.view)!;
  const setView = useCareer((s) => s.setView);
  const goPage = useCareer((s) => s.go);
  const advance = useCareer((s) => s.advance);
  const say = useCareer((s) => s.say);
  const [phase, setPhase] = useState<Phase>(v.pending ? 'preview' : 'done');
  const [info, setInfo] = useState<MatchSetupInfo | null>(null);
  const [recap, setRecap] = useState<MapRecap | null>(null);
  const [last, setLast] = useState(v.pending);
  const eventsRef = useRef<MatchEvent[]>([]);
  const [round, setRound] = useState(0);
  const [done, setDone] = useState(false);
  const [stance, setStance] = useState<Stance>('balanced');
  const [pendingStance, setPendingStance] = useState<Stance | null>(null);
  const [ui, setUi] = useState({ t: 0, speed: 1 as Speed, paused: false });
  const playbackRef = useRef(new Playback(60000));
  const advancing = useRef(false);
  const p = v.pending;

  useEffect(() => {
    if (v.pending) setLast(v.pending);
  }, [v.pending]);

  useEffect(() => {
    useCareer.setState({ immersive: phase === 'live' || phase === 'recap' });
    return () => useCareer.setState({ immersive: false });
  }, [phase]);

  const loadRound = useCallback((idx: number) => {
    const end = eventsRef.current.find((e) => e.roundIndex === idx && e.type === 'round_end');
    const pb = playbackRef.current;
    pb.duration = (end?.tMs ?? 60000) + POST_ROUND_MS;
    pb.restart();
  }, []);

  const startLive = async () => {
    setPhase('loading');
    try {
      const s = await career.mapStart();
      setInfo(s.info);
      eventsRef.current = [...s.events];
      setStance('balanced');
      setPendingStance(null);
      const first = await career.step();
      eventsRef.current.push(...first.events);
      setDone(first.done);
      setRound(0);
      loadRound(0);
      setPhase('live');
    } catch (e) {
      say((e as Error).message, 'bad');
      setPhase('preview');
    }
  };

  const endMap = async () => {
    setPhase('loading');
    const r = await career.mapEnd();
    setInfo(r.info);
    setRecap(r.recap);
    setView(r.view);
    setPhase('recap');
  };

  const simSeries = async () => {
    setPhase('loading');
    try {
      setView(await career.simSeries());
      setPhase('done');
    } catch (e) {
      say((e as Error).message, 'bad');
      setPhase('preview');
    }
  };

  // HUD clock.
  useEffect(() => {
    if (phase !== 'live') return;
    const id = setInterval(() => {
      const pb = playbackRef.current;
      setUi({ t: pb.t, speed: pb.speed, paused: pb.paused });
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  // When a round has played out, simulate the next (a call made during the round applies to it).
  useEffect(() => {
    if (phase !== 'live' || advancing.current) return;
    const pb = playbackRef.current;
    if (!ui.paused || ui.t < pb.duration) return;
    advancing.current = true;
    void (async () => {
      if (done) await endMap();
      else {
        const next = await career.step();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui, phase, done, round, loadRound, pendingStance]);

  if (phase === 'loading') return <div className="mc-loading"><span className="spin" /> Simulating…</div>;

  if (phase === 'live' && info) {
    const score = p ? `${p.score[0]}–${p.score[1]} · BO${p.bestOf}` : undefined;
    return (
      <BroadcastView
        info={info}
        events={eventsRef.current}
        round={round}
        playback={playbackRef.current}
        stance={stance}
        pendingStance={pendingStance}
        onCall={(s) => void career.instruct(s).then(() => setPendingStance(s === stance ? null : s))}
        onSimToEnd={() => void career.finish().then(() => endMap())}
        onSkipRound={() => playbackRef.current.seek(playbackRef.current.duration)}
        onMenu={() => goPage('dashboard')}
        {...(score ? { seriesLabel: score } : {})}
      />
    );
  }

  if (phase === 'recap' && recap && info) {
    return (
      <div className="mc-recap">
        <MatchRecapView recap={recap} info={info} onDone={() => setPhase(v.pending ? 'preview' : 'done')} />
      </div>
    );
  }

  const s = p ?? last;
  if (!s) {
    return (
      <div className="mc-empty">
        <p>No match is waiting.</p>
        <button className="btn" onClick={() => goPage('dashboard')}>Dashboard</button>
      </div>
    );
  }

  if (phase === 'done' || !p) {
    const row = v.results.find((r) => r.id === s.id);
    const won = row?.won ?? false;
    return (
      <div className={`mc-done ${won ? 'is-win' : 'is-loss'}`} data-testid="mc-done">
        <div className="mc-banner display">{won ? 'Victory' : 'Defeat'}</div>
        <div className="mc-vs">
          <Crest id={v.header.orgId} tag={v.header.tag} size={96} />
          <span className="mc-big mono">{row?.score ?? ''}</span>
          <Crest id={s.opponent.id} tag={s.opponent.tag} size={96} />
        </div>
        <p>{s.event} · {s.stage} · vs {s.opponent.name}</p>
        <ul className="mc-maps">{row?.maps.map((m) => <li key={m.index} className={m.won ? 'w' : 'l'}>{m.map} <b className="mono">{m.score}</b>{m.mvp ? <small> · MVP {m.mvp}</small> : null}</li>)}</ul>
        <div className="mc-actions">
          <button className="btn" onClick={() => goPage('results')}>Results</button>
          <button className="btn btn-primary" onClick={() => void advance(31, true).then(() => setPhase(useCareer.getState().view?.pending ? 'preview' : 'done'))} data-testid="mc-continue">Continue ▸</button>
        </div>
      </div>
    );
  }

  const next = p.mapOrder[p.played.length];
  return (
    <div className="mc" data-testid="match-center">
      <div className="mc-hero">
        <div className="mc-event eyebrow">{p.event} · {p.stage} · {p.round} · BO{p.bestOf}</div>
        <div className="mc-vs">
          <div className="mc-team mc-left">
            <Crest id={v.header.orgId} tag={v.header.tag} size={128} />
            <b className="display">{v.header.orgName}</b>
            <small>{v.header.worldRank ? `#${v.header.worldRank} world` : 'Unranked'} · {v.header.ovr} OVR</small>
          </div>
          <div className="mc-mid">
            <span className="mc-big mono">{p.score[0]}–{p.score[1]}</span>
            <span className="display mc-vs-word">VS</span>
          </div>
          <div className="mc-team mc-right">
            <Crest id={p.opponent.id} tag={p.opponent.tag} size={128} />
            <b className="display">{p.opponent.name}</b>
            <small>{p.opponent.rank ? `#${p.opponent.rank} world` : 'Unranked'} · {p.opponent.ovr} OVR</small>
          </div>
        </div>
      </div>
      <div className="mc-body">
        <section className="mc-maplist">
          <h4 className="eyebrow">Maps</h4>
          {p.mapOrder.map((m, i) => {
            const played = p.played[i];
            return (
              <div key={i} className={`mc-map ${i === p.played.length ? 'is-next' : ''} ${played ? (played.won ? 'is-w' : 'is-l') : ''}`}>
                <span className="mc-map-n mono">{i + 1}</span>
                <b>{m.map}</b>
                <small>{m.pickedBy === 'Decider' ? 'Decider' : `${m.pickedBy}'s pick`} · {m.side}</small>
                <span className="mono">{played ? played.score : i === p.played.length ? 'Next' : ''}</span>
              </div>
            );
          })}
        </section>
        <section className="mc-lineups">
          <div>
            <h4 className="eyebrow">Your five</h4>
            {v.squad.filter((x) => x.starter).map((x) => <div key={x.id} className="mc-pl"><span>{x.nickname}</span><small>{x.role}</small><Ovr v={x.ovr} /></div>)}
          </div>
          <div>
            <h4 className="eyebrow">{p.opponent.tag}</h4>
            {p.opponent.players.map((x) => <div key={x.id} className="mc-pl"><span>{x.nickname}</span><small>{x.role}</small><Ovr v={x.ovr} /></div>)}
          </div>
        </section>
      </div>
      <div className="mc-actions">
        <button className="btn btn-primary mc-cta" onClick={() => void startLive()} data-testid="mc-play">
          Play map {p.played.length + 1} live
          <small>{next?.map} · watch and make the calls</small>
        </button>
        <button className="btn mc-cta" onClick={() => void simSeries()} data-testid="mc-sim">
          Simulate {p.played.length ? 'the rest' : 'series'}
          <small>Same engine, straight to the result</small>
        </button>
      </div>
    </div>
  );
}
