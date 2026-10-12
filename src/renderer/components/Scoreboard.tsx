import { useMemo, useState } from 'react';
import type { MatchEvent } from '../../core/match/events';
import { amrFromTotals, computeAmr, type AmrBreakdown, type PlayerAmr } from '../../core/match/stats/amr';

export interface ScoreboardPlayer {
  readonly id: string;
  readonly name: string;
  readonly team: number;
  readonly role?: string | undefined;
}

const ROLE_LABEL: Record<string, string> = { awper: 'AWPer', star: 'Star rifler', igl: 'In-game leader', entry: 'Entry fragger', anchor: 'Anchor', support: 'Support', lurker: 'Lurker' };
const roleName = (r?: string) => (r ? (ROLE_LABEL[r] ?? r) : 'Rifler');

/** Typical AMR by role in the simulated population (scripts/amr-calibrate.ts). */
export const ROLE_BASELINE: Record<string, number> = {
  AWPer: 1.04, 'Star rifler': 1.16, 'In-game leader': 0.93, 'Entry fragger': 0.95, Anchor: 0.98, Support: 0.97, Lurker: 1.0,
  awper: 1.04, star: 1.16, igl: 0.93, entry: 0.95, anchor: 0.98, support: 0.97, lurker: 1.0,
};

const SUBS: { key: keyof AmrBreakdown; label: string; weight: string; help: string }[] = [
  { key: 'kill', label: 'Kill', weight: '30%', help: 'Kills per round, weighted by how hard each duel was (equipment).' },
  { key: 'swing', label: 'Round Swing', weight: '20%', help: "How much this player's kills and deaths moved the team's chance to win each round." },
  { key: 'damage', label: 'Damage', weight: '15%', help: 'Health removed per round, adjusted for equipment.' },
  { key: 'survival', label: 'Survival', weight: '15%', help: 'Staying alive in rounds that mattered; passive saves earn little.' },
  { key: 'kast', label: 'KAST', weight: '10%', help: 'Rounds with a kill, assist, survival or traded death.' },
  { key: 'multi', label: 'Multi-kill', weight: '10%', help: 'Rounds with two or more kills, weighted by duel difficulty.' },
];

const tone = (x: number) => (x >= 1.15 ? 'sb-good' : x <= 0.85 ? 'sb-bad' : '');

function explain(b: AmrBreakdown, role: string): string {
  const parts = SUBS.map((s) => ({ s, v: b[s.key] as number })).sort((a, c) => c.v - a.v);
  const best = parts.slice(0, 2).map((p) => p.s.label.toLowerCase());
  const worst = parts[parts.length - 1]!;
  const base = ROLE_BASELINE[role] ?? 1;
  const vsRole = b.amr - base;
  const verdict = b.amr >= 1.3 ? 'An outstanding map' : b.amr >= 1.1 ? 'A strong map' : b.amr >= 0.9 ? 'A solid map' : b.amr >= 0.75 ? 'A quiet map' : 'A difficult map';
  return `${verdict}: driven by ${best.join(' and ')}${worst.v < 0.9 ? `, held back by ${worst.s.label.toLowerCase()}` : ''}. ${vsRole >= 0 ? '+' : ''}${vsRole.toFixed(2)} versus the average ${role.toLowerCase()} (${base.toFixed(2)}).`;
}

