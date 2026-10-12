# Project Apex (working title)

A premium single-player tactical-shooter esports management game for Windows/Steam. You build a five-player roster, negotiate contracts and transfers, set strategy, and watch every match play out on a 2D tactical broadcast. That broadcast is driven by the **same deterministic simulation** that produces results and stats.

- **Master handoff and status: [`HANDOFF.md`](HANDOFF.md)** (start here)
- Design spec: [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md) (authoritative)
- Architecture: [`docs/TECH_ARCHITECTURE.md`](docs/TECH_ARCHITECTURE.md)
- Phase gates and task tracker: [`docs/PHASE_GATES.md`](docs/PHASE_GATES.md)
- [`docs/DEVELOPMENT_LOG.md`](docs/DEVELOPMENT_LOG.md) · [`docs/KNOWN_ISSUES.md`](docs/KNOWN_ISSUES.md)

**Current state:** see [`HANDOFF.md`](HANDOFF.md). The match engine, tactical viewer, AI art pipeline and gallery are working. The ranking ecosystem is in progress. Career mode is not built yet.

## Requirements

Node.js 22.13+ (for `node:sqlite` in tests). No external services, accounts or network access at runtime.

## Commands

```bash
npm install
npm run dev              # launch the desktop app with hot reload
npm test                 # unit + invariant suites (Vitest)
npm run typecheck        # core / renderer / electron / e2e projects
npm run sim:determinism  # headless sweep: 500 seeds x2, must match exactly
npm run test:e2e         # build, then drive the real Electron app (Playwright)
npm run build            # production renderer + main/preload bundles
npm run start            # run the production build
npm run package:win      # release/win-unpacked/Project Apex.exe (x64)
npm run package:linux    # release/linux-unpacked/project-apex
APEX_PACKAGED_EXE=<path> npm run test:packaged   # smoke-test a packaged build
```

On Linux CI/containers, wrap Electron commands in `xvfb-run -a`. Containers running as root need `--no-sandbox`; the test harness adds it automatically.

Planned (Phase 1+): `npm run sim:balance` and `npm run sim:career`.

## Viewer controls

`Space` play/pause · `1`–`4` speed 1x/2x/4x/8x · `←`/`→` seek 5 s · `R` restart · `Esc` menu · click a player card to highlight.

## Content and IP

All maps, weapon names, teams and players are original. Gameplay *structure* follows the genre (MR12, economy, bomb objective), but no Valve or Counter-Strike assets, names, maps, audio or likenesses are used.
