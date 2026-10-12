import { describe, expect, it } from 'vitest';
import { MapSimulation, simulateMap } from '../../src/core/match/engine/match';
import { MAP_POOL } from '../../src/core/match/maps';
import { MR12_STANDARD } from '../../src/core/match/rules/ruleset';
import { buildRecap } from '../../src/core/match/stats/recap';
import { generateWorld } from '../../src/core/world/generate';
import { teamSetupFor } from '../../src/core/world/teamSetup';

const world = generateWorld({ seed: 'md', orgsPerRegion: { EU: 6, AM: 2, AS: 2 }, freeAgents: 10 });
const [a, b] = [...world.orgs.values()];
const ids = MAP_POOL.map((m) => m.id);
const input = { matchId: 'md', mapIndex: 0, seed: 'md-1', map: MAP_POOL[0]!, ruleset: MR12_STANDARD, teams: [teamSetupFor(world, a!, ids), teamSetupFor(world, b!, ids)] as const, firstAttacker: 0 as const };

describe('match day: stepped play with manager calls', () => {
  it('stepping round by round with calls reproduces simulateMap given the same instruction log', () => {
    const live = new MapSimulation(input);
    live.step();
    live.step();
    live.instruct(0, 'aggressive');
    live.step();
    live.step();
    live.instruct(0, 'passive');
    live.instruct(1, 'aggressive');
    const played = live.result();
    const replay = simulateMap({ ...input, instructions: live.instructionLog });
    expect(replay.fingerprint).toBe(played.fingerprint);
    expect(played.events.some((e) => e.type === 'call' && e.text === 'Coach: play aggressive')).toBe(true);
    // Without the calls the match differs (the calls are real inputs).
    expect(simulateMap(input).fingerprint).not.toBe(played.fingerprint);
  });

  it('builds a recap with an MVP, every round and storylines', () => {
    const r = simulateMap(input);
    const names = new Map(input.teams.flatMap((t) => t.players.map((p) => [p.id, p.name] as const)));
    const recap = buildRecap(r.events, [input.teams[0].name, input.teams[1].name], (id) => names.get(id) ?? id);
    expect(recap.rounds.length).toBe(r.rounds.length);
    expect(recap.players.length).toBe(10);
    expect(recap.mvpId).not.toBeNull();
    expect(recap.storylines[0]!.kind).toBe('result');
    expect(recap.storylines.some((s) => s.kind === 'mvp')).toBe(true);
    expect(recap.scores).toEqual(r.scores);
  });
});
