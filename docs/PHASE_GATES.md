# Phase Gates and Task Tracker

Legend: ✅ verified with evidence · ⏳ pending verification · ⬜ not started

## Phase 0: Feasibility (current)

| # | Acceptance criterion | Status | Evidence |
|---|---|---|---|
| 0.1 | Typed domain contracts: match events, map definition, ruleset, arsenal | ✅ | `src/core/match/*`; `npm run typecheck` (4 projects) clean |
| 0.2 | Seeded, versioned PRNG with serializable state; no ambient randomness or time in core | ✅ | `tests/core/rng.test.ts` (10), golden snapshot; `boundaries.test.ts` greps core |
| 0.3 | Headless engine gives identical results for identical seeds | ✅ | `npm run sim:determinism`: 500 seeds, 0 mismatches, 500 distinct outcomes, ~18 ms per sim |
| 0.4 | Original map with legal walk/sight geometry and nav graph | ✅ | `map.test.ts`: every edge walkable, connected, ≥2 routes per site, no spawn-to-spawn or A-to-B sightlines |
| 0.5 | Pixi scene: map plus 10 moving units, animated *from the event log* | ✅ | `viewer-*.png`; positions via `core/replay/positions.ts` (shared with tests) |
| 0.6 | Animation is fluid | ✅ | e2e measures 56–59 FPS at 1080p (software Canvas 2D backend, no GPU) |
| 0.7 | Viewer playback cannot change results | ✅ | e2e: fingerprint unchanged after restart and speed changes |
| 0.8 | Sim runs off the UI thread | ✅ | Web Worker; Systems Check compares worker vs. UI-thread fingerprints |
| 0.9 | SQLite round-trip, atomic save, backup, integrity, migrations | ✅ | `saveStore.test.ts` (12) |
| 0.10 | Save survives an app restart | ✅ | e2e relaunches the app and reads the previous run's save (dev and packaged builds) |
| 0.11 | Secure preload/IPC: isolation, sandbox, CSP, trusted-sender checks | ✅ | e2e probes globals, CSP header, inline-script block, navigation block; `security.test.ts` |
| 0.12 | Desktop package builds and launches | ✅ Linux / ⏳ Windows | Linux unpacked build launched by `e2e/packaged.spec.ts`. Windows `.exe` cross-built (PE32+ x86-64); launch awaits the CI `windows` job |
| 0.13 | Tooling documented | ✅ | `README.md`, this file, `TECH_ARCHITECTURE.md` |
| 0.14 | Steam API compatibility spike | ⬜ blocked | Needs Steamworks partner account and App ID; separate gate, does not block offline development |

**Gate verdict:** Phase 0 passes on Linux. It closes fully once the CI Windows job launches the packaged `.exe`. Steam (0.14) is a separate, credential-gated spike.

## First 12 tasks (dependency order)

| # | Task | Files | Tests | Status |
|---|---|---|---|---|
| T1 | Scaffold, pinned toolchain, 4 tsconfig boundaries | `package.json`, `tsconfig.*` | typecheck | ✅ |
| T2 | Seeded RNG `apex-rng/1` | `core/rng/prng.ts` | `rng.test.ts` | ✅ |
| T3 | Map model, rasterized grid, LOS, nav + A* (Harbor) | `core/match/maps/*` | `map.test.ts` | ✅ |
| T4 | Match event contract, ruleset (MR12), arsenal | `core/match/events.ts`, `rules/*` | typecheck | ✅ |
| T5 | Movement/sightline proof and replay reconstruction | `core/match/spike`, `replay` | `movementProof.test.ts` | ✅ |
| T6 | SaveStore (`node:sqlite`) | `persistence/saveStore.ts` | `saveStore.test.ts` | ✅ |
| T7 | Secure Electron shell, protocol, IPC | `electron/*` | `security.test.ts`, e2e | ✅ |
| T8 | Design tokens, title screen, Pixi viewer, Systems Check | `renderer/*` | e2e and screenshots | ✅ |
| T9 | Packaging, packaged smoke test, CI incl. Windows | `.github/workflows/ci.yml` | `packaged.spec.ts` | ✅ Linux / ⏳ Windows CI |
| T10 | **Round state machine + economy** (freeze, buy, live, plant, post-plant, end; MR12 halves, OT, loss bonus) | `core/match/round/*`, `economy/*` | invariants: score = rounds awarded, money bounds, side switches | ⬜ next |
| T11 | **Agent knowledge + combat**: per-agent information state, engagement resolution from attributes/weapons/cover/distance, trades | `core/match/agents/*`, `combat/*` | no omniscience; kill ⇒ exactly one death; damage reconciles | ⬜ |
| T12 | **Second map (Switchyard) + 10k-map batch harness** `npm run sim:balance` | `maps/switchyard.ts`, `scripts/sim-balance` | side win rates, round length and OT distribution, skill-gap monotonicity | ⬜ |

## Phase 1: Deterministic one-map competition simulator (next)

Gate: a full MR12 map simulates headless with legal economy, objective and terminal rules. It passes event/stat invariants and the batch harness, with no UI involvement.

## Later phases

Phases 2–6 as defined in `docs/GAME_DESIGN.md` §17. Not started.
