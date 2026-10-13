# Architecture (current)

Detailed decision record and security model: `docs/TECH_ARCHITECTURE.md`. This page is the up-to-date map.

## Delivery targets

1. **Browser (primary, owner override 2026-10-13).** `npm run build:web` produces a static site in `dist-web/`. Persistence is IndexedDB (`src/renderer/career/saves.ts`: slots, gzip, SHA-256, backup, export/import).
2. **Desktop (later: Windows/Steam).** Electron shell in `electron/`, SQLite saves via `node:sqlite`, the same renderer bundle.

## Layers

```
src/core/                  pure TypeScript, deterministic, no DOM/Node imports (enforced by tests)
  rng/                     seeded RNG (cyrb128 + sfc32), label-forked streams
  match/rules/             ruleset (MR12, OT, economy), arsenal (prices, rewards, weapons, utility)
  match/maps/              tile maps → walk/sight grid, nav graph + A*, map strategy semantics
  match/engine/            round simulation: perception, movement, combat, utility, economy, saves,
                           attack/defense planners (to be replaced by the tactical AI layers below)
  match/stats/             invariants (event replay checker), AMR, win probability, recap
  calibration/             batch telemetry
  world/                   players, attributes, development, contracts, finances, generation
  competition/             ARP rankings, lineage, tournaments, formats, veto, calendar, ecosystem
  career/                  career state, engine-played series for the human club, advance loop with
                           stops, manager actions, screen view-models, save codec (Map/Set/Rng → JSON)
src/renderer/              React UI, PixiJS viewer, Web Workers (career, match, world, sim)
  career/                  career shell, pages, Match Center, replay, IndexedDB saves
electron/                  desktop shell (secure preload, saves)
scripts/                   art pipeline, calibration, career sim, dev tools
```

## Simulation contract

- `MapSimulation` (`engine/match.ts`) steps one round at a time from a seed and recorded manager inputs. It emits an append-only `MatchEvent[]` log.
- Everything else derives from that log:
  - stats, AMR and the recap;
  - the viewer;
  - the invariants.
- Replays are bit-identical (fingerprint tests).

## Tactical AI (rebuild in progress, decision #38)

| Layer | Responsibility | Module |
|---|---|---|
| Map tactical semantics | Regions, chokes, angles, utility lineups, plant, post-plant and retake spots, routes | `match/maps/tactical/*` |
| Team Director | Plan template choice, pace, target, commitment, rotations, save/retake, replanning with cooldowns | `engine/ai/director.ts` |
| Squad coordination | Groups, routes, entry order, trade spacing, synchronized utility and timing | `engine/ai/squad.ts` |
| Player AI | Movement along paths, holding angles, cover, engagements, trades, retreat, throws | `engine/ai/player.ts` |
| Beliefs | Per-team knowledge with age and confidence; no hidden-plan leakage | `engine/ai/beliefs.ts` |
| Debug | `tactic_state` events (dev only) consumed by the viewer overlay | events + `viewer/DebugOverlay.ts` |

Module paths in this table are targets; update them as files land.

## Career loop

- `advance()` runs days: `beginDay` (windows, finances, snapshots, invitations, registrations) then `runDayEvents`.
- The career resolver returns stored results for the club's series and throws `PendingSeries` for an unplayed one. `runEvent` mutates nothing until every series is decided, so the stopped event is simply re-run later with the stored results.
- The club's maps are played in the career worker (`MapSimulation`, round by round with stance calls) and recorded with their full inputs (team set-ups, seed, calls), so any map can be re-watched exactly.
- The worker autosaves after every advance, action and finished series.
