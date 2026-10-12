import { useEffect, useState } from 'react';
import { HARBOR } from '../../core/match/maps/harbor';
import type { AppInfo } from '../../shared/ipc';
import { getApi } from '../api';
import { MapLinework } from '../components/MapLinework';
import { useNav } from '../state/nav';
import './title.css';

export function TitleScreen() {
  const go = useNav((s) => s.go);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const api = getApi();

  useEffect(() => {
    void api?.appInfo().then(setInfo);
  }, [api]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') go('viewer');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go]);

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
          <button className="btn btn-primary title-cta" autoFocus onClick={() => go('viewer')} data-testid="menu-viewer">
            Tactical Viewer Proof <span className="kbd">Enter</span>
          </button>
          <button className="btn" onClick={() => go('systems')} data-testid="menu-systems">
            Systems Check
          </button>
          <button className="btn btn-ghost" onClick={() => void api?.quit()} disabled={!api} title={api ? 'Quit to desktop' : 'Available in the desktop app'}>
            Quit
          </button>
        </nav>

        <div className="title-preview-note">
          <span className="title-badge">Technical preview</span>
          Phase 0 build: engine, viewer and save system feasibility. Career mode arrives with the Phase 3 vertical slice.
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
