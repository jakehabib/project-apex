import { useState } from 'react';
import { useNav } from '../../state/nav';
import { career } from '../../workers/careerClient';
import { useCareer } from '../store';
import { PageHead, Panel } from '../ui';

export function Settings() {
  const v = useCareer((s) => s.view)!;
  const act = useCareer((s) => s.act);
  const say = useCareer((s) => s.say);
  const go = useNav((s) => s.go);
  const [saving, setSaving] = useState(false);
  const exportFile = async () => {
    const blob = await career.exportSave();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${v.header.orgName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-s${v.header.season}.apexsave`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  return (
    <div>
      <PageHead eyebrow="Career" title="Settings" />
      <Panel title="Match days">
        <label className="toggle">
          <input type="checkbox" checked={v.header.autoSim} onChange={(e) => void act({ kind: 'autoSim', on: e.target.checked })} />
          <span>Simulate my matches automatically (the calendar does not stop for them; the same engine plays every map)</span>
        </label>
      </Panel>
      <Panel title="Saving">
        <p className="muted">The career saves itself after every Continue, every decision and every finished series. Saves stay in this browser (with a backup of the previous save); export a file to keep a copy or move it to another device.</p>
        <div className="row-gap">
          <button className="btn" disabled={saving} onClick={() => { setSaving(true); void career.save().then(() => say('Saved.', 'ok')).finally(() => setSaving(false)); }}>Save now</button>
          <button className="btn" onClick={() => void exportFile()}>Export save file</button>
          <button className="btn btn-ghost" onClick={() => go('title')}>Main menu</button>
        </div>
      </Panel>
    </div>
  );
}
