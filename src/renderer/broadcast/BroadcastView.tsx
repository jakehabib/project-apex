/**
 * Broadcast match view: the PixiJS map with a full esports-broadcast HUD around it. All HUD values
 * come from the event log at the current playback time (see hudState.ts).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Stance } from '../../core/match/engine/match';
import type { EventOf, MatchEvent } from '../../core/match/events';
import { mapById } from '../../core/match/maps';
import { crestUrl, iconUrl, portraitUrl } from '../art/generated';
import type { MatchSetupInfo } from '../workers/match.worker';
import { Playback, type Speed } from '../viewer/Playback';
import { BroadcastRenderer } from './BroadcastRenderer';
import { hudAt, roundInfo, type PlayerHud } from './hudState';
import './broadcast.css';

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

/** Icon id for a weapon or equipment id. */
const ICON_OF: Record<string, string> = {
  kraken: 'kraken', sentinel: 'sentinel', galeforce: 'galeforce', ferrum: 'ferrum', lance: 'lance', pike: 'pike',
  mako: 'smg', wasp: 'smg', bastion: 'smg', vanta9: 'pistol', kestrel: 'pistol', talon: 'pistol', ruin50: 'ruin50', breaker: 'breaker',
  smoke: 'smoke', flash: 'flash', frag: 'frag', cinder: 'fire', ember: 'fire',
};
const WEAPON_NAME: Record<string, string> = {
  kraken: 'Kraken AR', sentinel: 'Sentinel M', galeforce: 'Galeforce', ferrum: 'Ferrum', lance: 'Lance', pike: 'Pike', mako: 'Mako', wasp: 'Wasp', bastion: 'Bastion',
  vanta9: 'Vanta 9', kestrel: 'Kestrel P', talon: 'Talon 250', ruin50: 'Ruin .50', breaker: 'Breaker 12', frag: 'Frag', cinder: 'Cinder', ember: 'Ember',
};

function Icon({ id, className, title }: { id: string; className?: string; title?: string }) {
  const url = iconUrl(ICON_OF[id] ?? id);
  if (!url) return <span className={`bc-icon-text ${className ?? ''}`} title={title}>{WEAPON_NAME[id] ?? id}</span>;
  return <img className={`bc-icon ${className ?? ''}`} src={url} alt={title ?? id} title={title ?? WEAPON_NAME[id] ?? id} draggable={false} />;
}

function Crest({ id, size }: { id: string; size: number }) {
  const url = crestUrl(id);
  return url ? <img src={url} width={size} height={size} alt="" draggable={false} /> : <span className="bc-crest-ph" style={{ width: size, height: size }} />;
}

function PlayerCard({ p, name, mirror, selected, onSelect }: { p: PlayerHud; name: string; mirror: boolean; selected: boolean; onSelect: () => void }) {
  const portrait = portraitUrl(p.id);
  const weapon = p.primary ?? p.secondary;
  return (
    <button className={`bc-card side-${p.side} ${p.alive ? '' : 'is-dead'} ${mirror ? 'is-mirror' : ''} ${selected ? 'is-sel' : ''} ${p.flashed ? 'is-flashed' : ''}`} onClick={onSelect} data-testid="bc-card">
      <div className="bc-card-portrait">{portrait ? <img src={portrait} alt="" draggable={false} /> : <span>{name.slice(0, 2).toUpperCase()}</span>}</div>
      <div className="bc-card-main">
        <div className="bc-card-top">
          <b className="bc-card-name">{name}</b>
          {p.bomb && <Icon id="bomb" className="bc-mini is-bomb" title="Carrying the bomb" />}
          {p.kit && <Icon id="kit" className="bc-mini" title="Defuse kit" />}
          <span className="bc-card-kd mono">{p.kills}<i>/</i>{p.deaths}</span>
        </div>
        <div className="bc-card-mid">
          {p.alive ? <Icon id={weapon} className="bc-weapon" /> : <Icon id="skull" className="bc-weapon is-skull" title="Dead" />}
          <span className="bc-card-util">{p.alive && p.utility.map((u, i) => <Icon key={i} id={u} className="bc-mini" />)}</span>
        </div>
        <div className="bc-card-bot">
          <span className="bc-money mono">${p.money.toLocaleString('en-US')}</span>
          {p.roundKills > 0 && <span className="bc-rk">{p.roundKills}K</span>}
          {p.defusing && <span className="bc-tag is-def">DEFUSING</span>}
          {p.planting && <span className="bc-tag is-plant">PLANTING</span>}
          <span className="bc-armor mono">{p.armor > 0 ? (p.helmet ? 'A+H' : 'A') : ''}</span>
          <span className="bc-hp mono">{p.hp}</span>
        </div>
        <div className="bc-hpbar"><i style={{ width: `${p.hp}%` }} /></div>
      </div>
    </button>
  );
}

