import { Fragment, useState } from 'react';
import { useCareer } from '../store';
import { PageHead } from '../ui';

type List = 'global' | 'EU' | 'AM' | 'AS';
const LABEL: Record<List, string> = { global: 'Global', EU: 'Europe', AM: 'Americas', AS: 'Asia' };

export function Rankings() {
  const v = useCareer((s) => s.view)!;
  const [list, setList] = useState<List>('global');
  const [open, setOpen] = useState<string | null>(null);
  const rows = v.rankings.rows.filter((r) => list === 'global' || r.region === list).slice(0, 60);
  const me = v.rankings.rows.find((r) => r.orgId === v.header.orgId);
  return (
    <div>
      <PageHead eyebrow={`${v.rankings.snapshotLabel} snapshot · next ${v.rankings.nextSnapshot}`} title="Apex Ranking Points">
        <div className="cn-tabs">{(Object.keys(LABEL) as List[]).map((l) => <button key={l} className={`chip ${list === l ? 'is-on' : ''}`} onClick={() => setList(l)}>{LABEL[l]}</button>)}</div>
      </PageHead>
      {me && <p className="note">You: #{me.globalRank} world · #{me.regionalRank} {LABEL[me.region as List]} · {me.arp.toFixed(0)} ARP. {me.explanation}</p>}
      <table className="tbl tbl-big">
        <thead><tr><th className="num">#</th><th>Team</th><th className="num">ARP</th><th className="num">W–L</th><th className="num">Peak</th><th>Recent</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <Fragment key={r.orgId}>
              <tr className={`row-click ${r.orgId === v.header.orgId ? 'is-me' : ''}`} onClick={() => setOpen(open === r.orgId ? null : r.orgId)}>
                <td className="num">{list === 'global' ? r.globalRank : r.regionalRank} <small className={r.move === null ? 'muted' : r.move > 0 ? 'up' : r.move < 0 ? 'down' : 'muted'}>{r.move === null ? 'new' : r.move > 0 ? `▲${r.move}` : r.move < 0 ? `▼${-r.move}` : ''}</small></td>
                <td><b>{r.name}</b> <small className="muted">{r.region}</small></td>
                <td className="num mono">{r.arp.toFixed(0)}</td>
                <td className="num">{r.wins}–{r.losses}</td>
                <td className="num">#{r.peak}</td>
                <td><small className="muted">{r.recent.slice(0, 2).join(' · ')}</small></td>
              </tr>
              {open === r.orgId && <tr className="tbl-detail"><td colSpan={6}><p className="note">{r.explanation}</p></td></tr>}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
