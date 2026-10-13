import { Fragment, useState } from 'react';
import { useCareer } from '../store';
import { Ovr, PageHead, usd } from '../ui';
import { PlayerProfile } from './Squad';

export function Market() {
  const v = useCareer((s) => s.view)!;
  const act = useCareer((s) => s.act);
  const busy = useCareer((s) => s.busy);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div>
      <PageHead eyebrow={`Wage room ${usd(v.finance.wageRoom)}/month`} title="Free agents" />
      <p className="muted note">Unattached players can be signed at any time; they ask for their market value, more when other clubs want them. Contracted players move only in the windows (transfer bids arrive with the next update).</p>
      <table className="tbl tbl-big">
        <thead>
          <tr><th>Player</th><th>Role</th><th className="num">Age</th><th className="num">OVR</th><th>Potential</th><th className="num">Asking</th><th /></tr>
        </thead>
        <tbody>
          {v.freeAgents.map((p) => (
            <Fragment key={p.id}>
              <tr className={`row-click ${open === p.id ? 'is-open' : ''}`} onClick={() => setOpen(open === p.id ? null : p.id)}>
                <td><b>{p.nickname}</b> <small className="muted">{p.name} · {p.nationality}</small></td>
                <td>{p.role}</td>
                <td className="num">{p.age}</td>
                <td className="num"><Ovr v={p.ovr} /></td>
                <td>{p.potential}</td>
                <td className="num mono">{usd(p.value)}/mo</td>
                <td className="num">
                  <button className="btn btn-sm" disabled={!!busy || v.header.pending} onClick={(e) => { e.stopPropagation(); void act({ kind: 'sign', playerId: p.id }); }}>Offer contract</button>
                </td>
              </tr>
              {open === p.id && (
                <tr className="tbl-detail"><td colSpan={7}><PlayerProfile p={p} /></td></tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
