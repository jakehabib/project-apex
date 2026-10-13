import { Fragment, useState } from 'react';
import type { PlayerRow } from '../../../core/career/views';
import { portraitUrl } from '../../art/generated';
import { useCareer } from '../store';
import { Bar, Ovr, PageHead, usd } from '../ui';

const ATTR_LABEL: Record<string, string> = {
  rifling: 'Rifling', awp: 'AWP', opening: 'Opening', positioning: 'Positioning', utility: 'Utility', gameSense: 'Game sense', teamwork: 'Teamwork', clutch: 'Clutch', calling: 'Calling', adaptability: 'Adaptability',
};

export function PlayerProfile({ p, children }: { p: PlayerRow; children?: React.ReactNode }) {
  const portrait = portraitUrl(p.id);
  return (
    <div className="profile">
      <div className="pf-id">
        {portrait ? <img src={portrait} alt="" className="pf-portrait" draggable={false} /> : <span className="pf-portrait pf-ph">{p.nickname.slice(0, 2).toUpperCase()}</span>}
        <div>
          <b className="display">{p.nickname}</b>
          <small>{p.name} · {p.nationality} · {p.age}</small>
          <small>{p.role} · {p.tier} · Potential: {p.potential}</small>
        </div>
      </div>
      <div className="pf-attrs">
        {Object.entries(p.attrs).map(([k, x]) => (
          <div key={k} className="pf-attr"><span>{ATTR_LABEL[k] ?? k}</span><Bar v={x} /><b className="mono">{x}</b></div>
        ))}
      </div>
      <div className="pf-side">
        <div className="kpis kpis-2">
          <div><span>Wage</span><b className="mono">{p.monthly ? `${usd(p.monthly)}/mo` : '—'}</b></div>
          <div><span>Market value</span><b className="mono">{usd(p.value)}/mo</b></div>
          <div><span>Contract until</span><b className={p.expiresSoon ? 'warn' : ''}>{p.contractUntil}</b></div>
          <div><span>Career maps (you)</span><b className="mono">{p.stats?.maps ?? 0}</b></div>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Squad() {
  const v = useCareer((s) => s.view)!;
  const act = useCareer((s) => s.act);
  const busy = useCareer((s) => s.busy);
  const [open, setOpen] = useState<string | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [confirmRelease, setConfirmRelease] = useState<string | null>(null);
  const starters = v.squad.filter((p) => p.starter);
  const locked = v.header.pending;

  return (
    <div data-testid="career-squad">
      <PageHead eyebrow={`${starters.length}/5 starters · ${v.squad.length - starters.length} on the bench`} title="Squad">
        {locked && <span className="pill pill-warn">Squad locked until the match is played</span>}
      </PageHead>
      <table className="tbl tbl-big">
        <thead>
          <tr>
            <th>Player</th><th>Role</th><th className="num">Age</th><th className="num">OVR</th><th>Potential</th><th className="num">Wage</th><th>Contract</th>
            <th className="num">Maps</th><th className="num">K–D</th><th className="num">ADR</th><th className="num">AMR</th>
          </tr>
        </thead>
        <tbody>
          {v.squad.map((p, i) => (
            <Fragment key={p.id}>
              {i === starters.length && <tr className="tbl-sep"><td colSpan={11}>Bench</td></tr>}
              <tr className={`row-click ${open === p.id ? 'is-open' : ''}`} onClick={() => setOpen(open === p.id ? null : p.id)} data-testid="squad-row">
                <td><b>{p.nickname}</b> <small className="muted">{p.name}</small></td>
                <td>{p.role}</td>
                <td className="num">{p.age}</td>
                <td className="num"><Ovr v={p.ovr} /></td>
                <td>{p.potential}</td>
                <td className="num mono">{usd(p.monthly)}</td>
                <td className={p.expiresSoon ? 'warn' : ''}>{p.contractUntil}</td>
                <td className="num">{p.stats?.maps ?? '—'}</td>
                <td className="num">{p.stats ? `${p.stats.kills}–${p.stats.deaths}` : '—'}</td>
                <td className="num">{p.stats?.adr.toFixed(1) ?? '—'}</td>
                <td className="num">{p.stats?.amr.toFixed(2) ?? '—'}</td>
              </tr>
              {open === p.id && (
                <tr className="tbl-detail">
                  <td colSpan={11}>
                    <PlayerProfile p={p}>
                      <div className="pf-actions">
                        {p.starter ? (
                          <button className="btn" disabled={!!busy || locked} onClick={() => void act({ kind: 'bench', playerId: p.id })}>Move to bench</button>
                        ) : starters.length < 5 ? (
                          <button className="btn btn-primary" disabled={!!busy || locked} onClick={() => void act({ kind: 'promote', playerId: p.id })}>Start</button>
                        ) : swapFor === p.id ? (
                          <span className="swap">
                            Replace:
                            {starters.map((s) => (
                              <button key={s.id} className="chip" disabled={!!busy} onClick={() => void act({ kind: 'swap', starterId: s.id, benchId: p.id }).then(() => setSwapFor(null))}>{s.nickname}</button>
                            ))}
                          </span>
                        ) : (
                          <button className="btn btn-primary" disabled={!!busy || locked} onClick={() => setSwapFor(p.id)}>Start…</button>
                        )}
                        <button className="btn" disabled={!!busy} onClick={() => void act({ kind: 'extend', playerId: p.id })}>Offer extension</button>
                        {confirmRelease === p.id ? (
                          <button className="btn btn-danger" disabled={!!busy || locked} onClick={() => void act({ kind: 'release', playerId: p.id }).then(() => setConfirmRelease(null))}>Confirm release</button>
                        ) : (
                          <button className="btn btn-ghost" disabled={!!busy || locked} onClick={() => setConfirmRelease(p.id)}>Release…</button>
                        )}
                      </div>
                    </PlayerProfile>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
      <p className="muted note">Changing three or more of the five who earned an event place breaks roster continuity: the place is lost. Rankings belong to the core of the roster.</p>
    </div>
  );
}
