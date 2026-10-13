import { Crest } from '../../components/Crest';
import { useCareer } from '../store';
import { Ovr, PageHead, Panel, usd, usdK } from '../ui';

export function Dashboard() {
  const v = useCareer((s) => s.view)!;
  const go = useCareer((s) => s.go);
  const h = v.header;
  const me = v.rankings.rows.find((r) => r.orgId === h.orgId);
  const regional = v.rankings.rows.filter((r) => r.region === me?.region).slice(0, 8);
  const upcoming = v.schedule.filter((e) => e.startDay >= h.day && (e.status === 'Directly Invited' || e.status === 'Qualified' || e.status === 'Invite Pending' || e.status === 'Qualifier Available')).slice(0, 4);
  return (
    <div className="dash" data-testid="career-dashboard">
      <PageHead eyebrow={`Season ${h.season} · ${h.date}`} title="Dashboard" />
      <div className="dash-grid">
        <Panel className="dash-next" title={v.pending ? 'Match day' : 'Next up'}>
          {v.pending ? (
            <div className="next-match">
              <div className="nm-teams">
                <Crest id={h.orgId} tag={h.tag} size={72} />
                <span className="display nm-vs">VS</span>
                <Crest id={v.pending.opponent.id} tag={v.pending.opponent.tag} size={72} />
              </div>
              <b>{v.pending.opponent.name}</b>
              <small>{v.pending.event} · {v.pending.stage} · BO{v.pending.bestOf}</small>
              <button className="btn btn-primary" onClick={() => go('match')} data-testid="dash-play">Go to match ▸</button>
            </div>
          ) : h.nextEvent ? (
            <div className="next-match">
              <b className="display nm-event">{h.nextEvent.name}</b>
              <small>Starts {h.nextEvent.date} · in {h.nextEvent.days} day{h.nextEvent.days === 1 ? '' : 's'}</small>
              <p className="muted">Press Continue: the calendar stops on the day of your first match.</p>
            </div>
          ) : (
            <div className="next-match">
              <b>No event booked yet</b>
              <p className="muted">Invitations follow the monthly ranking snapshots; open qualifiers for your region are on the Schedule page.</p>
              <button className="btn" onClick={() => go('schedule')}>Open schedule</button>
            </div>
          )}
        </Panel>
        <Panel title="Record under you">
          <div className="kpis">
            <div><span>Series</span><b className="mono">{v.record.series[0]}–{v.record.series[1]}</b></div>
            <div><span>Maps</span><b className="mono">{v.record.maps[0]}–{v.record.maps[1]}</b></div>
            <div><span>World rank</span><b className="mono">{h.worldRank ? `#${h.worldRank}` : '—'}</b></div>
            <div><span>Trophies</span><b className="mono">{v.record.trophies.length}</b></div>
          </div>
          {v.record.trophies.length > 0 && <p className="trophies">🏆 {v.record.trophies.slice(-3).join(' · ')}</p>}
        </Panel>
        <Panel title="Inbox" action={<button className="link" onClick={() => go('inbox')}>All</button>}>
          <ul className="inbox-mini">
            {v.inbox.slice(0, 5).map((m) => (
              <li key={m.id} className={`ib-${m.kind}`}>
                <b>{m.title}</b>
                <small>{m.text}</small>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Starting five" action={<button className="link" onClick={() => go('squad')}>Squad</button>}>
          <table className="tbl">
            <tbody>
              {v.squad.filter((p) => p.starter).map((p) => (
                <tr key={p.id}>
                  <td><b>{p.nickname}</b> <small className="muted">{p.role}</small></td>
                  <td className="num">{p.age}</td>
                  <td className="num"><Ovr v={p.ovr} /></td>
                  <td className="num muted">{p.stats ? `${p.stats.amr.toFixed(2)} AMR` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
        <Panel title={`${me?.region === 'EU' ? 'Europe' : me?.region === 'AM' ? 'Americas' : 'Asia'} ranking`} action={<button className="link" onClick={() => go('rankings')}>Full</button>}>
          <table className="tbl">
            <tbody>
              {regional.map((r) => (
                <tr key={r.orgId} className={r.orgId === h.orgId ? 'is-me' : ''}>
                  <td className="num">#{r.regionalRank}</td>
                  <td>{r.name}</td>
                  <td className="num mono">{r.arp.toFixed(0)}</td>
                </tr>
              ))}
              {me && !regional.includes(me) && (
                <tr className="is-me"><td className="num">#{me.regionalRank}</td><td>{me.name}</td><td className="num mono">{me.arp.toFixed(0)}</td></tr>
              )}
            </tbody>
          </table>
        </Panel>
        <Panel title="Finances" action={<button className="link" onClick={() => go('finances')}>Details</button>}>
          <div className="kpis">
            <div><span>Cash</span><b className={`mono ${h.cash < 0 ? 'neg' : ''}`}>{usdK(h.cash)}</b></div>
            <div><span>Revenue / mo</span><b className="mono">{usdK(v.finance.revenue)}</b></div>
            <div><span>Payroll / mo</span><b className="mono">{usdK(v.finance.payroll)}</b></div>
            <div><span>Wage room</span><b className={`mono ${v.finance.wageRoom < 0 ? 'neg' : ''}`}>{usd(v.finance.wageRoom)}</b></div>
          </div>
          <p className="muted">State: {v.finance.state}{v.finance.backer ? ` · ${v.finance.backer}` : ''}</p>
        </Panel>
        <Panel title="Upcoming" className="dash-up" action={<button className="link" onClick={() => go('schedule')}>Schedule</button>}>
          <ul className="up-list">
            {upcoming.length === 0 && <li className="muted">Nothing confirmed yet.</li>}
            {upcoming.map((e) => (
              <li key={e.id}>
                <span className={`tier t-${e.tier.replace(/\s/g, '')}`}>{e.tier}</span>
                <b>{e.name}</b>
                <small>{e.start} · {e.status}</small>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
