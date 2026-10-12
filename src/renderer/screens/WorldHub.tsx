import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CalendarEntry, EventDetail, RankRow } from '../../core/competition/views';
import { crestUrl } from '../art/generated';
import { useNav } from '../state/nav';
import { advance, getEvent, getViews, type WorldViews } from '../workers/worldClient';
import './world.css';

type Tab = 'rankings' | 'calendar' | 'forecast' | 'finance';
type ListFilter = 'global' | 'EU' | 'AM' | 'AS';

function TeamBadge({ id, tag }: { id: string; tag: string }) {
  const url = crestUrl(id);
  if (url) return <img className="w-crest" src={url} alt="" draggable={false} />;
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className="w-badge" style={{ background: `hsl(${h} 35% 28%)` }}>
      {tag.slice(0, 3)}
    </span>
  );
}

function Movement({ move }: { move: number | null }) {
  if (move === null) return <span className="w-move w-new">NEW</span>;
  if (move === 0) return <span className="w-move">–</span>;
  return <span className={`w-move ${move > 0 ? 'w-up' : 'w-down'}`}>{move > 0 ? `▲${move}` : `▼${-move}`}</span>;
}

function Spark({ history }: { history: RankRow['history'] }) {
  const pts = history.map((h, i) => ({ i, r: h.rank }));
  const ranks = pts.filter((p) => p.r !== null).map((p) => p.r!);
  if (ranks.length < 2) return <div className="w-spark-empty">Not enough history yet</div>;
  const max = Math.max(...ranks, 10);
  const W = 320;
  const H = 90;
  const x = (i: number) => (i / Math.max(1, history.length - 1)) * (W - 20) + 10;
  const y = (r: number) => 10 + ((r - 1) / Math.max(1, max - 1)) * (H - 20);
  const d = pts.filter((p) => p.r !== null).map((p, k) => `${k ? 'L' : 'M'}${x(p.i).toFixed(1)},${y(p.r!).toFixed(1)}`).join(' ');
  return (
    <svg className="w-spark" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Ranking history">
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" />
      {pts.filter((p) => p.r !== null).map((p) => <circle key={p.i} cx={x(p.i)} cy={y(p.r!)} r="3" fill="var(--accent)" />)}
      <text x="4" y="12" className="w-spark-l">#1</text>
      <text x="4" y={H - 4} className="w-spark-l">#{max}</text>
      <text x={W - 70} y={H - 4} className="w-spark-l">{history[history.length - 1]?.label}</text>
    </svg>
  );
}

const STATUS_CLASS: Record<string, string> = {
  'Directly Invited': 'st-ok', Qualified: 'st-ok', 'Invite Pending': 'st-pend', 'Qualifier Available': 'st-qual', 'Below Cutoff': 'st-bad', Ineligible: 'st-bad', Declined: 'st-muted', Completed: 'st-muted', 'Not entered': 'st-muted',
};

