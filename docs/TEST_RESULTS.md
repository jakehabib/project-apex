# Test results

Only results that actually ran are recorded. Newest first.

| Date | Commit | Suite | Result |
|---|---|---|---|
| 2026-10-13 | (career v1) | `npm run typecheck` | ✅ clean |
| 2026-10-13 | (career v1) | `npx vitest run` | ✅ 130/130 (17 files; 6 new career tests: stop and resume on the club's series, engine map stats and exact re-watch, determinism across save/load mid-series, contract expiry, compaction keeps rankings identical) |
| 2026-10-13 | (career v1) | `xvfb-run -a npm run test:e2e` | ✅ 7/7 |
| 2026-10-13 | (career v1) | `npm run test:web` (Chromium, production web bundle) | ✅ 1/1: new career, every page, tactics change, live map with a call, sim, series result, reload → Continue on the same day, re-watch |
| 2026-10-13 | (career v1) | `scripts/dev/career.ts` (one season, all your maps by the engine) | 38 series / 89 maps in 25 s; save 7.5 MB raw, save 135 ms, load 128 ms; identical state after save/load |
| 2026-10-13 | (tactical AI v1) | `npx vitest run` | ✅ 121/121 (incl. 12 new tactical acceptance and scenario tests) |
| 2026-10-13 | (tactical AI v1) | Balance, 120 maps (`bal.ts`) | CT 50.9% (52), plant 64.7% (54), CT after plant 25.5% (23), pistol CT 50.8% (50), opening conversion CT 68.5% / T 67.9% (75/70) |
| 2026-10-13 | (tactical AI v1) | Tactical audit (`scripts/dev/tactics.ts`) | Squads stacked < 35 u in ~5–8% of moving samples; entry supported 87–92%; hits with utility 60–73%; rotations with recorded evidence 100%; 1.3 destination changes per player-round |
| 2026-10-13 | (tactical AI v1) | Invariants, 12 seeded maps (`scripts/dev/invall.ts`) | 0 violations |
| 2026-10-13 | `ad02ef2` | `npm run typecheck` | ✅ clean |
| 2026-10-13 | `ad02ef2` | `npx vitest run` | ✅ 109/109 (14 files) |
| 2026-10-13 | `ad02ef2` | `xvfb-run -a npm run test:e2e` | ✅ 7/7 |
| 2026-10-13 | `ad02ef2` | `npm run sim:career -- 20` | ✅ 12/12 checks (avg contracted skill 66.8 → 63.7) |
| 2026-10-12 | `05a1004` | Balance, 240 maps (`scripts/dev/bal.ts`) | CT 44.1%, plant 69.2%, CT after plant 21.4%, pistol CT 50.2%, opening conversion CT 59.9% / T 72.3% |
| 2026-10-12 | `05a1004` | `npm run sim:econ -- 60` | 0 invariant violations; full buys 72/68% (T/CT); half v full 4.6%; bonus v eco 81.5%; AWP on 95% of full buys |
