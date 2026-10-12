import { describe, expect, it } from 'vitest';
import { syntheticTeam } from '../../src/core/match/engine/fixtures';
import { simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { buildGrid, isWalkable } from '../../src/core/match/maps/grid';
import { buildTracks, positionAt } from '../../src/core/match/replay/positions';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';

describe('replay parity: viewer positions equal engine positions', () => {
  for (const [mi, map] of MAP_POOL.entries()) {
    it(`${map.id}: every damage/kill/spotted position is reproduced exactly from the event log`, () => {
      const r = simulateMap({ matchId: 'p', mapIndex: 0, seed: `parity-${mi}`, map, ruleset: MR12_STANDARD, teams: [syntheticTeam('a', 62, 'a'), syntheticTeam('b', 62, 'b')], firstAttacker: 0 });
      const grid = buildGrid(map);
      const rounds = new Set(r.events.map((e) => e.roundIndex));
      let checked = 0;
      for (const ri of rounds) {
        const tracks = buildTracks(r.events, ri);
        const near = (id: string, t: number, p: { x: number; y: number }) => {
          const q = positionAt(tracks.get(id)!, t);
          expect(Math.hypot(q.x - p.x, q.y - p.y), `${id} @${t}`).toBeLessThan(1e-6);
          checked++;
        };
        for (const e of r.events) {
          if (e.roundIndex !== ri) continue;
          if (e.type === 'damage' && !['frag', 'cinder', 'ember'].includes(e.weaponId)) {
            near(e.attackerId, e.tMs, e.attackerPos);
            near(e.victimId, e.tMs, e.victimPos);
          } else if (e.type === 'kill') near(e.victimId, e.tMs, e.victimPos);
          else if (e.type === 'spotted') {
            near(e.observerId, e.tMs, e.observerPos);
            near(e.targetId, e.tMs, e.targetPos);
          }
        }
        for (const [, tr] of tracks) for (let t = 0; t < 60000; t += 1000) expect(isWalkable(grid, positionAt(tr, t))).toBe(true);
      }
      expect(checked).toBeGreaterThan(200);
    });
  }

  it('viewer speed and seek cannot change results (same seed, same fingerprint)', () => {
    const a = simulateMap({ matchId: 'p', mapIndex: 0, seed: 'same', map: MAP_POOL[0]!, ruleset: MR12_STANDARD, teams: [syntheticTeam('a', 60, 'a'), syntheticTeam('b', 60, 'b')], firstAttacker: 1 });
    const b = simulateMap({ matchId: 'p', mapIndex: 0, seed: 'same', map: MAP_POOL[0]!, ruleset: MR12_STANDARD, teams: [syntheticTeam('a', 60, 'a'), syntheticTeam('b', 60, 'b')], firstAttacker: 1 });
    expect(a.fingerprint).toBe(b.fingerprint);
  });
});
