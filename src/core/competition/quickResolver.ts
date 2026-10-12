/**
 * VALIDATION-ONLY series resolver. Decides series from roster strength with
 * seeded noise so multi-season ecosystem tests (rankings, invitations,
 * qualifiers, continuity) run in minutes. It tests ecosystem mechanics, not
 * match realism. In the game every series is played by the match engine.
 */
import { Rng } from '../rng/prng';
import { teamStrength } from '../world/evolution';
import type { World } from '../world/types';
import type { Resolver } from './formats';
import { POOL_IDS } from './mapPool';
import type { MapScore } from './records';
import { mapsToWin, runVeto } from './veto';

/** P(team with strength `a` wins a map against `b`). 5 skill points ≈ 75%. */
export const mapWinProbability = (a: number, b: number): number => 1 / (1 + Math.exp(-(a - b) / 4.6));

export function quickResolver(world: World, seed: string): Resolver {
  return (req) => {
    const rng = Rng.fromSeed(`quick:${seed}:${req.seriesId}`);
    const orgA = world.orgs.get(req.a.orgId)!;
    const orgB = world.orgs.get(req.b.orgId)!;
    // Day-to-day form: a little noise per series.
    const sa = teamStrength(world, orgA) + rng.normal(0, 1.6);
    const sb = teamStrength(world, orgB) + rng.normal(0, 1.6);
    const prefs = [orgA, orgB].map((o) => Object.fromEntries(POOL_IDS.map((m) => [m, Rng.fromSeed(`pref:${o.id}:${m}`).normal(0, 1)]))) as [Record<string, number>, Record<string, number>];
    const veto = runVeto(POOL_IDS, req.bestOf, prefs, rng);
    const need = mapsToWin(req.bestOf);
    let wa = 0;
    let wb = 0;
    const maps: MapScore[] = [];
    for (const m of veto.maps) {
      if (wa === need || wb === need) break;
      const edge = 0.35 * ((prefs[0][m.mapId] ?? 0) - (prefs[1][m.mapId] ?? 0));
      const aWins = rng.chance(mapWinProbability(sa + edge, sb));
      const loser = rng.chance(0.12) ? 12 + 3 * rng.int(0, 1) : rng.int(2, 11);
      const winner = loser >= 12 ? loser + 4 : 13;
      maps.push(aWins ? { mapId: m.mapId, a: winner, b: loser } : { mapId: m.mapId, a: loser, b: winner });
      if (aWins) wa++;
      else wb++;
    }
    return { winner: wa > wb ? 'a' : 'b', maps };
  };
}
