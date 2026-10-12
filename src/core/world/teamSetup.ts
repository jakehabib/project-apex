/** Builds the match engine's TeamSetup from a world organisation: real attributes, roles, coach and map practice. */
import type { CoachSetup, PlayerSetup, TeamSetup } from '../match/engine/types';
import { presetById } from '../match/engine/tactics';
import { Rng } from '../rng/prng';
import { engineRoles } from './attributes';
import { headCoach } from './evolution';
import type { Org, World } from './types';

/** Map practice by map id (0..1): stable per club and map, the basis of veto preferences. */
export function mapProficiency(org: Org, mapIds: readonly string[]): Record<string, number> {
  return Object.fromEntries(mapIds.map((m) => [m, Math.round(Rng.fromSeed(`prof:${org.id}:${m}`).range(0.25, 0.85) * 100) / 100]));
}

export function teamSetupFor(world: World, org: Org, mapIds: readonly string[], tacticsId = 'balanced'): TeamSetup {
  const players: PlayerSetup[] = org.roster.map((id) => {
    const p = world.players.get(id)!;
    return { id: p.id, name: p.nickname, attributes: { ...p.attrs }, roles: engineRoles(p.role) };
  });
  const c = headCoach(world, org.id);
  const coach: CoachSetup | undefined = c ? { id: c.id, name: c.name, preparation: c.preparation, reading: c.reading, adaptation: c.adaptation } : undefined;
  return { id: org.id, name: org.name, tag: org.tag, players, tactics: presetById(tacticsId), mapProficiency: mapProficiency(org, mapIds), ...(coach ? { coach } : {}) };
}
