# Project Apex: working rules for Claude Code sessions

**Start with `docs/MASTER_SPEC.md` (the owner's master directive: browser first, Steam later) and `HANDOFF.md`**: the master status, owner decision log, backlog and change log. Update it in the same commit as any meaningful change.

**Owner preference:** work through the backlog (HANDOFF §7) continuously without stopping to ask whether to continue. Give short progress updates; ask only for genuine decisions or blockers (keys, accounts, money).

Continuity docs (keep accurate after every major task): `docs/IMPLEMENTATION_STATUS.md`, `docs/DEVELOPMENT_ROADMAP.md`, `docs/DECISION_LOG.md`, `docs/TEST_RESULTS.md`, `docs/KNOWN_ISSUES.md`, `docs/RELEASE_CHECKLIST.md`, `docs/ARCHITECTURE.md`, `docs/ASSET_LICENSES.md`.

Read `docs/START_HERE.md` and `docs/GAME_DESIGN.md` (authoritative spec), then `docs/PHASE_GATES.md` for current status and the next task.

Non-negotiables (summary, see spec for full list):
- Never add fatigue, stamina, injuries, wear and tear, burnout, training grind or equipment upkeep, or renamed equivalents. `tests/core/boundaries.test.ts` guards core.
- One deterministic seeded simulation powers results, stats, instant-sim and the viewer. No `Math.random`/`Date.now` in `src/core` (enforced by tests).
- `src/core` imports nothing outside itself (no React/DOM/Node/Electron).
- Every displayed stat derives from match events; cash derives from the ledger.
- Original IP only: CS-faithful *rules and numbers*, original names, maps and art.
- Electron security: keep contextIsolation, sandbox and nodeIntegration off, CSP, and the narrow frozen preload API. Compare scheme+host, never `URL.origin`.
- Don't mark a gate passed without evidence; record it in `docs/PHASE_GATES.md` and `docs/DEVELOPMENT_LOG.md`.

AI art (portraits, map key art): see `docs/ART_PIPELINE.md`. Key comes only from the `OPENAI_API_KEY` environment variable; never ask for it in chat. Run `npm run art:check` before any `art:make`.

Before committing: `npm run typecheck && npm test`, plus `xvfb-run -a npm run test:e2e` for anything touching electron/renderer. If an outcome change is intentional, update golden snapshots with `npx vitest run -u` and say why in the log.
