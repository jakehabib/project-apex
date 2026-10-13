import { useEffect, useRef, useState } from 'react';
import type { MatchEvent } from '../../core/match/events';
import { BroadcastView } from '../broadcast/BroadcastView';
import '../screens/matchday.css';
import '../screens/viewer.css';
import { Playback } from '../viewer/Playback';
import { career } from '../workers/careerClient';
import type { MatchSetupInfo } from '../workers/match.worker';
import { useCareer } from './store';

const POST_ROUND_MS = 2200;

/** Re-watch a played map: re-simulated from its stored inputs, so it is exactly the map that was played. */
export function Replay() {
  const target = useCareer((s) => s.replay);
  const goPage = useCareer((s) => s.go);
  const [data, setData] = useState<{ info: MatchSetupInfo; events: MatchEvent[]; rounds: number } | null>(null);
  const [round, setRound] = useState(0);
  const pb = useRef(new Playback(60000));

  useEffect(() => {
    if (!target) return;
    void career.rewatch(target.seriesId, target.mapIndex).then((r) => setData({ info: r.info, events: r.events, rounds: r.rounds }));
  }, [target]);

  useEffect(() => {
    if (!data) return;
    const end = data.events.find((e) => e.roundIndex === round && e.type === 'round_end');
    pb.current.duration = (end?.tMs ?? 60000) + POST_ROUND_MS;
    pb.current.restart();
  }, [data, round]);

  useEffect(() => {
    if (!data) return;
    const id = setInterval(() => {
      const p = pb.current;
      if (p.paused && p.t >= p.duration && round < data.rounds - 1) setRound((r) => r + 1);
    }, 150);
    return () => clearInterval(id);
  }, [data, round]);

  if (!data) return <div className="mc-loading"><span className="spin" /> Rebuilding the map from its inputs…</div>;
  return (
    <BroadcastView
      info={data.info}
      events={data.events}
      round={round}
      playback={pb.current}
      stance="balanced"
      pendingStance={null}
      replay
      onCall={() => undefined}
      onSimToEnd={() => goPage('results')}
      onSkipRound={() => setRound((r) => Math.min(data.rounds - 1, r + 1))}
      onMenu={() => goPage('results')}
      {...(target ? { seriesLabel: target.label } : {})}
    />
  );
}
