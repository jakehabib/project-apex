# Project Apex: working rules for Claude Code sessions

Read `docs/START_HERE.md` and `docs/GAME_DESIGN.md` (authoritative spec), then `docs/PHASE_GATES.md` for current status and the next task.

Non-negotiables (summary, see spec for full list):
- Never add fatigue, stamina, injuries, wear and tear, burnout, training grind or equipment upkeep, or renamed equivalents. `tests/core/boundaries.test.ts` guards core.
- One deterministic seeded simulation powers results, stats, instant-sim and the viewer. No `Math.random`/`Date.now` in `src/core` (enforced by tests).
- `src/core` imports nothing outside itself (no React/DOM/Node/Electron).
- Every displayed stat derives from match events; cash derives from the ledger.
- Original IP only: CS-faithful *rules and numbers*, original names, maps and art.
- Electron security: keep contextIsolation, sandbox and nodeIntegration off, CSP, and the narrow frozen preload API. Compare scheme+host, never `URL.origin`.
- Don't mark a gate passed without evidence; record it in `docs/PHASE_GATES.md` and `docs/DEVELOPMENT_LOG.md`.

Before committing: `npm run typecheck && npm test`, plus `xvfb-run -a npm run test:e2e` for anything touching electron/renderer. If an outcome change is intentional, update golden snapshots with `npx vitest run -u` and say why in the log.
