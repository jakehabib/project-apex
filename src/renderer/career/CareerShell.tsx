import { useEffect } from 'react';
import { Crest } from '../components/Crest';
import { useNav } from '../state/nav';
import { MatchCenter } from './MatchCenter';
import { Replay } from './Replay';
import { Dashboard } from './pages/Dashboard';
import { Finances } from './pages/Finances';
import { Inbox } from './pages/Inbox';
import { Market } from './pages/Market';
import { Rankings } from './pages/Rankings';
import { Results } from './pages/Results';
import { Schedule } from './pages/Schedule';
import { Settings } from './pages/Settings';
import { Squad } from './pages/Squad';
import { Tactics } from './pages/Tactics';
import { useCareer, type Page } from './store';
import { usd } from './ui';
import './career.css';

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '◆' },
  { id: 'inbox', label: 'Inbox', icon: '✉' },
  { id: 'squad', label: 'Squad', icon: '☰' },
  { id: 'market', label: 'Free agents', icon: '⇄' },
  { id: 'tactics', label: 'Tactics', icon: '⌖' },
  { id: 'schedule', label: 'Schedule', icon: '▦' },
  { id: 'rankings', label: 'Rankings', icon: '▲' },
  { id: 'results', label: 'Results & stats', icon: '★' },
  { id: 'finances', label: 'Finances', icon: '$' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export function CareerShell() {
  const go = useNav((s) => s.go);
  const { view, page, busy, toast, immersive } = useCareer();
  const setPage = useCareer((s) => s.go);
  const advance = useCareer((s) => s.advance);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => useCareer.setState((s) => (s.toast?.id === toast.id ? { toast: null } : s)), toast.notes ? 9000 : 4200);
    return () => clearTimeout(id);
  }, [toast]);

  if (!view) {
    return (
      <main className="cn">
        <p className="cn-loading">No career loaded.</p>
        <button className="btn" onClick={() => go('title')}>Back to title</button>
      </main>
    );
  }
  const h = view.header;
  const inMatch = immersive || page === 'replay';
  const cont = () => (h.pending ? setPage('match') : void advance(31, true));

  return (
    <div className={`shell ${inMatch ? 'is-match' : ''}`} data-testid="career-shell">
      {!inMatch && (
      <header className="topbar">
        <button className="tb-club" onClick={() => setPage('dashboard')}>
          <Crest id={h.orgId} tag={h.tag} size={34} />
          <span>
            <b>{h.orgName}</b>
            <small>{h.region} · Squad {h.ovr} OVR</small>
          </span>
        </button>
        <div className="tb-stats">
          <div><span>Date</span><b data-testid="tb-date">{h.date}</b></div>
          <div><span>World rank</span><b className="mono">{h.worldRank ? `#${h.worldRank}` : '—'}</b></div>
          <div><span>Cash</span><b className={`mono ${h.cash < 0 ? 'neg' : ''}`}>{usd(h.cash)}</b></div>
          <div className="tb-next"><span>Next event</span><b>{h.nextEvent ? `${h.nextEvent.name} · ${h.nextEvent.days === 0 ? 'today' : `${h.nextEvent.days}d`}` : 'None booked'}</b></div>
        </div>
        <div className="tb-actions">
          {!h.pending && <button className="btn btn-ghost" disabled={!!busy} onClick={() => void advance(1, false)} title="Advance one day">+1d</button>}
          <button className={`btn btn-primary tb-continue ${h.pending ? 'is-match' : ''}`} disabled={!!busy} onClick={cont} data-testid="tb-continue">
            {busy ? <span className="spin" /> : null}
            {h.pending ? 'Match day ▸' : busy ? 'Simulating' : 'Continue ▸'}
          </button>
        </div>
      </header>
      )}
      {!inMatch && (
        <nav className="sidenav" aria-label="Career">
          {NAV.map((n) => (
            <button key={n.id} className={`sn-item ${page === n.id ? 'is-on' : ''}`} onClick={() => setPage(n.id)} data-testid={`nav-${n.id}`}>
              <i>{n.icon}</i>
              {n.label}
              {n.id === 'inbox' && view.inbox.length > 0 && <em>{Math.min(99, view.inbox.length)}</em>}
            </button>
          ))}
          {h.pending && (
            <button className="sn-item sn-match" onClick={() => setPage('match')}>
              <i>●</i>Match day
            </button>
          )}
          <div className="sn-foot">
            <button className="sn-item" onClick={() => go('title')}><i>⏏</i>Main menu</button>
          </div>
        </nav>
      )}
      <main className={`page page-${page}`} key={page}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'inbox' && <Inbox />}
        {page === 'squad' && <Squad />}
        {page === 'market' && <Market />}
        {page === 'tactics' && <Tactics />}
        {page === 'schedule' && <Schedule />}
        {page === 'rankings' && <Rankings />}
        {page === 'results' && <Results />}
        {page === 'finances' && <Finances />}
        {page === 'settings' && <Settings />}
        {page === 'match' && <MatchCenter />}
        {page === 'replay' && <Replay />}
      </main>
      {toast && (
        <div key={toast.id} className={`toast toast-${toast.tone}`} role="status" onClick={() => useCareer.setState({ toast: null })}>
          {toast.text}
          {toast.notes && <ul>{toast.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
        </div>
      )}
    </div>
  );
}
