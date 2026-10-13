import { useEffect, useMemo, useState } from 'react';
import { Crest } from '../components/Crest';
import { useNav } from '../state/nav';
import { career, type TeamPick } from '../workers/careerClient';
import { useCareer } from './store';
import './career.css';

const randomSeed = () => {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return `world-${a[0]!.toString(36)}`;
};
const usd = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const REGIONS = ['All', 'Europe', 'Americas', 'Asia'] as const;
const LEVEL: Record<string, string> = { elite: 'Elite', contender: 'Contender', developing: 'Developing', grassroots: 'Grassroots' };

export function CareerNew() {
  const go = useNav((s) => s.go);
  const setView = useCareer((s) => s.setView);
  const goPage = useCareer((s) => s.go);
  const [seed, setSeed] = useState(randomSeed);
  const [teams, setTeams] = useState<TeamPick[] | null>(null);
  const [region, setRegion] = useState<(typeof REGIONS)[number]>('All');
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setTeams(null);
    void career.teams(seed).then((t) => {
      setTeams(t);
      setSel((s) => s ?? t[0]?.id ?? null);
    }).catch((e: Error) => setErr(e.message));
  }, [seed]);

  const shown = useMemo(() => (teams ?? []).filter((t) => region === 'All' || t.region === region), [teams, region]);
  const pick = teams?.find((t) => t.id === sel) ?? null;

  const start = async () => {
    if (!pick) return;
    setBusy(true);
    setErr(null);
    try {
      const slot = `career-${Date.now().toString(36)}`;
      setView(await career.create(seed, pick.id, slot));
      goPage('dashboard');
      go('career');
    } catch (e) {
      setErr((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <main className="cn" data-testid="career-new">
      <header className="cn-head">
        <button className="btn btn-ghost" onClick={() => go('title')}>← Back</button>
        <div>
          <div className="eyebrow">New career</div>
          <h1 className="display cn-title">Choose your club</h1>
        </div>
        <label className="cn-seed">
          <span className="eyebrow">World seed</span>
          <input value={seed} onChange={(e) => setSeed(e.target.value.trim() || randomSeed())} spellCheck={false} />
          <button className="btn btn-ghost" onClick={() => setSeed(randomSeed())} title="New world">↻</button>
        </label>
      </header>
      <div className="cn-body">
        <section className="cn-list">
          <div className="cn-tabs">
            {REGIONS.map((r) => <button key={r} className={`chip ${region === r ? 'is-on' : ''}`} onClick={() => setRegion(r)}>{r}</button>)}
          </div>
          {!teams && <div className="cn-loading">Building the world…</div>}
          <div className="cn-grid">
            {shown.map((t, i) => (
              <button key={t.id} className={`cn-card ${sel === t.id ? 'is-sel' : ''}`} style={{ animationDelay: `${Math.min(i, 24) * 18}ms` }} onClick={() => setSel(t.id)} data-testid="cn-team">
                <Crest id={t.id} tag={t.tag} size={44} />
                <div className="cn-card-main">
                  <b>{t.name}</b>
                  <small>{t.region} · {LEVEL[t.archetype]}</small>
                </div>
                <span className="cn-ovr mono">{t.ovr}</span>
              </button>
            ))}
          </div>
        </section>
        <aside className="cn-detail">
          {pick && (
            <div key={pick.id} className="cn-detail-in">
              <Crest id={pick.id} tag={pick.tag} size={132} className="cn-big-crest" />
              <h2 className="display">{pick.name}</h2>
              <div className="cn-facts">
                <div><span>Region</span><b>{pick.region}</b></div>
                <div><span>Level</span><b>{LEVEL[pick.archetype]}</b></div>
                <div><span>Squad OVR</span><b className="mono">{pick.ovr}</b></div>
                <div><span>Cash</span><b className="mono">{usd(pick.money)}</b></div>
              </div>
              <p className="cn-expect"><span className="eyebrow">Board expectation</span>{pick.expectation}</p>
              <p className="cn-stars"><span className="eyebrow">Key players</span>{pick.stars.join(' · ')}</p>
              <button className="btn btn-primary cn-go" disabled={busy || !teams} onClick={() => void start()} data-testid="cn-start">
                {busy ? 'Simulating world history…' : `Take charge of ${pick.name}`}
              </button>
              {err && <p className="cn-err">{err}</p>}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
