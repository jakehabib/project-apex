import { useCareer } from '../store';
import { Ovr, PageHead, Panel } from '../ui';

export function Results() {
  const v = useCareer((s) => s.view)!;
  const watch = useCareer((s) => s.watch);
  const players = v.squad.filter((p) => p.stats).sort((a, b) => (b.stats!.amr - a.stats!.amr));
  return (
    <div>
      <PageHead eyebrow={`Series ${v.record.series[0]}–${v.record.series[1]} · maps ${v.record.maps[0]}–${v.record.maps[1]}`} title="Results & stats" />
      <Panel title="Player statistics (maps your club played)">
        <table className="tbl">
          <thead><tr><th>Player</th><th className="num">OVR</th><th className="num">Maps</th><th className="num">K</th><th className="num">D</th><th className="num">A</th><th className="num">K/D</th><th className="num">ADR</th><th className="num">AMR</th></tr></thead>
          <tbody>
            {players.length === 0 && <tr><td colSpan={9} className="muted">No maps played yet.</td></tr>}
            {players.map((p) => (
              <tr key={p.id}>
                <td><b>{p.nickname}</b> <small className="muted">{p.role}</small></td>
                <td className="num"><Ovr v={p.ovr} /></td>
                <td className="num">{p.stats!.maps}</td>
                <td className="num">{p.stats!.kills}</td>
                <td className="num">{p.stats!.deaths}</td>
                <td className="num">{p.stats!.assists}</td>
                <td className="num">{(p.stats!.kills / Math.max(1, p.stats!.deaths)).toFixed(2)}</td>
                <td className="num">{p.stats!.adr.toFixed(1)}</td>
                <td className="num"><b>{p.stats!.amr.toFixed(2)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <div className="results">
        {v.results.map((r) => (
          <div key={r.id} className={`res ${r.won === null ? '' : r.won ? 'is-w' : 'is-l'}`}>
            <div className="res-h">
              <span className="res-wl display">{r.won === null ? '…' : r.won ? 'W' : 'L'}</span>
              <div>
                <b>vs {r.opponent} <span className="mono">{r.score}</span></b>
                <small className="muted">{r.date} · {r.event} · {r.stage} · BO{r.bestOf}</small>
              </div>
            </div>
            <ul>
              {r.maps.map((m) => (
                <li key={m.index}>
                  <span className={m.won ? 'up' : 'down'}>{m.won ? 'W' : 'L'}</span>
                  <b>{m.map}</b>
                  <span className="mono">{m.score}</span>
                  {m.mvp && <small className="muted">MVP {m.mvp}</small>}
                  <button className="btn btn-sm" onClick={() => watch(r.id, m.index, `vs ${r.opponent} · ${m.map}`)} data-testid="res-watch">Watch</button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
