import { useCareer } from '../store';
import { PageHead, Panel, usdK } from '../ui';

const STATUS_CLASS: Record<string, string> = {
  'Directly Invited': 'st-ok', Qualified: 'st-ok', 'Invite Pending': 'st-pend', 'Qualifier Available': 'st-qual', 'Below Cutoff': 'st-bad', Ineligible: 'st-bad', Declined: 'st-muted', Completed: 'st-muted', 'Not entered': 'st-muted',
};

export function Schedule() {
  const v = useCareer((s) => s.view)!;
  const act = useCareer((s) => s.act);
  const busy = useCareer((s) => s.busy);
  const months = new Map<string, typeof v.schedule>();
  for (const e of v.schedule) months.set(e.month, [...(months.get(e.month) ?? []), e]);
  return (
    <div>
      <PageHead eyebrow="Calendar" title="Schedule" />
      {v.qualifiers.length > 0 && (
        <Panel title="Open qualifiers in your region">
          <table className="tbl">
            <thead><tr><th>Qualifier</th><th>Date</th><th>For</th><th className="num">Places</th><th>Entry</th><th /></tr></thead>
            <tbody>
              {v.qualifiers.map((q) => (
                <tr key={q.id}>
                  <td>{q.name}</td>
                  <td>{q.date}</td>
                  <td>{q.parent}</td>
                  <td className="num">{q.slots}</td>
                  <td><span className={`pill ${q.entered ? 'pill-ok' : ''}`}>{q.entered ? 'Entering' : 'Not entering'}</span> <small className="muted">{q.note}</small></td>
                  <td className="num">
                    {q.open && !q.blocked && <button className="btn btn-sm" disabled={!!busy} onClick={() => void act({ kind: 'qualifier', eventId: q.id, enter: !q.entered })}>{q.entered ? 'Skip' : 'Enter'}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      {[...months].map(([m, evs]) => (
        <section key={m} className="cal-month">
          <h4 className="eyebrow">{m}</h4>
          {evs.map((e) => (
            <div key={e.id} className={`cal-ev ${e.startDay < v.header.day ? 'is-past' : ''}`}>
              <span className={`tier t-${e.tier.replace(/\s/g, '')}`}>{e.tier}</span>
              <div className="cal-main">
                <b>{e.name}</b>
                <small>{e.start} – {e.end} · {e.location}{e.lan ? ' (LAN)' : ''} · {e.scope} · pool {usdK(e.prizePool)}</small>
                <small className="muted">{e.statusDetail}</small>
              </div>
              <span className={`status ${STATUS_CLASS[e.status] ?? ''}`}>{e.teamPlacement ?? e.status}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
