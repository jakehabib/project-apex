import { useCallback, useEffect, useState } from 'react';
import { HARBOR } from '../../core/match/maps/harbor';
import { runMovementProof } from '../../core/match/spike/movementProof';
import { canonicalJson } from '../../core/util/hash';
import type { SaveSnapshot } from '../../shared/ipc';
import { getApi } from '../api';
import { useNav } from '../state/nav';
import { simulate } from '../workers/simClient';
import './systems.css';

type Status = 'pending' | 'pass' | 'warn' | 'fail' | 'skip';
interface Check {
  readonly id: string;
  readonly label: string;
  status: Status;
  detail: string;
}

const SMOKE_SLOT = 'phase0-smoke';

const initial = (): Check[] => [
  { id: 'isolation', label: 'Renderer isolation', status: 'pending', detail: '' },
  { id: 'determinism', label: 'Deterministic simulation (worker vs. UI thread)', status: 'pending', detail: '' },
  { id: 'seeds', label: 'Seed sensitivity', status: 'pending', detail: '' },
  { id: 'gpu', label: 'Hardware-accelerated 2D rendering', status: 'pending', detail: '' },
  { id: 'save', label: 'SQLite save round-trip', status: 'pending', detail: '' },
  { id: 'restart', label: 'Save survives restart', status: 'pending', detail: '' },
];

export function SystemsCheck() {
  const go = useNav((s) => s.go);
  const [checks, setChecks] = useState<Check[]>(initial);
  const [running, setRunning] = useState(false);

  const set = (id: string, status: Status, detail: string) =>
    setChecks((cs) => cs.map((c) => (c.id === id ? { ...c, status, detail } : c)));

  const run = useCallback(async () => {
    setRunning(true);
    setChecks(initial());
    const api = getApi();

    // 1. Isolation: the page must not reach Node or Electron internals.
    const w = window as unknown as Record<string, unknown>;
    const leaks = ['require', 'process', 'module', 'Buffer', 'global'].filter((k) => typeof w[k] !== 'undefined');
    const apiKeys = api ? Object.keys(api).sort().join(',') : '';
    if (!api) set('isolation', 'skip', 'Not running inside the desktop shell.');
    else if (leaks.length) set('isolation', 'fail', `Exposed globals: ${leaks.join(', ')}`);
    else {
      const info = await api.appInfo();
      const ok = info.security.contextIsolation && !info.security.nodeIntegration && info.security.sandbox && info.security.webSecurity;
      set('isolation', ok && Object.isFrozen(api) ? 'pass' : 'fail', `No Node globals · API surface [${apiKeys}] frozen · sandbox ${info.security.sandbox ? 'on' : 'OFF'}`);
    }

    // 2/3. Determinism across execution contexts and seeds.
    try {
      const [a, b] = await Promise.all([simulate('syscheck-1'), simulate('syscheck-1')]);
      const local = runMovementProof({ seed: 'syscheck-1', map: HARBOR });
      const same = a.result.fingerprint === b.result.fingerprint && a.result.fingerprint === local.fingerprint;
      set('determinism', same ? 'pass' : 'fail', `#${a.result.fingerprint.slice(0, 12)} ×3 · ${a.result.events.length} events · ${a.computeMs.toFixed(1)} ms in worker`);
      const c = await simulate('syscheck-2');
      set('seeds', c.result.fingerprint !== a.result.fingerprint ? 'pass' : 'fail', `syscheck-2 ⇒ #${c.result.fingerprint.slice(0, 12)}`);
    } catch (e) {
      set('determinism', 'fail', (e as Error).message);
      set('seeds', 'fail', 'Simulation worker unavailable');
    }

    // 4. GPU. Software rasterizers (SwiftShader/llvmpipe) work but are reported honestly.
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    const gl = gl2 ?? document.createElement('canvas').getContext('webgl');
    const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
    const gpu = gl ? (dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : 'unknown renderer') : '';
    const software = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
    if (!gl) set('gpu', 'warn', 'No GPU acceleration (WebGL unavailable or blocklisted). The viewer uses its Canvas 2D fallback.');
    else if (software) set('gpu', 'warn', `${gl2 ? 'WebGL2' : 'WebGL1'} via software rasterizer (${gpu}); expect lower frame rates.`);
    else set('gpu', gl2 ? 'pass' : 'warn', `${gl2 ? 'WebGL2' : 'WebGL1 only'} · ${gpu}`);

    // 5/6. Persistence.
    if (!api) {
      set('save', 'skip', 'Desktop services unavailable in browser preview.');
      set('restart', 'skip', 'Desktop services unavailable in browser preview.');
    } else {
      const prior = await api.saves.read(SMOKE_SLOT);
      const runs = prior.ok ? Number((prior.value.world as { runs?: number }).runs ?? 0) : 0;
      const snapshot: SaveSnapshot = {
        name: 'Phase 0 smoke save',
        worldSeed: 'syscheck-1',
        simulationVersion: 'apex-proof/1',
        world: { runs: runs + 1, lastRunAt: new Date().toISOString(), note: 'Written by Systems Check' },
        ledger: [{ id: `tx_${runs + 1}`, seq: runs + 1, clubId: 'club_smoke', amount: -1000 * (runs + 1), category: 'test', memo: 'Smoke-test entry', gameDate: '2027-01-01', sourceEvent: 'systems_check' }],
      };
      const wrote = await api.saves.write(SMOKE_SLOT, snapshot);
      const back = await api.saves.read(SMOKE_SLOT);
      const equal = wrote.ok && back.ok && canonicalJson(back.value) === canonicalJson(snapshot);
      set('save', equal ? 'pass' : 'fail', wrote.ok ? (equal ? `Wrote and verified ${wrote.value.sizeBytes} bytes (schema v${wrote.value.schemaVersion})` : 'Read-back mismatch') : wrote.message);
      if (prior.ok) set('restart', 'pass', `Found the save from a previous run (${String((prior.value.world as { lastRunAt?: string }).lastRunAt ?? '?')}); run #${runs + 1} now.`);
      else if (prior.code === 'not_found') set('restart', 'skip', 'First run: restart the game and run this check again to verify.');
      else set('restart', 'fail', prior.message);
    }
    setRunning(false);
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const passed = checks.filter((c) => c.status === 'pass').length;

  return (
    <main className="sys">
      <header className="sys-head">
        <button className="btn btn-ghost btn-sm" onClick={() => go('title')}>← Menu</button>
        <div>
          <div className="eyebrow">Phase 0 feasibility</div>
          <h1 className="display sys-title">Systems Check</h1>
        </div>
        <button className="btn btn-sm" onClick={() => void run()} disabled={running} data-testid="rerun">
          {running ? 'Running…' : 'Run again'}
        </button>
      </header>
      <section className="panel sys-list" aria-live="polite">
        {checks.map((c) => (
          <div key={c.id} className="sys-row" data-testid={`check-${c.id}`} data-status={c.status}>
            <span className={`sys-pill sys-${c.status}`}>{c.status === 'pending' ? '…' : c.status.toUpperCase()}</span>
            <span className="sys-label">{c.label}</span>
            <span className="sys-detail mono">{c.detail}</span>
          </div>
        ))}
      </section>
      <p className="sys-summary">
        {passed}/{checks.length} checks passed. These are live checks against the real engine, worker, renderer and save store, not canned results.
      </p>
    </main>
  );
}
