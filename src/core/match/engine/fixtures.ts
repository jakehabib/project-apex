/** Deterministic synthetic teams for tests and batch balance runs. */
import { Rng } from '../../rng/prng';
import { presetById } from './tactics';
import { ATTRIBUTE_KEYS, type Attributes, type Role, type TeamSetup } from './types';

const ROLESETS: readonly (readonly Role[])[] = [
  ['igl', 'support'], ['awper'], ['entry'], ['star', 'lurker'], ['anchor', 'support'],
];

export function syntheticTeam(id: string, skill: number, seed: string, preset = 'balanced', spread = 6): TeamSetup {
  const rng = Rng.fromSeed(`team:${id}:${seed}`);
  const players = ROLESETS.map((roles, i) => {
    const attrs = {} as Record<keyof Attributes, number>;
    for (const k of ATTRIBUTE_KEYS) attrs[k] = Math.round(Math.max(5, Math.min(99, rng.normal(skill, spread))));
    if (roles[0] === 'awper') attrs.awp = Math.min(99, attrs.awp + 12);
    else attrs.awp = Math.max(5, attrs.awp - 20);
    if (roles[0] === 'igl') attrs.calling = Math.min(99, attrs.calling + 12);
    if (roles[0] === 'entry') attrs.opening = Math.min(99, attrs.opening + 10);
    if (roles[0] === 'star') attrs.rifling = Math.min(99, attrs.rifling + 8);
    if (roles[0] === 'anchor') attrs.positioning = Math.min(99, attrs.positioning + 8);
    return { id: `${id}-p${i}`, name: `${id.toUpperCase()}${i}`, attributes: attrs as Attributes, roles };
  });
  const coach = { id: `${id}-coach`, name: `${id.toUpperCase()} Coach`, preparation: Math.round(skill), reading: Math.round(skill), adaptation: Math.round(skill) };
  return { id, name: `Team ${id}`, tag: id.toUpperCase().slice(0, 4), players, tactics: presetById(preset), coach };
}
