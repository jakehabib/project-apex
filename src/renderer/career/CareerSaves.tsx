import { useEffect, useRef, useState } from 'react';
import { Crest } from '../components/Crest';
import { useNav } from '../state/nav';
import type { SaveMeta } from './saves';
import { career } from '../workers/careerClient';
import { useCareer } from './store';
import './career.css';

const ago = (t: number) => {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
};

/** Opens a save and enters the career. Shared by the title screen's Continue. */
export async function openSave(slot: string): Promise<boolean> {
  const r = await career.load(slot);
  const st = useCareer.getState();
  st.setView(r.view);
  st.go(r.view.header.pending ? 'match' : 'dashboard');
  if (r.restoredFromBackup) st.say('The latest save was damaged; your previous save was restored.', 'bad');
  useNav.getState().go('career');
  return true;
}

export function CareerSaves() {
  const go = useNav((s) => s.go);
  const [saves, setSaves] = useState<SaveMeta[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void career.saves().then(setSaves).catch((e: Error) => setErr(e.message));
  }, []);

  const load = async (slot: string) => {
    setErr(null);
    try {
      await openSave(slot);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const importFile = async (f: File) => {
    try {
      setSaves(await career.importSave(f, `career-${Date.now().toString(36)}`));
    } catch (e) {
      setErr(`Could not import: ${(e as Error).message}`);
    }
  };

  return (
    <main className="cs" data-testid="career-saves">
      <header className="cn-head">
        <button className="btn btn-ghost" onClick={() => go('title')}>← Back</button>
        <div>
          <div className="eyebrow">Careers</div>
          <h1 className="display cn-title">Load career</h1>
        </div>
        <div className="cs-tools">
          <button className="btn" onClick={() => file.current?.click()}>Import save file</button>
          <input ref={file} type="file" accept=".apexsave,application/gzip" hidden onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
          <button className="btn btn-primary" onClick={() => go('career-new')}>New career</button>
        </div>
      </header>
      {err && <p className="cn-err cs-err">{err}</p>}
      <div className="cs-list">
        {saves?.length === 0 && <div className="cs-empty">No careers yet. Start one and it saves automatically.</div>}
        {saves?.map((s, i) => (
          <div key={s.slot} className="cs-row" style={{ animationDelay: `${i * 40}ms` }}>
            <Crest id={s.orgId} tag={s.orgName.slice(0, 3).toUpperCase()} size={52} />
            <div className="cs-main">
              <b>{s.orgName}</b>
              <small>{s.date} · Season {s.season} · saved {ago(s.savedAt)} · {(s.bytes / 1e6).toFixed(1)} MB</small>
            </div>
            {confirm === s.slot ? (
              <>
                <span className="cs-warn">Delete this career for good?</span>
                <button className="btn btn-danger" onClick={() => void career.remove(s.slot).then(setSaves).then(() => setConfirm(null))}>Delete</button>
                <button className="btn btn-ghost" onClick={() => setConfirm(null)}>Keep</button>
              </>
            ) : (
              <>
                <button className="btn btn-ghost" onClick={() => setConfirm(s.slot)}>Delete</button>
                <button className="btn btn-primary" onClick={() => void load(s.slot)} data-testid="cs-load">Continue</button>
              </>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
