# CLAUDE CODE — START HERE

You are the principal game engineer, systems designer, UI engineer and technical art director for a premium Windows PC game intended for commercial sale on Steam. The working title is **PROJECT APEX**, a fictional five-versus-five tactical-shooter esports management game.

**First read `CS_Style_Esports_Manager_Product_Brief.md` in full.** Treat it as the authoritative product, simulation, UX and technical acceptance specification. Work through its phased roadmap. Do not replace it with a generic one-page overview or a static mockup.

## Vision

Build the franchise-management depth of excellent sports GM modes and the excitement of watching professional tactical-shooter games. Players should scout talent, negotiate contracts, execute buyouts/trades, build five-player lineups and map pools, decide on strategic playstyles, manage a financially constrained club and compete across a living fictional international circuit for many seasons. Matches must be viewable in an interactive, sophisticated, polished 2D overhead tactical broadcast.

The core selling proposition is **a premium single-player management game with honest simulation, compelling player-market decisions, living rivals, complete career history and outstanding interface usability**. It must be fun, not an office-administration simulator. Every essential primary-screen control must work, and the core loop must be genuinely playable.

## Absolute prohibitions

- No fatigue, wear and tear, injuries, recovery, stamina, burnout, rest management or renamed equivalents.
- No mandatory weekly training clicks, facilities upkeep, equipment replacement, esports-house micromanagement or repetitive press dialogues.
- No predetermined random match score followed by fake unrelated animation. The **same deterministic seeded event simulator** must power watching, highlights, instant simulation and every statistic.
- No hardcoded club finances, fabricated scouting results or trade acceptance dialogs detached from actual state.
- No copied Valve/CS2 maps, audio, art, real-player likenesses, team logos or other third-party IP without a separately granted license. Use original fictional assets and original maps.
- No generic web-app appearance. The result must look and feel like a polished commercial game, not an admin template.
- No pay-to-win, online-only requirements, loot boxes, microtransactions or large social/chat subsystems.

## Recommended build architecture

Prefer Electron + React + TypeScript + Vite for Windows desktop, PixiJS for 2D animated match rendering, an independently testable pure TypeScript game simulation core and SQLite for robust local saves, subject to an early packaging/performance feasibility spike. A secure preload/API boundary is mandatory: keep `contextIsolation` enabled and renderer `nodeIntegration` disabled; integrate native modules securely via main process. Do not sacrifice security merely to make an outdated Steam overlay example work. If an alternative stack becomes demonstrably safer and more productive, document a clear architecture decision first.

Implement proper domain models and immutable transaction/event semantics for players, club ownership, contracts, bids, transfers, tournaments, economy and match events. One source of truth for stats and financial ledgers. Real save/load and career migration paths.

## Required first deliverable

Before building the full game, make a **small genuinely playable vertical slice**:

- Eight original clubs and a ~60-player ecosystem.
- Two original maps with real position/path/visibility rules, two tactical presets, MR12-style regulation and data-driven overtime rules.
- Seeded 5v5 combat, agent knowledge/rotation, utility, buy/economy, bomb objective and score logic.
- Interactive 2D tactical viewer: legible map, player movement, utility overlays, alive players, damage, objective/clock, scoreboard, kill feed, pause/speed/skip and match recap.
- Roster management, player comparison, one real free-agent negotiation, one transfer/buyout interaction, financially accurate contract ledger and rival AI legality.
- One playable tournament, reward/prestige changes, advancement and actual restart-safe save files.
- Meaningful first 15 minutes and an uninterrupted 30-45 minute playthrough.

Every displayed stat must be derived from the same event log that powers the match viewer, and every AI organization must follow legal roster/budget constraints.

## Work method

1. Read the full brief and audit current repository. If no repository exists, initialize a clean one with reasonable tooling.
2. Write concise `docs/TECH_ARCHITECTURE.md`, `docs/DEVELOPMENT_LOG.md`, `docs/KNOWN_ISSUES.md`, and a checklist of phase gates. State chosen stack, data boundaries, technical risks and first 8-12 tasks. If you need Steam credentials for native integration, mark that as a separate later gate and proceed with fully offline development.
3. Execute Phase 0: launchable desktop app, renderer proof, seeded simulator proof, SQLite roundtrip, native packaging test; check compatibility before building large features.
4. Execute Phase 1: headless authentic seeded MR12-style simulator and invariant/batch tests (economy, objective, outcomes, player locations, stats).
5. Execute Phase 2: event-driven overhead match viewer and watch-versus-sim parity tests.
6. Execute Phase 3: actual fully integrated roster/contract/transfer/club/tournament/save vertical slice.
7. Build subsequent content expansion only after all slice gates pass; add sound/visual polish and user-testing feedback early.
8. After each meaningful task, run tests, record outcomes and fix failures before moving on. Use clear commits if Git is initialized and record anything blocked.

## Mandatory simulation correctness

- Given identical initial state, seed, version and command sequence, match outcomes/events/stats are identical.
- Switching viewer speed, skipping animation or restarting playback does not change results.
- Live tactical decisions occur only at explicit valid decision points; no retroactive alteration of resolved events.
- Individual 5v5 spatial agents cannot act on omniscient enemy locations; sight lines, movement time, utility and objectives have legal state transitions.
- Credit purchases, saved guns, round timers, bomb plant/defuse and end-of-half rules are coherent and tested.
- More capable rosters outperform weaker opponents **on average** rather than always; no universal tactic overrides talent.
- All contract/transfer transactions maintain valid ownership, player/roster counts, wages, cash and history.
- Long-career batch testing detects wage inflation, AI club bankruptcy loops, talent inflation, impossible rosters, unfinishable seasons and duplicated payouts.

## UX and aesthetic bar

Use a custom game-branded design system: sophisticated restrained dark broadcast aesthetic, original club crests, strong typography, rich player profiles, legible comparisons, logical navigation, responsive layouts, clear empty/loading/error states, satisfying transitions and polished match overlay. Design at 1280x720 through 2560x1440, with keyboard/mouse accessibility. Avoid wall-of-tables fatigue by making key decisions prominent and delegable. Fewer systems with real impact beat many shallow fake systems.

## What to report

Begin your first response with a one-page technical plan, the first 8-12 tasks and the Phase 0 acceptance checklist. Then implement Phase 0 and report:

- What actually runs
- Which commands to use
- Tests run and results
- Which phase gate passed
- Screenshots where useful
- Open risks and immediate next task

Do not tell me the whole game is finished after generating a few screens. Keep progressing through the milestone plan as coding sessions permit. Choose sensible defaults where the brief leaves room and write down decisions. Aim for a product someone will eventually feel proud to purchase on Steam.
