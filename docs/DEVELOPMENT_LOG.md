# Development Log

## 2026-10-12: Phase 0 feasibility

**Decisions**
- New standalone repository `jakehabib/project-apex`; nothing shared with other projects.
- Content direction (owner decision): **CS-faithful gameplay with original IP.** MR12 format, CS-style economy values, weapon roles, prices, kill rewards and bomb timers as data. Weapon names, maps and branding are original; `equivalentClass` documents the gameplay role internally only.
- Stack per `TECH_ARCHITECTURE.md`. Versions pinned to releases at least 2 weeks old. TypeScript 6 chosen over 7 (native port) for tooling compatibility.
- `node:sqlite` instead of `better-sqlite3`: the spike showed better-sqlite3 failing in Electron with an ABI mismatch, while node:sqlite works out of the box.
- 1 map unit = 0.1 m; run speed 5 m/s (50 u/s). Harbor spawn-to-site runs are 10–30 s.
- MR12 ruleset: start $800, max $16,000, loss bonus 1400→3400, OT MR3 at $12,500. Overtime keeps second-half sides for its first half, then swaps every 3 rounds. All configurable.

**Bugs found by tests and fixed**
- Grid traversal could step past the end cell on exact-corner diagonals, producing false "blocked" results and asymmetric line of sight. Fixed with a segment-end guard; a symmetry test now covers all node pairs.
- Harbor had a spawn-to-spawn sightline straight down mid. Added a mid container (it also gives mid real cover).
- **Security:** IPC trusted-sender and navigation checks compared `URL.origin`, which is the string `"null"` for `app:` and for `file:`. A file:// frame would have compared equal. Replaced with explicit scheme and host checks plus unit tests.
- The e2e "eval is blocked" probe was meaningless (DevTools evaluation is CSP-exempt). Replaced with checks of the served CSP header and of page-inserted inline script.
- Vision cones were drawn through walls. They are now ray-cast against the authoritative sight grid.
- Several attackers stacked on one node. Site destinations are now distinct.
- The packaged app.asar was 102 MB because it shipped node_modules and sourcemaps that were never loaded. Everything is bundled, so it's now 2.7 MB.

**Verified**
- `npm test`: 52 unit/invariant tests pass. `npm run typecheck`: 4 projects clean.
- `npm run sim:determinism`: 500 seeds, 0 mismatches, 500 distinct, ~18 ms per 45 s simulation.
- `npm run test:e2e`: 3 Electron e2e tests pass (isolation and CSP, viewer FPS 56–59, save survives restart).
- Packaged Linux build: launch, viewer, save and relaunch smoke test pass. Windows `.exe` cross-built (PE32+ x86-64 GUI), launch pending on CI.
- This container has no GPU (WebGL/WebGPU blocklisted). PixiJS fell back to Canvas 2D, and the UI now reports this instead of hiding it.

**Next:** T10, the round state machine and economy (Phase 1).

## 2026-10-12: AI art pipeline

- `scripts/art/art.mjs` (`art:check` / `art:plan` / `art:make`) generates fictional player portraits and map key art through the OpenAI Images API. The key is read only from `OPENAI_API_KEY`; `check` and `plan` never generate or bill.
- Shared style prompts in `src/shared/art/*.json` keep lighting, framing and jerseys consistent. There are 5 test portraits and 2 map key arts.
- In game: `src/renderer/art/generated.ts` plus the **Art Gallery** screen. Verification: `e2e/gallery.spec.ts` with a temporary dummy image showed generated files are bundled and decode under the CSP; the dummies were removed afterwards.
- Blocked on the owner's setup: in this cloud environment the key is not yet set and `api.openai.com` is denied by the network policy. Nothing has been generated yet.
- Balance diagnostics, in progress: `scripts/dev/{firstspot,shots,openbuy}.ts` and an optional `shot` trace in `fireAt`.
  - Full-buy opening duels are close to even (T 53%), but full-buy T round win is 61%.
  - Pistol-round T openings are 75%, which is the next fix.

## 2026-10-12: Save decisions, movement and bomb anchoring fixes

- `engine/save.ts`: teams save when their estimated round-win chance falls below a threshold scaled by how much the survivors' equipment matters next round.
  - The win chance starts from the pack's man-advantage seeds, adjusted for the plant, clock and gear.
  - The threshold is skipped on the last round of the half and on the opponent's match point.
  - The current caller decides; disciplined teams follow the call more reliably.
  - This replaces the ad hoc 1vX and late-round save rolls.
  - Example behaviour (`scripts/dev/saves.ts`): CTs save in 1v3, 2v4 and 3v5 post-plant and in 2v5 pre-plant; Ts save in 1v4 and 2v5 with the clock running. Close spots like 3v5 pre-plant are played out.
- Fix: after two stops on a smoothed segment, the last node could be out of straight-line reach. `setPath` now only starts from reachable nodes.
- Fix: dropped and planted bombs are anchored to a nav node with a legal straight walk (`anchorNode`). Found by the invariant checker on switchyard seed `inv-5`.
- Golden snapshot updated for these intentional outcome changes.
- Side balance is unchanged and still open: CT ~35% vs a ~52% target.
- Engine speed: ~520 ms per map. A world calendar needs this optimised (next).

## 2026-10-12: ARP ecosystem v1 (core)

- **New modules:** world generation (136 orgs, 3 regions), roster lineage (3-of-5 continuity, moved cores inherit), idempotent records, the ARP model, BO1/3/5 veto, formats (single and double elimination, Swiss, GSL, round robin), tournaments with prize splits, the season calendar and the day-by-day ecosystem runner.
- **Behaviour covered:**
  - monthly frozen snapshots; invitations in rank order with recorded skips and explanation strings;
  - open qualifiers; late replacements; continuity checks at events;
  - AI event choices (prestige, conflicts, travel budget);
  - need-based AI transfers and benching (180-day tenure protection, role needs, transfer-listed bench);
  - development v1, retirements, prospects.
- **Validation:** `npm run sim:career -- 20`. All 12 brief checks pass on seed career-1: 78k series, Spearman 0.89, 0 snapshot mismatches, 0 wrong-region invites, 0 duplicate histories.
  - It uses a labelled validation-only strength resolver; in game, the engine resolves series.
- **Tuning notes:** Asia has 4–6 teams in the top 20 (aim for fewer); average skill drifts −2 over 20 seasons. To be revisited with the development model (task 10).
