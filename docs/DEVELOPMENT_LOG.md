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

## 2026-10-12: AMR (APEX Match Rating) core

- `match/stats/amr.ts` implements the owner's AMR brief in the HLTV Rating 3.0 structure, as an original calculation.
  - Six sub-ratings: Kill 30%, Swing 20%, Damage 15%, Survival 15%, KAST 10%, Multi-kill 10%.
  - Kills and damage are eco-adjusted by a duel-difficulty function of attacker vs victim gear (clamped to 0.5–1.6).
  - Round Swing comes from `winprob.ts`, which is shared with the engine's save logic: calibration-pack man-advantage seeds, plus gear odds, plus the plant. 70% of a kill's swing goes to the killer and the rest to damage and flash assisters. Victims lose what the killer's side gains.
  - Survival rewards won rounds and discounts passive saves and traded deaths.
  - Totals add up for series, event, season, career and T/CT, and are never averaged.
- `stats.ts` now reports AMR as the player rating, replacing the old Apex Rating.
- Calibrated on 1,000 player-maps: mean 1.01, sd 0.34. Tests in `tests/core/amr.test.ts`.

## 2026-10-12: Side balance pass (engine realism)

The diagnostics are reproducible with the dev tools:

| Tool | Shows |
|---|---|
| `scripts/dev/bal.ts` | quick metrics |
| `killmap.ts` | kills by killer and victim task |
| `atplant.ts` | alive counts at plant |
| `openbuy.ts` | opening conversion by buy |
| `plans.ts` | results by T plan |
| `holders.ts`, `blind.ts` | holder aim and flash checks |

**Root causes found:**
1. Rotating CTs ran onto sites the Ts already held, one at a time.
2. Lone anchors fell back while Ts were on top of them.
3. Gunfights took ~10 shots (rifle hit chance ~25–40%), which washed out positional advantages and favoured the group.
4. Shots right after stopping were instantly accurate.
5. Aim-offset (flick) had no cost.
6. The CT default pistol had no range advantage.

**Fixes:**
- Rotators regroup at retake stages. They step onto the site only when not outnumbered (`rotateIn`).
- Fallback needs a 650-unit head start.
- Accuracy raised (rifle 0.56→0.72, smg 0.62, pistol 0.55, heavy 0.85); headshot base 0.14 + 0.32·skill.
- Settle time: shots within 260 ms of stopping are less accurate.
- Flick cost: 2.4 ms per degree beyond 8° off the crosshair, scaled by aim.
- Retakes push with enough players while time remains, clear from several spots, and defuse when the site is clear or time forces it.
- Kestrel range 320, accuracy 1.12.

**Calibration (6,000 rounds), before → after:**

| Metric | Before | After | Target |
|---|---|---|---|
| Harbor CT | 34.3% | 50.1% | 53 |
| Switchyard CT | 32.2% | 47.2% | 51.5 |
| Opening conversion | — | 72.1% | 71.8 |
| CT win after plant | 13.4% | 24.7% | 23.1 |
| Pistol CT | 31.7% | 51.7% | 50.3 |

Also within tolerance: overtime 10.1%, eco and force upset rates, and halftime-lead conversions.

**Remaining deviations:**
- plant rate 66% vs 54%;
- retakes where all 5 Ts died 99.5% vs 89.5%;
- CT retake vs T eco 83% vs 59%;
- 4v3 71.8% vs 78%;
- solo 1v4 3.2% vs 1.5%.

**Follow-ups:**
- AMR refs recalibrated: mean 1.01. Role averages: star 1.16, AWP 1.04, anchor 0.98, entry 0.95, IGL 0.93.
- Golden snapshot updated for these intentional outcome changes.

## 2026-10-12: Player attributes and development v2

- **Attributes:** world players now carry the engine's ten attributes plus hidden per-attribute ceilings (`world/attributes.ts`).
  - Overall rating is role-weighted: AWPers on AWP and positioning, IGLs on calling and game sense, anchors on positioning and clutch.
  - Generation emphasises each role's focus attributes.
- **Staff:** every club has a head coach and a scout (quality by archetype). There's a free-agent staff pool: 45 coaches and 60 scouts. Featured coaches come from art data.
- **Development** (`evolution.develop`) is automatic, with no chores. Each attribute moves toward its ceiling at a rate set by:
  - age: mechanical skills peak around 19–25 and decline from about 28; tactical skills grow until about 31;
  - the head coach's Development rating (×0.6–1.4);
  - playing time (starter 1.0, bench 0.65, free agent 0.55);
  - competition level.

  Declines lower ceilings too.
- **Validation:** 20-season validation still passes 12/12; average skill holds steady (67.6 → 65.6 over 20 seasons). Tests in `tests/core/development.test.ts`.

## 2026-10-12: Match day: Play match, Sim match, Match recap

- `MapSimulation` refactor. `simulateMap` is now a thin wrapper, and results are bit-identical (golden unchanged).
- Manager stance calls are inputs (`MapSimInput.instructions`), emitted as `call` events and applied at the next freeze time.
- Screens: match setup, live play (stance panel, speeds, sim to end) and recap with storylines.
- Tests: `tests/core/matchday.test.ts` (replay equality, calls matter, recap contents) and `e2e/matchday.spec.ts`.

## 2026-10-12: Madden-style OVR/POT

- `world/ratings.ts` maps the internal role-aware overall to a 1–99 display OVR (and POT from the hidden ceiling). Anchors: skill 75 → 80, 83 → 87, 89 → 91, 92 → 95, 94.5+ → 99.
- Each world generates two generational talents at 99. The engine scale is unchanged.
- After 1.5 seasons: 95% of top-16 starters are 80+ (median 87), 19 players are 90+, two are 99; the rostered median is 70 and the free-agent median 51.
- Shown on match setup (team OVR) and the recap. Tests in `tests/core/ratings.test.ts`.

## 2026-10-12: Ratings that mean something; economy audit

- **Skill impact steepened.** Hit chance is now `0.2 + 0.0115·skill` (was 0.32 + 0.0098·skill) and reaction `285 − 1.6·skill` ms (was 265 − 1.25·skill).
  - Measured (`scripts/dev/ovrimpact.ts`): AMR ≈ 1.0 + 0.026 × (skill − lobby average).
  - A 99-OVR star joining a 57-OVR team averages 1.86 AMR (worst map 1.35, best 2.61), and the team's wins go from 5/12 to 8/12. Strong, but lower-tier teams still win a third of the maps (owner: "the 99 will not always destroy them").
  - Balance unchanged within noise: CT 49.3%. AMR mean 1.00.
- **Economy audit** (`scripts/dev/buyaudit2.ts`, from post-buy loadouts):
  - no purchase ever leaves negative money;
  - on full buys, armour and helmet come before the gun, the AWP only when affordable (otherwise a rifle, budget rifle or SMG), then kit, then utility;
  - rifle and AWP drops to poorer teammates.
- **Fix:** an AWPer still holding last round's rifle now buys the AWP when affordable and drops the rifle to a teammate without one. AWPer-rich-but-no-AWP cases went from 25 to 3; those 3 are team eco rounds, which is intended.
