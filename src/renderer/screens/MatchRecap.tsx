import { useState } from 'react';
import type { MapRecap, RecapPlayer } from '../../core/match/stats/recap';
import { mapById } from '../../core/match/maps';
import { crestUrl, portraitUrl } from '../art/generated';
import { PlayerPortrait } from '../components/PlayerPortrait';
import type { MatchSetupInfo } from '../workers/match.worker';

const REASON_ICON: Record<string, string> = { attackers_eliminated: '☠', defenders_eliminated: '☠', bomb_detonated: '✹', bomb_defused: '✂', time_expired: '⏱' };
const tone = (x: number) => (x >= 1.15 ? 'rc-good' : x <= 0.85 ? 'rc-bad' : '');

export function MatchRecapView({ recap, info, onDone }: { recap: MapRecap; info: MatchSetupInfo; onDone: () => void }) {
  const [open, setOpen] = useState<string | null>(null);
  const name = (id: string) => info.players.find((p) => p.id === id)?.name ?? id;
  const role = (id: string) => info.players.find((p) => p.id === id)?.role ?? '';
  const mvp = recap.players.find((p) => p.id === recap.mvpId);
  const mvpTeam = mvp ? info.teamIds[mvp.team]! : '';
  const w = recap.winnerTeam;
  const table = (team: number) => (
    <table className="rc-table">
      <thead>
        <tr>
          <th className="rc-l">{info.teamNames[team]}</th>
          <th>K</th><th>D</th><th>A</th><th>±</th><th>ADR</th><th>KAST</th><th>Open</th><th>Clutch</th><th>T AMR</th><th>CT AMR</th><th>AMR</th>
        </tr>
      </thead>
      <tbody>
        {recap.players.filter((p) => p.team === team).map((p: RecapPlayer) => (
          <tr key={p.id} onClick={() => setOpen(open === p.id ? null : p.id)} className={open === p.id ? 'is-open' : ''}>
            <td className="rc-l rc-name">{name(p.id)}<small>{role(p.id)} · {info.players.find((x) => x.id === p.id)?.ovr ?? '–'} OVR</small></td>
            <td>{p.kills}</td><td>{p.deaths}</td><td>{p.assists}</td>
            <td className={p.kills - p.deaths >= 0 ? 'rc-good' : 'rc-bad'}>{p.kills - p.deaths >= 0 ? '+' : ''}{p.kills - p.deaths}</td>
            <td>{p.amr.adr.toFixed(0)}</td><td>{p.amr.kastPct.toFixed(0)}%</td>
            <td>{p.openingKills}–{p.openingDeaths}</td><td>{p.clutchesWon}</td>
            <td className={p.tSide ? tone(p.tSide.amr) : ''}>{p.tSide ? p.tSide.amr.toFixed(2) : '–'}</td>
            <td className={p.ctSide ? tone(p.ctSide.amr) : ''}>{p.ctSide ? p.ctSide.amr.toFixed(2) : '–'}</td>
            <td className={`rc-amr ${tone(p.amr.amr)}`}>{p.amr.amr.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const sub = open ? recap.players.find((p) => p.id === open) : null;
  return (
    <main className="rc" data-testid="match-recap">
      <header className="rc-head">
        <div className={`rc-team ${w === 0 ? 'is-win' : ''}`}>
          {crestUrl(info.teamIds[0]) && <img src={crestUrl(info.teamIds[0])!} alt="" />}
          <span className="display">{info.teamNames[0]}</span>
        </div>
        <div className="rc-score">
          <span className="eyebrow">{mapById(info.mapId).name} · Full time</span>
          <b className="display mono">{recap.scores[0]} – {recap.scores[1]}</b>
          {recap.halftime && <small className="mono">Half {recap.halftime[0]}–{recap.halftime[1]}</small>}
        </div>
        <div className={`rc-team rc-right ${w === 1 ? 'is-win' : ''}`}>
          <span className="display">{info.teamNames[1]}</span>
          {crestUrl(info.teamIds[1]) && <img src={crestUrl(info.teamIds[1])!} alt="" />}
        </div>
      </header>

      <section className="rc-rounds" aria-label="Round history">
        {recap.rounds.map((r) => (
          <span key={r.index} className={`rc-pip ${r.winnerTeam === 0 ? 'w0' : 'w1'} ${r.index === 12 || (r.index >= 24 && (r.index - 24) % 3 === 0) ? 'rc-gap' : ''}`} title={`Round ${r.index + 1}: ${info.teamNames[r.winnerTeam]} · ${r.reason.replace(/_/g, ' ')} · buys ${r.buyTypes.join(' vs ')}${r.highlight ? ` · ${r.highlight}` : ''}`}>
            {REASON_ICON[r.reason]}
            {r.highlight && <i className="rc-hl" />}
          </span>
        ))}
      </section>

      <div className="rc-grid">
        {mvp && (
          <section className="rc-mvp" data-testid="recap-mvp">
            <div className="rc-mvp-photo">
              {portraitUrl(mvp.id) ? <PlayerPortrait personId={mvp.id} teamId={mvpTeam} name={name(mvp.id)} size={384} /> : <div className="rc-mvp-ph display">{name(mvp.id).slice(0, 2).toUpperCase()}</div>}
            </div>
            <div className="rc-mvp-body">
              <span className="eyebrow">Player of the map</span>
              <b className="display rc-mvp-name">{name(mvp.id)}</b>
              <span className="rc-mvp-amr mono">{mvp.amr.amr.toFixed(2)} AMR</span>
              <div className="rc-mvp-stats mono">
                <span><b>{mvp.kills}–{mvp.deaths}</b>K–D</span>
                <span><b>{mvp.amr.adr.toFixed(0)}</b>ADR</span>
                <span><b>{mvp.amr.kastPct.toFixed(0)}%</b>KAST</span>
                <span><b>{(mvp.amr.swingPerRound * 100).toFixed(1)}%</b>Swing</span>
              </div>
            </div>
          </section>
        )}
        <section className="rc-stories" data-testid="recap-stories">
          <h2 className="rc-h2">Storylines</h2>
          {recap.storylines.slice(0, 8).map((s, i) => (
            <article key={i} className={`rc-story st-${s.kind}`}>
              <b>{s.title}</b>
              <p>{s.text}</p>
            </article>
          ))}
        </section>
        <section className="rc-compare">
          <h2 className="rc-h2">Team comparison</h2>
          {(
            [
              ['Pistol rounds', 'pistolWins'],
              ['T rounds won', 'tRoundsWon'],
              ['CT rounds won', 'ctRoundsWon'],
              ['Bombs planted', 'plants'],
              ['Defuses', 'defuses'],
              ['Eco / force upsets', 'ecoUpsets'],
              ['Longest streak', 'longestStreak'],
            ] as const
          ).map(([label, k]) => {
            const a = recap.teamStats[0]![k];
            const b = recap.teamStats[1]![k];
            const tot = Math.max(1, a + b);
            return (
              <div key={k} className="rc-cmp">
                <span className="mono">{a}</span>
                <div className="rc-cmp-bar"><i className="w0" style={{ width: `${(a / tot) * 100}%` }} /><i className="w1" style={{ width: `${(b / tot) * 100}%` }} /></div>
                <span className="mono">{b}</span>
                <small>{label}</small>
              </div>
            );
          })}
        </section>
      </div>

      <section className="rc-boards">
        {table(0)}
        {table(1)}
        {sub && (
          <div className="rc-sub">
            <b>{name(sub.id)}</b>
            {(['kill', 'swing', 'damage', 'survival', 'kast', 'multi'] as const).map((k) => (
              <span key={k} className={tone(sub.amr[k])}>
                {k === 'multi' ? 'Multi-kill' : k === 'kast' ? 'KAST' : k[0]!.toUpperCase() + k.slice(1)} {sub.amr[k].toFixed(2)}
              </span>
            ))}
            <span>2K {sub.multiKills[0]} · 3K {sub.multiKills[1]} · 4K {sub.multiKills[2]} · Ace {sub.multiKills[3]}</span>
          </div>
        )}
      </section>
      <footer className="rc-foot">
        <button className="btn btn-primary" onClick={onDone} data-testid="recap-done">Continue</button>
      </footer>
    </main>
  );
}
