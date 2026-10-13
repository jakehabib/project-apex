import type { EconomyPolicy } from '../../../core/match/engine/types';
import { useCareer } from '../store';
import { PageHead, Panel } from '../ui';

const ECON: { key: keyof EconomyPolicy; label: string; help: string; options: { v: string; label: string }[] }[] = [
  { key: 'aggression', label: 'Buying', help: 'Willingness to force or half-buy instead of saving for a full buy.', options: [{ v: 'conservative', label: 'Conservative' }, { v: 'balanced', label: 'Balanced' }, { v: 'aggressive', label: 'Aggressive' }] },
  { key: 'awpPriority', label: 'AWP priority', help: 'How hard the team works to put the sniper in the AWPer’s hands.', options: [{ v: 'low', label: 'Low' }, { v: 'standard', label: 'Standard' }, { v: 'high', label: 'High' }] },
  { key: 'utilityFocus', label: 'Utility focus', help: 'Where grenade money goes.', options: [{ v: 'execute', label: 'Executes' }, { v: 'balanced', label: 'Balanced' }, { v: 'retake', label: 'Retakes' }] },
  { key: 'saveDiscipline', label: 'Save discipline', help: 'How readily players follow a save call in a lost round.', options: [{ v: 'loose', label: 'Loose' }, { v: 'standard', label: 'Standard' }, { v: 'strict', label: 'Strict' }] },
];

export function Tactics() {
  const v = useCareer((s) => s.view)!;
  const act = useCareer((s) => s.act);
  const busy = useCareer((s) => s.busy);
  const t = v.tactics;
  return (
    <div>
      <PageHead eyebrow="Game plan" title="Tactics" />
      <p className="muted note">Your game plan shapes how the team attacks and defends in every map the engine plays. During a live match you can still make stance calls each round.</p>
      <div className="plans">
        {t.presets.map((p) => (
          <button key={p.id} className={`plan ${t.current === p.id ? 'is-on' : ''}`} disabled={!!busy} onClick={() => void act({ kind: 'tactics', presetId: p.id })} data-testid={`plan-${p.id}`}>
            <b className="display">{p.name}</b>
            <span>{p.summary}</span>
            <small><em>Strengths</em> {p.strengths}</small>
            <small><em>Risks</em> {p.risks}</small>
          </button>
        ))}
      </div>
      <Panel title="Economy philosophy">
        <div className="econ">
          {ECON.map((e) => (
            <div key={e.key} className="econ-row">
              <div><b>{e.label}</b><small className="muted">{e.help}</small></div>
              <div className="seg">
                {e.options.map((o) => (
                  <button key={o.v} className={t.economy[e.key] === o.v ? 'is-on' : ''} disabled={!!busy} onClick={() => void act({ kind: 'economy', policy: { ...t.economy, [e.key]: o.v } as EconomyPolicy })}>{o.label}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