export function WorldHub() {
  const go = useNav((s) => s.go);
  const [orgId, setOrgId] = useState('polararc');
  const [views, setViews] = useState<WorldViews | null>(null);
  const [tab, setTab] = useState<Tab>('rankings');
  const [list, setList] = useState<ListFilter>('global');
  const [sel, setSel] = useState<string | null>(null);
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      setViews(await getViews(orgId));
    } catch (e) {
      setErr((e as Error).message);
    }
    setBusy(false);
  }, [orgId]);
  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    const r = views?.rankings.rows ?? [];
    return list === 'global' ? r : r.filter((x) => x.region === list).sort((a, b) => a.regionalRank - b.regionalRank);
  }, [views, list]);
  const me = views?.rankings.rows.find((r) => r.orgId === orgId);
  const selected = views?.rankings.rows.find((r) => r.orgId === (sel ?? orgId));
  const months = useMemo(() => {
    const m = new Map<string, CalendarEntry[]>();
    for (const e of views?.calendar ?? []) m.set(e.month, [...(m.get(e.month) ?? []), e]);
    return [...m];
  }, [views]);

  const step = async (days: number) => {
    setBusy(true);
    await advance(days);
    await load();
  };

  return (
    <main className="w" data-testid="world-hub">
      <header className="w-head">
        <button className="btn btn-ghost" onClick={() => go('title')}>← Back</button>
        <div>
          <div className="eyebrow">Competitive ecosystem</div>
          <h1 className="w-title display">APEX Ranking Points</h1>
        </div>
        <div className="w-controls">
          <label className="w-field">
            <span>Viewing as</span>
            <select value={orgId} onChange={(e) => setOrgId(e.target.value)} data-testid="team-select">
              {(views?.teams ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.featured ? '★ ' : ''}{t.name}</option>
              ))}
            </select>
          </label>
          <div className="w-date">
            <span className="eyebrow">Today</span>
            <strong>{views?.rankings.today ?? '…'}</strong>
          </div>
          <button className="btn btn-sm" disabled={busy} onClick={() => void step(7)}>+1 week</button>
          <button className="btn btn-sm" disabled={busy} onClick={() => void step(30)} data-testid="advance-month">+1 month</button>
        </div>
      </header>

      {me && (
        <section className="w-me">
          <TeamBadge id={me.orgId} tag={me.tag} />
          <div>
            <strong className="display">{me.name}</strong>
            <span className="w-me-sub">{me.region === 'EU' ? 'Europe' : me.region === 'AM' ? 'Americas' : 'Asia'} · peak #{me.peak}</span>
          </div>
          <div className="w-me-stat"><span>Global</span><b>#{me.globalRank}</b><Movement move={me.move} /></div>
          <div className="w-me-stat"><span>Regional</span><b>#{me.regionalRank}</b></div>
          <div className="w-me-stat"><span>ARP</span><b>{me.arp}</b></div>
          <div className="w-me-stat"><span>Record</span><b>{me.wins}–{me.losses}</b></div>
        </section>
      )}

      <nav className="w-tabs" role="tablist">
        {(['rankings', 'calendar', 'forecast', 'finance'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={`w-tab ${tab === t ? 'is-on' : ''}`} onClick={() => setTab(t)} data-testid={`tab-${t}`}>
            {t === 'rankings' ? 'World Rankings' : t === 'calendar' ? 'Tournament Calendar' : t === 'forecast' ? 'Invitation Forecast' : 'Club Finances'}
          </button>
        ))}
        <span className="w-snap mono">{views?.rankings.snapshotLabel} · next {views?.rankings.nextSnapshot}</span>
      </nav>

      {err && <div className="w-err">World simulation failed: {err}</div>}
      {busy && !views && <div className="w-loading">Simulating the world's competitive history…</div>}

      {views && tab === 'rankings' && (
        <div className="w-split">
          <div className="w-panel">
            <div className="w-filters">
              {(['global', 'EU', 'AM', 'AS'] as const).map((l) => (
                <button key={l} className={`btn btn-sm ${list === l ? 'is-on' : ''}`} aria-pressed={list === l} onClick={() => setList(l)}>
                  {l === 'global' ? 'Global' : l === 'EU' ? 'Europe' : l === 'AM' ? 'Americas' : 'Asia'}
                </button>
              ))}
            </div>
            <table className="w-table" data-testid="rankings-table">
              <thead>
                <tr><th>#</th><th></th><th className="w-l">Team</th><th>Region</th><th>ARP</th><th>W–L</th><th>Peak</th></tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((r) => (
                  <tr key={r.orgId} className={`${r.orgId === orgId ? 'is-me' : ''} ${r.orgId === sel ? 'is-sel' : ''}`} onClick={() => setSel(r.orgId)}>
                    <td className="mono">{list === 'global' ? r.globalRank : r.regionalRank}</td>
                    <td><Movement move={r.move} /></td>
                    <td className="w-l w-teamcell"><TeamBadge id={r.orgId} tag={r.tag} />{r.name}</td>
                    <td>{r.region} #{r.regionalRank}</td>
                    <td className="mono w-arp">{r.arp}</td>
                    <td className="mono">{r.wins}–{r.losses}</td>
                    <td className="mono">#{r.peak}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <aside className="w-panel w-side">
              <div className="w-side-head">
                <TeamBadge id={selected.orgId} tag={selected.tag} />
                <div>
                  <strong className="display">{selected.name}</strong>
                  <span className="w-me-sub">#{selected.globalRank} global · #{selected.regionalRank} {selected.region}</span>
                </div>
              </div>
              <Spark history={selected.history} />
              <p className="w-why">{selected.explanation}</p>
              <h3 className="w-h3">Recent meaningful results</h3>
              <ul className="w-list">{selected.recent.length ? selected.recent.map((x) => <li key={x}>{x}</li>) : <li>No notable finishes yet.</li>}</ul>
              <h3 className="w-h3">Upcoming invitation cutoffs</h3>
              <ul className="w-list">
                {views.rankings.cutoffs.slice(0, 6).map((c) => (
                  <li key={c.eventId}><b>{c.name}</b> · {c.tier} · cutoff {c.cutoffDate} ({c.daysToCutoff} days) · {c.window}</li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      )}

      {views && tab === 'calendar' && (
        <div className="w-cal" data-testid="calendar">
          {months.map(([m, es]) => (
            <section key={m}>
              <h3 className="w-month display">{m}</h3>
              {es.map((e) => (
                <button key={e.id} className={`w-ev tier-${e.tier.replace(/\s/g, '').toLowerCase()}`} onClick={() => void getEvent(e.id, orgId).then(setEvent)} data-testid={`event-${e.id}`}>
                  <span className="w-ev-tier">{e.tier}</span>
                  <span className="w-ev-main">
                    <b>{e.name}</b>
                    <small>{e.start} – {e.end} · {e.scope} · {e.location}{e.lan ? ' · LAN' : ''}</small>
                    <small>{e.cutoff ? `Invitations: ${e.cutoff}` : 'Open entry'}</small>
                  </span>
                  <span className="w-ev-prize mono">${(e.prizePool / 1000).toFixed(0)}k<small>winner ${(e.winnerPrize / 1000).toFixed(0)}k</small></span>
                  <span className={`w-status ${STATUS_CLASS[e.status] ?? ''}`} title={e.statusDetail}>{e.status}{e.teamPlacement ? ` · ${e.teamPlacement}` : ''}</span>
                  <span className="w-ev-win">{e.winner ? `🏆 ${e.winner}` : ''}</span>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}

      {views && tab === 'forecast' && (
        <div className="w-fc" data-testid="forecast">
          {views.forecast.length === 0 && <p className="w-why">No invitation cutoffs relevant to this team in the next four months.</p>}
          {views.forecast.map((f) => (
            <article key={f.eventId} className={`w-fc-card fc-${f.outlook.replace(/\s/g, '').toLowerCase()}`}>
              <header>
                <b>{f.name}</b>
                <span className="w-fc-out">{f.outlook}</span>
              </header>
              <div className="w-fc-grid mono">
                <span>Now<br /><b>{f.currentRank ? `#${f.currentRank}` : '—'}</b></span>
                <span>Invite range<br /><b>{f.window}</b></span>
                <span>Recent reach<br /><b>{f.historical.length ? f.historical.map((h) => `#${h}`).join(' ') : '—'}</b></span>
                <span>Cutoff<br /><b>{f.daysToCutoff} days</b></span>
              </div>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      )}

      {views && tab === 'finance' && <FinancePanel f={views.finance} />}

      {event && (
        <div className="w-drawer-back" onClick={() => setEvent(null)}>
          <aside className="w-drawer" onClick={(e) => e.stopPropagation()} data-testid="event-detail">
            <button className="btn btn-ghost btn-sm w-close" onClick={() => setEvent(null)}>Close</button>
            <h2 className="display">{event.name}</h2>
            <p className="w-for">{event.forTeam}</p>
            <dl className="w-facts">{event.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <h3 className="w-h3">Format</h3>
            <ul className="w-list">{event.format.map((f) => <li key={f}>{f}</li>)}</ul>
            {event.placements.length > 0 && (
              <>
                <h3 className="w-h3">Final standings</h3>
                <ol className="w-list w-places">{event.placements.slice(0, 16).map((p) => <li key={p.team}><span className="mono">{p.place}</span> {p.team}{p.prize ? <span className="mono"> · ${p.prize.toLocaleString('en-US')}</span> : null}</li>)}</ol>
              </>
            )}
            <h3 className="w-h3">Direct invitations</h3>
            <ul className="w-list">{event.invitations.length ? event.invitations.map((i) => <li key={i.team + i.list}><b>#{i.rank} {i.list}</b> {i.team} <em className={`inv-${i.status}`}>{i.status}</em><br /><small>{i.explanation}</small></li>) : <li>Not issued yet (cutoff still ahead) or open event.</li>}</ul>
            {event.skips.length > 0 && (
              <>
                <h3 className="w-h3">Passed over</h3>
                <ul className="w-list">{event.skips.map((k) => <li key={k.team + k.list}>#{k.rank} {k.list} {k.team}: <small>{k.reason}</small></li>)}</ul>
              </>
            )}
            {event.qualifiers.length > 0 && (
              <>
                <h3 className="w-h3">Qualifiers</h3>
                <ul className="w-list">{event.qualifiers.map((q) => <li key={q.name}><b>{q.name}</b> · {q.date} · {q.entrants} teams for {q.slots} place{q.slots > 1 ? 's' : ''}{q.qualified.length ? ` → ${q.qualified.join(', ')}` : ''}</li>)}</ul>
              </>
            )}
          </aside>
        </div>
      )}
      <p className="w-foot">Preview world: background results here are decided by a fast strength-based resolver while career mode is built. In career mode every match is played by the full match engine.</p>
    </main>
  );
}

const usd = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

function FinancePanel({ f }: { f: WorldViews['finance'] }) {
  return (
    <div className="w-fin" data-testid="finance">
      <div className="w-fin-kpis mono">
        <span>Cash<br /><b className={f.cash < 0 ? 'neg' : ''}>{usd(f.cash)}</b></span>
        <span>Revenue<br /><b>{usd(f.revenue)}/mo</b></span>
        <span>Player payroll<br /><b>{usd(f.payroll)}/mo</b></span>
        <span>Wage room<br /><b className={f.wageRoom < 0 ? 'neg' : ''}>{usd(f.wageRoom)}/mo</b></span>
        <span>Prestige<br /><b>{f.prestige}</b></span>
        <span>State<br /><b>{f.state}</b></span>
      </div>
      {f.backer && <p className="w-why">Backing: {f.backer}</p>}
      <div className="w-fin-cols">
        <section>
          <h3 className="w-h3">Contracts</h3>
          <table className="w-table">
            <thead><tr><th>Player</th><th>Role</th><th>OVR</th><th>Age</th><th>Wage</th><th>Market value</th><th>Until</th><th>Release clause</th></tr></thead>
            <tbody>
              {f.contracts.map((c) => (
                <tr key={c.nickname} className={c.bench ? 'muted' : ''}>
                  <td><b>{c.nickname}</b>{c.bench ? ' (bench)' : ''}</td><td>{c.role}</td><td className="mono">{c.ovr}</td><td className="mono">{c.age}</td>
                  <td className="mono">{usd(c.monthly)}</td><td className={`mono ${c.value >= c.monthly * 1.5 ? 'pos' : ''}`}>{usd(c.value)}</td><td>{c.until}</td><td className="mono">{c.buyout ? usd(c.buyout) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="w-h3">Commitments under contract</h3>
          <ul className="w-list mono">{f.commitments.map((c) => <li key={c.season}>Season {c.season}: {usd(c.amount)}</li>)}</ul>
          <p className="w-why">Transfers, last 12 months: paid {usd(f.transfers12m.paid)} · received {usd(f.transfers12m.received)}</p>
        </section>
        <section>
          <h3 className="w-h3">Cash projection (current contracts, no prize money)</h3>
          <table className="w-table mono">
            <thead><tr><th>Month</th><th>Payroll</th><th>Backer</th><th>Cash</th></tr></thead>
            <tbody>{f.projection.map((m) => <tr key={m.label}><td>{m.label}</td><td>{usd(m.payroll)}</td><td>{m.subsidy ? usd(m.subsidy) : '—'}</td><td className={m.cash < 0 ? 'neg' : ''}>{usd(m.cash)}</td></tr>)}</tbody>
          </table>
          <h3 className="w-h3">Recent deals</h3>
          <ul className="w-list">{f.deals.length ? f.deals.map((d, i) => <li key={i}><b>{d.date}</b> {d.text}<br /><small>{d.notes.join(' → ')}</small></li>) : <li>No deals yet.</li>}</ul>
          <h3 className="w-h3">Ledger</h3>
          <ul className="w-list mono">{f.ledger.map((e, i) => <li key={i}>{e.date} · {e.memo}: <b className={e.amount < 0 ? 'neg' : 'pos'}>{usd(e.amount)}</b></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
