/// <reference lib="webworker" />
import { syntheticTeam } from '../../core/match/engine/fixtures';
import { simulateMap } from '../../core/match/engine/match';
import { mapById } from '../../core/match/maps';
import { MR12_STANDARD } from '../../core/match/rules/ruleset';

export interface SimRequest {
  readonly id: number;
  readonly seed: string;
  readonly mapId: string;
}

/** Demo fixture teams until the career world exists (Phase 3). */
export function demoTeams(seed: string) {
  return [syntheticTeam('nova', 64, `${seed}:n`, 'balanced'), syntheticTeam('rift', 62, `${seed}:r`, 'aggressive')] as const;
}

self.onmessage = (e: MessageEvent<SimRequest>) => {
  const { id, seed, mapId } = e.data;
  const t0 = performance.now();
  try {
    const teams = demoTeams(seed);
    const result = simulateMap({ matchId: `demo-${seed}`, mapIndex: 0, seed, map: mapById(mapId), ruleset: MR12_STANDARD, teams: [teams[0], teams[1]], firstAttacker: 0 });
    const players = teams.flatMap((t, ti) => t.players.map((p) => ({ id: p.id, name: p.name, team: ti, role: p.roles[0] })));
    self.postMessage({ id, ok: true, result, players, teamNames: [teams[0].name, teams[1].name], computeMs: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ id, ok: false, error: (err as Error).message });
  }
};
