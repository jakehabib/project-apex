import { useEffect, useState } from 'react';
import { HARBOR } from '../../core/match/maps/harbor';
import type { AppInfo } from '../../shared/ipc';
import { getApi } from '../api';
import { MapLinework } from '../components/MapLinework';
import { openSave } from '../career/CareerSaves';
import type { SaveMeta } from '../career/saves';
import { useNav } from '../state/nav';
import { career } from '../workers/careerClient';
import './title.css';

export function TitleScreen() {
  const go = useNav((s) => s.go);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [latest, setLatest] = useState<SaveMeta | null>(null);
  const [opening, setOpening] = useState(false);
  const api = getApi();

  useEffect(() => {
    void career.saves().then((s) => setLatest(s[0] ?? null)).catch(() => setLatest(null));
  }, []);

  useEffect(() => {
    void api?.appInfo().then(setInfo);
  }, [api]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLButtonElement)) go(latest ? 'career-saves' : 'career-new');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, latest]);

  return (
    <main className="title">
      <div className="title-bg" aria-hidden="true">
        <MapLinework map={HARBOR} className="title-map" />
        <div className="title-scan" />
        <div className="title-vignette" />
      </div>

      <section className="title-content">
        <div className="eyebrow title-eyebrow">Tactical esports management</div>
        <h1 className="title-wordmark display">
          <span>Project</span>
          <span className="title-apex">Apex</span>
        </h1>
        <p className="title-tagline">Build the roster. Call the strategy. Watch the clutch. Create a dynasty.</p>

        <nav className="title-menu" aria-label="Main menu">
          {latest && (
            <button className="btn btn-primary title-cta" autoFocus disabled={opening} onClick={() => { setOpening(true); void openSave(latest.slot).catch(() => setOpening(false)); }} data-testid="menu-continue">
              {opening ? 'Loading…' : 'Continue'} <span className="title-cta-sub">{latest.orgName} · {latest.date}</span>
            </button>
          )}
          <button className={`btn ${latest ? '' : 'btn-primary title-cta'}`} autoFocus={!latest} onClick={() => go('career-new')} data-testid="menu-new-career">
            New Career
          </button>
          <button className="btn" onClick={() => go('career-saves')} data-testid="menu-load">
            Load Career
          </button>
          <div className="title-menu-sep" />
          <button className="btn" onClick={() => go('matchday')} data-testid="menu-matchday">
            Quick Match
          </button>
          <button className="btn" onClick={() => go('world')} data-testid="menu-world">
            World Rankings &amp; Calendar
          </button>
          <button className="btn btn-ghost" onClick={() => go('viewer')} data-testid="menu-viewer">
            Tactical Viewer Proof
          </button>
          <button className="btn btn-ghost" onClick={() => go('systems')} data-testid="menu-systems">
            Systems Check
          </button>
          <button className="btn btn-ghost" onClick={() => go('gallery')} data-testid="menu-gallery">
            Art Gallery
          </button>
          {api && (
            <button className="btn btn-ghost" onClick={() => void api.quit()} title="Quit to desktop">
              Quit
            </button>
          )}
        </nav>

        <div className="title-preview-note">
          <span className="title-badge">Early access build</span>
          Career mode is playable: pick a club, manage the squad and play your matches live. More maps, transfers and screens are on the way.
        </div>
      </section>

      <footer className="title-footer mono">
        <span>v{info?.version ?? '0.0.1'}</span>
        {info && (
          <span>
            Electron {info.electron} · {info.platform}
          </span>
        )}
        {!api && <span className="title-warn">Browser preview: desktop services unavailable</span>}
      </footer>
    </main>
  );
}