export interface BroadcastViewProps {
  readonly info: MatchSetupInfo;
  readonly events: readonly MatchEvent[];
  readonly round: number;
  readonly playback: Playback;
  readonly stance: Stance;
  readonly pendingStance: Stance | null;
  readonly onCall: (s: Stance) => void;
  readonly onSimToEnd: () => void;
  readonly onSkipRound: () => void;
  readonly onMenu: () => void;
  readonly seriesLabel?: string;
  /** Re-watching a played map: no manager calls. */
  readonly replay?: boolean;
}

export function BroadcastView(props: BroadcastViewProps) {
  const { info, events, round, playback } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<BroadcastRenderer | null>(null);
  const [t, setT] = useState(0);
  const [ui, setUi] = useState({ speed: playback.speed as Speed, paused: playback.paused });
  const [debug, setDebug] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const names = useMemo(() => new Map(info.players.map((p) => [p.id, p.name])), [info]);
  const map = mapById(info.mapId);

  useEffect(() => {
    const r = new BroadcastRenderer(map, playback);
    rendererRef.current = r;
    let last = 0;
    r.onFrame = (time) => {
      const now = performance.now();
      if (now - last > 90) {
        last = now;
        setT(time);
        setUi({ speed: playback.speed, paused: playback.paused });
      }
    };
    void r.init(hostRef.current!).then(() => r.load(events, round, names));
    return () => {
      r.destroy();
      rendererRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info.mapId]);

  useEffect(() => {
    rendererRef.current?.load(events, round, names);
  }, [events, round, names]);

  useEffect(() => {
    const r = rendererRef.current;
    if (r) {
      r.showDebug = debug;
      r.selectedId = sel;
    }
  }, [debug, sel]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'd' || e.key === 'D') setDebug((x) => !x);
      if (e.key === ' ') {
        e.preventDefault();
        playback.toggle();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [playback]);

  const ri = useMemo(() => roundInfo(events, round), [events, round]);
  const hud = useMemo(() => hudAt(events, round, t, ri), [events, round, t, ri]);
  const team = (i: number) => hud.players.filter((p) => p.team === i);
  const sideOf = (i: number) => (ri.attackerTeam === i ? 'attacker' : 'defender');
  const ended = ri.end && t >= ri.end.tMs;
  const aiNow = (teamIdx: number) => [...events].reverse().find((e): e is EventOf<'ai'> => e.type === 'ai' && e.roundIndex === round && e.team === teamIdx && e.tMs <= t);
  const duration = playback.duration;
  const lastFeed = hud.feed.slice(-5);

  return (
    <div className="bc" data-testid="matchday-live">
      <div className="bc-stage">
        <div ref={hostRef} className="bc-canvas" />

        <header className="bc-score">
          <div className={`bc-score-team side-${sideOf(0)}`}>
            <Crest id={info.teamIds[0]} size={44} />
            <span className="bc-score-name">{info.teamNames[0]}</span>
            <span className="bc-score-num">{hud.scores[0]}</span>
          </div>
          <div className="bc-score-mid">
            <span className="bc-score-round">{map.name} · Round {round + 1}</span>
            <span className={`bc-score-clock mono ${hud.bombPlanted ? 'is-bomb' : ''}`}>{hud.bombPlanted && <Icon id="bomb" className="bc-mini is-bomb" />}{fmt(hud.clock)}</span>
            {props.seriesLabel && <span className="bc-score-series">{props.seriesLabel}</span>}
          </div>
          <div className={`bc-score-team is-right side-${sideOf(1)}`}>
            <span className="bc-score-num">{hud.scores[1]}</span>
            <span className="bc-score-name">{info.teamNames[1]}</span>
            <Crest id={info.teamIds[1]} size={44} />
          </div>
        </header>

        <aside className="bc-panel is-left">
          <div className={`bc-panel-head side-${sideOf(0)}`}>{info.teamNames[0]} <small>{sideOf(0) === 'attacker' ? 'ATTACK' : 'DEFENCE'} · {ri.buyTypes[0]}</small></div>
          {team(0).map((p) => <PlayerCard key={p.id} p={p} name={names.get(p.id) ?? p.id} mirror={false} selected={sel === p.id} onSelect={() => setSel(sel === p.id ? null : p.id)} />)}
        </aside>
        <aside className="bc-panel is-right">
          <div className={`bc-panel-head side-${sideOf(1)}`}>{info.teamNames[1]} <small>{sideOf(1) === 'attacker' ? 'ATTACK' : 'DEFENCE'} · {ri.buyTypes[1]}</small></div>
          {team(1).map((p) => <PlayerCard key={p.id} p={p} name={names.get(p.id) ?? p.id} mirror selected={sel === p.id} onSelect={() => setSel(sel === p.id ? null : p.id)} />)}
        </aside>

        <ol className="bc-feed" aria-label="Kill feed">
          {lastFeed.map((k) => (
            <li key={k.key} className={`bc-feed-item ${t - k.t > 7000 ? 'is-old' : ''}`}>
              <b className={`side-${sideOf(k.killerTeam)}`}>{names.get(k.killerId)}</b>
              {k.assisterId && <span className="bc-feed-assist">+ {names.get(k.assisterId)}</span>}
              <Icon id={k.weapon} className="bc-feed-weapon" />
              {k.headshot && <Icon id="headshot" className="bc-mini" title="Headshot" />}
              {k.trade && <span className="bc-feed-trade">TRADE</span>}
              <b className={`side-${sideOf(k.victimTeam)}`}>{names.get(k.victimId)}</b>
            </li>
          ))}
        </ol>

        {ended && ri.end && (
          <div className={`bc-banner side-${sideOf(ri.end.winnerTeam)}`} key={`banner-${round}`}>
            <Crest id={info.teamIds[ri.end.winnerTeam]!} size={56} />
            <div>
              <strong>{info.teamNames[ri.end.winnerTeam]} win the round</strong>
              <span>{ri.end.reason.replace(/_/g, ' ')}</span>
            </div>
          </div>
        )}

        {debug && (
          <div className="bc-debug" data-testid="bc-debug">
            {[0, 1].map((i) => {
              const a = aiNow(i);
              return (
                <div key={i} className={`bc-debug-team side-${sideOf(i)}`}>
                  <b>{info.teamNames[i]} · {a?.plan ?? '—'}</b>
                  <span>Phase: {a?.phase ?? '—'}</span>
                  <span>{a?.note ?? ''}</span>
                  <span className="mono">Belief A {a?.pressure.find((p) => p.area === 'A')?.value.toFixed(1)} · mid {a?.pressure.find((p) => p.area === 'mid')?.value.toFixed(1)} · B {a?.pressure.find((p) => p.area === 'B')?.value.toFixed(1)}</span>
                </div>
              );
            })}
            <small>Developer tactical overlay (D). Lines: planned destinations by squad; ✕: enemies this team has seen recently.</small>
          </div>
        )}
      </div>

      <footer className="bc-bottom">
        <div className="bc-history" aria-label="Round history">
          {ri.history.map((h, i) => <span key={i} className={`bc-pip team-${h.winner} ${i === 11 ? 'is-half' : ''}`} title={`Round ${i + 1}: ${info.teamNames[h.winner]} (${h.reason.replace(/_/g, ' ')})`} />)}
        </div>
        <div className="bc-timeline" onClick={(e) => {
          const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          playback.seek(((e.clientX - r.left) / r.width) * duration);
        }}>
          <div className="bc-timeline-fill" style={{ width: `${Math.min(100, (t / duration) * 100)}%` }} />
          {ri.markers.map((m, i) => <span key={i} className={`bc-mark kind-${m.kind} team-${m.team ?? 'x'}`} style={{ left: `${(m.t / duration) * 100}%` }} title={m.label} />)}
        </div>
        <div className="bc-controls">
          <button className="bc-btn" onClick={props.onMenu}>Menu</button>
          <button className="bc-btn" onClick={() => playback.seek(0)} title="Replay round">⟲</button>
          <button className="bc-btn is-play" onClick={() => playback.toggle()} data-testid="bc-play">{ui.paused ? '▶' : '❚❚'}</button>
          {([1, 2, 4, 8] as const).map((s) => (
            <button key={s} className={`bc-btn ${ui.speed === s ? 'is-on' : ''}`} onClick={() => (playback.speed = s)} data-testid={`speed-${s}`}>{s}×</button>
          ))}
          <button className="bc-btn" onClick={props.onSkipRound} title="Next round">⏭</button>
          {!props.replay && (
            <>
              <span className="bc-sep" />
              <span className="bc-call-label">Your call</span>
              {(['aggressive', 'balanced', 'passive'] as const).map((s) => (
                <button key={s} className={`bc-btn ${(props.pendingStance ?? props.stance) === s ? 'is-on' : ''}`} onClick={() => props.onCall(s)} data-testid={`stance-${s}`}>{s[0]!.toUpperCase() + s.slice(1)}</button>
              ))}
            </>
          )}
          <span className="bc-sep" />
          <button className={`bc-btn ${debug ? 'is-on' : ''}`} onClick={() => setDebug(!debug)} data-testid="bc-debug-toggle">Tactical overlay</button>
          <button className="bc-btn" onClick={props.onSimToEnd} data-testid="md-simend">{props.replay ? 'End replay' : 'Sim to end'}</button>
        </div>
      </footer>
    </div>
  );
}