export function Scoreboard({ events, players, teamNames, onClose }: { events: readonly MatchEvent[]; players: readonly ScoreboardPlayer[]; teamNames: readonly [string, string]; onClose: () => void }) {
  const amr = useMemo(() => computeAmr(events), [events]);
  const [open, setOpen] = useState<string | null>(null);
  const rows = (team: number) =>
    players
      .filter((p) => p.team === team)
      .map((p) => ({ p, a: amr.get(p.id) ?? null }))
      .map((x) => ({ ...x, b: x.a ? amrFromTotals(x.a.total) : null }))
      .sort((x, y) => (y.b?.amr ?? 0) - (x.b?.amr ?? 0));
  const detail = open ? players.find((p) => p.id === open) : null;
  const detailAmr: PlayerAmr | null = open ? (amr.get(open) ?? null) : null;
  return (
    <div className="sb-backdrop" role="dialog" aria-label="Scoreboard" data-testid="scoreboard" onClick={onClose}>
      <div className="sb" onClick={(e) => e.stopPropagation()}>
        {[0, 1].map((team) => (
          <table key={team} className="sb-table">
            <thead>
              <tr>
                <th className="sb-team">{teamNames[team]}</th>
                <th>K</th>
                <th>D</th>
                <th>A</th>
                <th>ADR</th>
                <th>KAST</th>
                <th title="APEX Match Rating">AMR</th>
              </tr>
            </thead>
            <tbody>
              {rows(team).map(({ p, a, b }) => (
                <tr key={p.id} className={open === p.id ? 'is-open' : ''} onClick={() => setOpen(open === p.id ? null : p.id)} data-testid={`sb-row-${p.id}`}>
                  <td className="sb-name">
                    {p.name}
                    <small>{roleName(p.role)}</small>
                  </td>
                  <td className="mono">{a?.total.kills ?? 0}</td>
                  <td className="mono">{a?.total.deaths ?? 0}</td>
                  <td className="mono">{a?.total.assists ?? 0}</td>
                  <td className="mono">{b ? b.adr.toFixed(0) : '–'}</td>
                  <td className="mono">{b ? `${b.kastPct.toFixed(0)}%` : '–'}</td>
                  <td className={`mono sb-amr ${b ? tone(b.amr) : ''}`}>{b ? b.amr.toFixed(2) : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
        {detail && detailAmr && (
          <section className="sb-detail" data-testid="sb-detail">
            <header>
              <strong>{detail.name}</strong>
              <span className="sb-detail-amr mono">{amrFromTotals(detailAmr.total).amr.toFixed(2)}</span>
              <span className="sb-detail-role">{roleName(detail.role)}</span>
            </header>
            <p className="sb-why">{explain(amrFromTotals(detailAmr.total), roleName(detail.role))}</p>
            <div className="sb-subs">
              {SUBS.map((s) => {
                const v = amrFromTotals(detailAmr.total)[s.key] as number;
                return (
                  <div key={s.key} className="sb-sub" title={s.help}>
                    <span className="sb-sub-label">
                      {s.label} <small>{s.weight}</small>
                    </span>
                    <span className="sb-bar">
                      <i style={{ width: `${Math.min(100, (v / 2) * 100)}%` }} className={tone(v)} />
                      <b style={{ left: '50%' }} />
                    </span>
                    <span className={`mono ${tone(v)}`}>{v.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
            <div className="sb-facts mono">
              <span>Opening {detailAmr.total.openingKills}–{detailAmr.total.openingDeaths}</span>
              <span>Clutches {detailAmr.total.clutchesWon}</span>
              <span>2K {detailAmr.total.multiKills[0]} · 3K {detailAmr.total.multiKills[1]} · 4K {detailAmr.total.multiKills[2]} · Ace {detailAmr.total.multiKills[3]}</span>
              <span>Flash assists {detailAmr.total.flashAssists}</span>
              <span>Swing {(amrFromTotals(detailAmr.total).swingPerRound * 100).toFixed(1)}% / round</span>
            </div>
            <div className="sb-sides">
              {(['attacker', 'defender'] as const).map((side) => {
                const t = detailAmr.bySide[side];
                const sb = amrFromTotals(t);
                return (
                  <div key={side}>
                    <span className="eyebrow">{side === 'attacker' ? 'T side' : 'CT side'}</span>
                    <span className="mono">
                      {t.rounds ? `${sb.amr.toFixed(2)} AMR · ${t.kills}–${t.deaths} · ${sb.adr.toFixed(0)} ADR` : 'not played yet'}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
        <p className="sb-foot">
          AMR (APEX Match Rating): 1.00 is an average performance. Click a player for the breakdown. <kbd>Tab</kbd> closes.
        </p>
      </div>
    </div>
  );
}
