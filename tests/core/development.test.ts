import { describe, expect, it } from 'vitest';
import { Rng } from '../../src/core/rng/prng';
import { overallFor } from '../../src/core/world/attributes';
import { develop, headCoach } from '../../src/core/world/evolution';
import { generateWorld } from '../../src/core/world/generate';
import { ageOn } from '../../src/core/world/types';

describe('player development', () => {
  it('assigns role-aware attributes consistent with the cached overall', () => {
    const w = generateWorld({ seed: 'dev-a', orgsPerRegion: { EU: 6, AM: 3, AS: 3 }, freeAgents: 30 });
    for (const p of w.players.values()) {
      expect(overallFor(p.attrs, p.role)).toBeCloseTo(p.skill, 5);
      expect(p.potential).toBeGreaterThanOrEqual(p.skill);
      if (p.role !== 'AWPer') expect(p.attrs.awp).toBeLessThanOrEqual(p.attrs.rifling + 5);
    }
    for (const o of w.orgs.values()) expect(headCoach(w, o.id)).not.toBeNull();
  });

  it('young players with headroom grow, more under a better coach; veterans lose mechanics; nobody passes their ceiling', () => {
    const run = (coachDev: number) => {
      const w = generateWorld({ seed: 'dev-b', orgsPerRegion: { EU: 6, AM: 3, AS: 3 }, freeAgents: 0 });
      for (const s of w.staff.values()) if (s.role === 'coach') s.development = coachDev;
      const before = new Map([...w.players.values()].map((p) => [p.id, { skill: p.skill, rifling: p.attrs.rifling }]));
      const rng = Rng.fromSeed('dev');
      for (let y = 0; y < 2; y++) develop(w, rng, 365 * y, 1);
      let youngGain = 0;
      let youngN = 0;
      let vetRifle = 0;
      let vetN = 0;
      for (const p of w.players.values()) {
        const b = before.get(p.id)!;
        for (const k of Object.keys(p.attrs) as (keyof typeof p.attrs)[]) expect(p.attrs[k]).toBeLessThanOrEqual(Math.max(p.ceiling[k], 99) + 1e-9);
        const age = ageOn(p, 0);
        if (age <= 20 && p.potential - b.skill > 6) {
          youngGain += p.skill - b.skill;
          youngN++;
        }
        if (age >= 30) {
          vetRifle += p.attrs.rifling - b.rifling;
          vetN++;
        }
      }
      return { young: youngGain / Math.max(1, youngN), vet: vetRifle / Math.max(1, vetN) };
    };
    const weak = run(30);
    const strong = run(90);
    expect(weak.young).toBeGreaterThan(0.5);
    expect(strong.young).toBeGreaterThan(weak.young);
    expect(strong.vet).toBeLessThan(0);
  });
});
