# PROJECT APEX: Master handoff

> **For a new Claude Code session:** read this whole file first. It is the single source of truth for what exists, what the owner decided, what's in progress and what's next.
> Then read `CLAUDE.md` (working rules), `docs/GAME_DESIGN.md` (the authoritative product spec) and the docs linked below for the area you're touching.
> **Keep this file current.** Update it in the same commit as any meaningful change: status table, decision log, backlog and change log.

Last updated: 2026-10-12 · Repo: `github.com/jakehabib/project-apex` (private), branch `main` · Owner: Jake (non-technical; explain in plain English, one step at a time).

---

## 1. What we're building

This is a premium tactical-shooter esports management game, in the spirit of Counter-Strike team management: CS-faithful rules with **original IP only**. The owner wants Steam-quality ("AAA, people will pay for it") and eventually a **web-browser version**.

You run an esports organisation:

- sign and develop players, run academy teams, hire staff;
- win sponsors and fans;
- climb the **APEX Ranking Points (ARP)** world rankings, earn tournament invitations and qualify for World Championships;
- watch every match on a 2D tactical broadcast viewer.

**Non-negotiables.** They are enforced by tests where possible.

- No fatigue, stamina, injuries, wear and tear, burnout, training grind or equipment upkeep (or renamed equivalents).
- One deterministic seeded simulation powers results, stats, instant-sim and the viewer. No `Math.random` or `Date.now` in `src/core`.
- `src/core` imports nothing outside itself.
- Original IP only: no Valve, Counter-Strike, real teams, players, maps or logos. Real CS2 maps were explicitly declined because of IP risk.
- Electron security: contextIsolation on, sandbox on, nodeIntegration off, CSP, a narrow frozen preload. Compare scheme+host, never `URL.origin`.
- Don't claim a gate passes without evidence. Record it in `docs/PHASE_GATES.md` and `docs/DEVELOPMENT_LOG.md`.
- The **match engine is "the life of the game"** (owner). Realism and calibration come first.

## 2. Owner decision log (chronological; these are requirements)

| # | Request or decision | Status |
|---|---|---|
| 1 | Build the game from two specs (`docs/START_HERE.md`, `docs/GAME_DESIGN.md`); Phase 0 feasibility first | ✅ Phase 0 passed |
| 2 | New private repo `project-apex` | ✅ |
| 3 | "CS-faithful, original IP": CS2-like rules, economy and weapon roles; original names and maps | ✅ ongoing rule |
| 4 | Comprehensive sim engine: coach, IGL, AWPer, star rifler, anchors matter | ✅ v1 in engine; tuning ongoing |
| 5 | Integrate the ChatGPT calibration data pack as *targets*, never dice rolls; unverified = hypothesis; 100k-round testing with deviation flags; in-dev **Simulation Analytics screen** | 🟡 harness done (`sim:calibrate`); analytics screen not built; side balance off |
| 6 | Screenshots; "more AAA"; maps impressive in "design, variance and detail, not basic 3 lane" | 🟡 v2 maps + art pass done; more maps needed |
| 7 | In-depth scouting; player stats on an **HLTV-like rating scale** | ⬜ planned (task 5) |
| 8 | Overtime exactly like CS2 (MR3, keep sides at OT start, swap at OT half, $12,500 each OT half) | ✅ verified + tests |
| 9 | Realistic tournament schedule; our own VRS → now named **APEX Ranking Points (ARP)**. Full brief stored in `docs/ARP_BRIEF.md` | 🟡 in progress (see §5) |
| 10 | **Full 7-map pool** like real CS2 | 🟡 2 playable (Harbor, Switchyard); 5 named with key art (Citadel, Glassworks, Plateau, Underpass, Foundry) |
| 11 | AI-generated player photos via the OpenAI API; key entered securely; don't generate before setup verified | ✅ done (see §6) |
| 12 | Use the tool for maps, players, teams and uniforms; $100 OpenAI credit available to "make it as good looking as possible" | ✅ first batch (~$10 used) |
| 13 | **Jersey overlay in game** so transfers don't need new images | ✅ `src/renderer/art/jersey.ts` |
| 14 | Teams **save** when appropriate (e.g. 5v2 post-plant) | ✅ `engine/save.ts` |
| 15 | Map veto processes, tournament qualifiers, tournament schedules | 🟡 veto + formats written; calendar in progress |
| 16 | ARP ecosystem brief: global and regional rankings, monthly frozen snapshots, invitations, open qualifiers, roster-continuity rule (3 of 5), Tier 1/2/3, 2 World Championships a year, AI orgs, 20-season validation, screens | 🟡 in progress |
| 17 | Playable in a **web browser** | ⬜ planned (task 11) |
| 18 | **Player development:** attributes that grow, age curves, coaches affect development; scouting a young player in the "minor" leagues and watching them become a star must be hugely rewarding | ⬜ planned (task 10) |
| 19 | **Academy teams** managed like minor-league baseball affiliates | ⬜ planned (task 12) |
| 20 | An in-game **FACEIT-like matchmaking platform** (original name) with player Elo; scout unknown players there | ⬜ planned (task 13) |
| 21 | Org realism: **sponsors, staff, finances**, plus **team followers and fans** | ⬜ planned (task 14) |
| 22 | This handoff file, logging everything | ✅ (keep updated) |
| 23 | AI transfers, benching, free-agent signings, **based on need and realistic** (no benching a week after signing except rare cases) | ✅ v1 in `world/evolution.ts` (tenure protection, role needs, bench/transfer list) |
| 24 | Anchors don't post star/AWP stats: the game must recognise roles | ⬜ role-aware ratings/scouting (task 5) |
| 27 | **Play match / Sim match** with live decisions (aggressive/medium/passive), speeds 1x/2x/4x, sim-to-end; **match recap** page with all stats and storylines | ✅ v1 |
| 29 | **Madden-style 1–99 OVR/POT**: Tier 1 mostly 80+, truly elite 90+, generational (top real-world-star level) 99 | ✅ `world/ratings.ts` display mapping; 2 generational talents per world |
| 30 | Ratings must make sense: a 99 joining a weak team should dominate lower tiers, but not always (lower-tier players are still good) | ✅ steeper skill impact; 99 in a 57-OVR team: 1.86 AMR, wins 8/12 |
| 31 | **Form and breakouts**: good form can trigger a breakout that raises potential | ⬜ next |
| 32 | Guns cost real amounts; teams adjust buys (an AWPer who can't afford AWP + util buys armour first, etc.) | ✅ audited (`scripts/dev/buyaudit2.ts`), AWPer upgrade fix |
| 33 | **Economy and utility research** (owner-supplied; `data/economy/reference-2026-10-12/`): exact ledger, coordinated buys, half buy, AWP financing, GM economy settings, purposeful utility, report; hypotheses labelled | ✅ v1, see `docs/ECONOMY_RESEARCH.md` (open: eco/half wins vs full too low, HE rarely bought) |
| 34 | **Player salary and contract market** (2025–26 pro CS reference bands $0–$100k+/month; value from ability, potential, form, reputation, demand, leverage, age, role, ambition; wages, signing bonuses, lengths, extensions, buyouts, prize share; AI budgets and negotiation with understandable motives; forecasts; explicit owner subsidies; multi-season validation; no busywork) | ✅ v1 core: `world/contracts.ts` (market value with explained factors, deterministic negotiation with reasons, contracts, release clauses, prize share, ledger, explicit backers, forecasts), AI windows in `evolution.ts`, Club Finances tab; tests `contracts.test.ts`; 20-season validation passes. Next: finance checks in the validation report, user-org negotiation UI |
| 35 | **Web game preferred**: the browser is the primary target; the desktop shell becomes an optional wrapper (Steam later) | 🟡 `npm run build:web` → static site in `dist-web/` (verified in Chromium: Match Day + World run); browser saves (IndexedDB) next |
| 37 | **Viewer look:** top-down, but rendered to look close to 3D (competitor reference: detailed map, portrait side panels, kill feed, score bar, round timeline) | ⬜ after tactical AI |
| 38 | **Rebuild tactical match intelligence** (owner brief): Director / Squad / Player AI layers, map tactical semantics, plan templates, honest information, coordinated utility, adaptation, debug overlay, scenario tests; one excellent round on one map first | ⬜ next, top priority |
| 36 | **Shift-walking** works properly: silent, slower, used contextually | ✅ quiet approaches for slow teams, CT info pushes, lurkers; clock forces running; walking aim steadier than running |
| 28 | "Incredibly detailed game" including **the best aspects of any GM games** | 🟡 see `docs/GM_FEATURES.md` (feature matrix mapped to backlog) |
| 26 | **Work through the backlog autonomously**: don't stop to ask whether to continue; keep going down §7 and report progress | ✅ standing instruction |
| 25 | **AMR: APEX Match Rating**, HLTV Rating 3.0 style (near 1:1). Full spec in `docs/AMR_BRIEF.md` | 🟡 core done (`match/stats/amr.ts`, calibrated mean 1.01, sd 0.34); UI scoreboard/analytics next |

## 3. Tech stack and repo map

- **Stack:**
  - Electron 44.4.5, React 19, TypeScript 6, Vite 8, Vitest 5, PixiJS 8 (`pixi.js/unsafe-eval` import), Zod 4, Zustand 5, Playwright 1.63, electron-builder 26.
  - Saves use `node:sqlite`.
  - `.npmrc` has `legacy-peer-deps=true` to work around an npm bug.
- **Commands:**
  - `npm run typecheck` checks 4 TypeScript projects.
  - `npm test`
  - `xvfb-run -a npm run test:e2e`
  - `npm run sim:determinism`, `sim:balance`, `sim:calibrate -- <rounds>`
  - `npm run art:check | art:plan -- <set> | art:make -- <set>`
  - Dev tools: `node scripts/dev/run.mjs scripts/dev/<tool>.ts`. Tools: duels, diagnose, shots, openbuy, firstspot, saves, killdist, speed, sites, retake, parity, and others.

| Path | What |
|---|---|
| `src/core/rng` | `apex-rng/1` seeded PRNG (cyrb128 + sfc32), fork streams |
| `src/core/match/events.ts` | Match event contract (the engine and viewer speak only events) |
| `src/core/match/rules` | `arsenal.ts` (original weapons, CS-like stats), `ruleset.ts` (MR12, economy, CS2 overtime) |
| `src/core/match/maps` | Tile-map system v2: `tilemap.ts` legend/compiler, `grid.ts` LOS/walkability, `nav.ts` Dijkstra all-pairs + side-safe routing; `harbor*.ts`, `switchyard*.ts` (generated layouts from `scripts/maps/*.py`) |
| `src/core/match/engine` | Tick engine (50 ms): perception, combat, movement, utility, economy, attack/defense AI, coach timeouts, **save.ts** (save decisions), `match.ts` (`simulateMap`) |
| `src/core/match/stats` | Stats fold, Apex Rating, invariants checker |
| `src/core/match/replay` | Position reconstruction (exact parity with the engine) |
| `src/core/calibration` | Benchmarks from the data pack, telemetry, comparison report |
| `src/core/world` | `calendar.ts` (day numbers, season 0 = pre-history), `types.ts` (Player, Org w/ bench, World, regions EU/AM/AS), `names.ts`, `generate.ts` (136 orgs + free agents; featured clubs passed in), `evolution.ts` (development v1, retirements, prospects, need-based AI transfers/benching, finances v1) |
| `src/core/competition` | `lineage.ts` (roster continuity), `records.ts` (idempotent results), `arp.ts` (ranking model), `veto.ts` (BO1/3/5), `formats.ts` (single/double elim w/ byes, Swiss, GSL, round robin), `tournaments.ts` (configs, stages, prizes), `schedule.ts` (season calendar), `ecosystem.ts` (day loop: snapshots, invitations, qualifiers, events, roster windows), `quickResolver.ts` (validation-only), `validation.ts` (brief checks + report), `mapPool.ts` (7-map pool) |
| `src/persistence` | SaveStore (SQLite, atomic, backups, migrations, append-only ledger) |
| `src/shared` | IPC types, save schemas, **art data** (`src/shared/art/world.json` = 8 featured clubs, 40 players, 8 coaches, kits; `portraits.json`, `logos.json`, `maps.json` prompt specs) |
| `electron/` | main/preload/security (custom `app://apex` protocol, CSP) |
| `src/renderer` | React UI: TitleScreen, ViewerProof (tactical viewer), SystemsCheck, **ArtGallery**; `viewer/` Pixi renderer + procedural map art; `art/generated.ts` + `art/jersey.ts` (kit compositor) + `components/PlayerPortrait.tsx` |
| `src/renderer/assets/generated` | AI images: `portraits/` (48), `logos/` (8), `maps/` (7) |
| `art/manifest.json` | Provenance: model, prompt and date for every generated image |
| `data/calibration/apex-cs2-2026-10-12` | Vendored calibration pack |
| `docs/` | GAME_DESIGN (spec), START_HERE, TECH_ARCHITECTURE, PHASE_GATES, DEVELOPMENT_LOG, KNOWN_ISSUES, ART_PIPELINE, COMPETITION_DESIGN |
| `.github/workflows/ci.yml` | Linux (typecheck, unit, determinism, e2e) + Windows (package + launch the .exe) |

## 4. System status

| System | Status | Notes |
|---|---|---|
| Electron shell, security, saves, packaging, CI (Linux + Windows exe) | ✅ | Phase 0 gate passed (`docs/PHASE_GATES.md`) |
| Match engine (MR12, economy, bomb, utility, roles, coach, OT) | ✅ v1 | 0 invariant violations in batches; replay parity exact |
| **Economy ledger and buys** | ✅ v1 | `docs/ECONOMY_RESEARCH.md`. Invariants replay every wallet, payout (loss ladder step-down, plant-loss $800, kill awards by weapon), inventory (no vanished purchases, no duplicated drops, pick-ups only from the dead) and grenade limits. Half buy, AWP financing via drops, weapon recovery, GM `EconomyPolicy` (aggression, AWP priority, utility focus, save discipline). Report: `npm run sim:econ -- 60` (latest: 0 violations; full 72/68% T/CT; half v full 4.6%; bonus v eco 81.5%; AWP on 95% of full buys; plant 68.5%; retake 23.3%). |
| Save decisions | ✅ | `engine/save.ts`; check with `scripts/dev/saves.ts` |
| **Side balance** | 🟡 mostly fixed | Latest quick check (60 maps, `bal.ts`): CT 48.8%, plant 65%, after-plant 24% ✅, pistol 50% ✅. Utility now used realistically (T molotov on an anchor spot, CT pop-flashes, retake smokes; players step out of fire); Ts plant only when the site is clear/won or late. Earlier full calibration: Harbor CT 50.1% (53), Switchyard 47.2% (51.5), opening conversion 72.1% ✅, CT after plant 24.7% ✅, pistol CT 51.7% ✅, OT/eco/force/halftime ✅. Open: plant rate 66% (54), all-5-T-dead retakes 99.5% (89.5), 4v3 71.8% (78). Dev tools: `scripts/dev/bal.ts`, `killmap.ts`, `atplant.ts`, `plans.ts`. |
| Engine speed | ⚠️ | ~380 ms per map (was 520; bit-identical optimisations). Plan: multi-core worker pool + day-by-day background simulation (FM-style) before the ecosystem uses the engine resolver |
| Maps | 🟡 | Harbor and Switchyard (v2 tile maps, design-rule tests). 5 more needed for the 7-map pool |
| Tactical viewer | ✅ v1 | Procedural art, tokens, effects, camera. Scoreboard and highlights not yet |
| AMR rating | 🟡 | `match/stats/amr.ts` + `winprob.ts`; six sub-ratings, eco-adjusted duels, round swing from the shared win-probability model, totals for map/series/season/career/side. Calibrated (`node scripts/dev/run.mjs scripts/amr-calibrate.ts 100`): mean 1.01, sd 0.34, p95 1.65, winners 1.16 vs losers 0.86; by role AWP 1.18, star 1.08, anchor 1.00, IGL 0.94, entry 0.85. Tests `tests/core/amr.test.ts`. Viewer **scoreboard** (Tab / button): K/D/A/ADR/KAST/AMR live to the current round; click a player → six sub-ratings, plain-English explanation vs role baseline, openings, clutches, multi-kills, T/CT split (`components/Scoreboard.tsx`, e2e `scoreboard.spec.ts`). **Next:** analytics view (distribution, by role, outliers), 100k-performance calibration. |
| Calibration harness | ✅ | `npm run sim:calibrate -- 100000` → `reports/` |
| AI art pipeline | ✅ | See §6 |
| Kit compositor (jersey swap) | ✅ | Chroma-key green top → team kit + crest in game |
| ARP ecosystem (core) | ✅ v1 | `src/core/competition/*` + `world/evolution.ts`. `npm run sim:career -- 20` → `reports/career-validation.md`: **all 12 brief checks pass** over 20 seasons (≈20 s, 78k series): invites follow frozen snapshots, regional lists, continuity, no duplicate points, exhibitions ignored, strength↔rank ρ≈0.89, climbers, inactivity drop-out. Tests in `tests/core/competition.test.ts`. **Screens done** (main menu → World Rankings & Calendar; `screens/WorldHub.tsx`, `workers/world.worker.ts`, view-models `competition/views.ts`): rankings (global/regional, movement, peak, history chart, ARP explanation, upcoming cutoffs), calendar (statuses Directly Invited/Qualified/Qualifier Available/Invite Pending/Below Cutoff/Ineligible/Declined/Completed with reasons), event detail (facts, format, standings, invitations with explanations, passed-over teams, qualifiers), invitation forecast (cautious, historical reach), +1 week/+1 month time advance; e2e `world.spec.ts`. **Next:** user-org decisions (accept/decline, qualifier entry, transfer continuity warnings), engine-backed resolver. Tuning: Asia slightly over-represented in top 20 (4–6), avg skill drifts −2 over 20 seasons. |
| Management (contracts, transfers, finances, sponsors, staff, fans) | ⬜ | Tasks 3, 14 |
| Player development | 🟡 v2 | Ten engine attributes + hidden ceilings, role-aware overall, age curves (mechanical vs tactical), coach Development, playing time, level (`world/attributes.ts`, `evolution.develop`); staff (coaches, scouts) in `World.staff`. Next: scouting reports (estimates with uncertainty), matchmaking ladder, academies. |
| Match day (Play/Sim + recap) | ✅ v1 | Main menu → Match Day. `MapSimulation` (engine/match.ts) plays a map round by round; manager stance calls (Aggressive/Balanced/Passive, `coach.ts` STANCE_DELTA) are recorded inputs applied at the next freeze time, so `simulateMap(input + instructionLog)` reproduces a played match exactly (test `matchday.test.ts`). Live view 1x/2x/4x, pause, Sim to end; Sim match; **Match Recap** (`match/stats/recap.ts`, `screens/MatchRecap.tsx`): score/half, round history with icons and highlights, MVP card with kit-composited portrait, storylines (result, MVP, clutches, 4K/aces, pistols, eco upsets, streaks, comebacks, overtime, timeouts, your calls and their effect), team comparison, full scoreboard with T/CT AMR. World teams play with real attributes via `world/teamSetup.ts`. e2e `matchday.spec.ts`. Next: tactical timeouts by the manager, BO3 series flow with veto screen, half-time talk. |
| Web build | 🟡 | `npm run build:web` (vite `--mode web`) → `dist-web/`, a static site; the renderer already runs without the desktop API. Verified in Chromium (Match Day sim, World hub). Published privately as an Artifact for owner testing. Next: browser saves (IndexedDB), hosting. |

## 5. ARP ecosystem: design summary (full detail in `docs/COMPETITION_DESIGN.md`)

- **Rosters:**
  - Ranking belongs to a **lineage** (a competitive core of 5 players). Keeping ≥3 core players keeps it; replacing 3 loses it.
  - If a core moves clubs, the new club inherits the lineage. Duplicates are impossible.
- **The score:**
  - ARP = seed `400 + 1600 × mean(prize standing, bounty collected, opponent network)`, adjusted by a recency-weighted Elo-style head-to-head pass.
  - Results count over a 180-day window: full weight for 30 days, then a linear fade.
  - Each factor counts only its best 10 contributions. Tier is never a multiplier.
- **Listing and snapshots:**
  - To be listed, a team needs ≥5 ranked series in the window and one in the last 90 days.
  - Snapshots are published monthly and frozen. Invitations use the snapshot named by each event's cutoff.
- **Calendar per season:**
  - Tier 1 internationals (~8), Tier 2 (~12, global and regional), Tier 3 regional cups.
  - Open and closed qualifiers.
  - 2 World Championships (June, December) with regional qualification.
- **Match resolution:**
  - In game, the real engine plays every match (veto → `simulateMap` per map).
  - The 20-season validation uses a **labelled test-only strength resolver** for speed.

## 6. AI art pipeline (OpenAI): how it works and how it was set up

- **Key:** stored by the owner as a **Network secret** for `api.openai.com` in the Claude Code cloud environment settings. The proxy attaches it, so the key never enters the session. Never ask for the key in chat.
  - Fallback: an `OPENAI_API_KEY` environment variable plus `api.openai.com` in Allowed domains.
- **Tool:** `scripts/art/art.mjs`.
  - `check` is free and makes no images.
  - `plan` shows prompts and cost.
  - `make` streams generation (the cloud gateway drops silent requests after ~30 s), retries 429/5xx, runs `--jobs` in parallel, caps at `--max` (default 10), and skips existing files unless `--redo`.
- **Sets:**
  - `logos`: transparent crests from `world.json` teams.
  - `portraits`: transparent cut-outs in a **#00B140 chroma-key green top**, high quality, for players and coaches from `world.json`.
  - `maps`: 1536×1024 key art.
- Model `gpt-image-1` (owner's choice). The key can also use gpt-image-1.5/2/2.5 variants.
- **In game:** `art/generated.ts` (URLs), `art/jersey.ts` (`composeKitPortrait`), `components/PlayerPortrait.tsx`, `screens/ArtGallery.tsx` (team pages, transfer preview, map art).
- **Spend:** ~$10 of $100 so far.

## 7. Backlog, in priority order

Work through this list continuously (owner instruction #26). The feature reference is `docs/GM_FEATURES.md`.

1. **Scouting:** reports with uncertainty, scout assignments, wonderkid alerts. Player cards with OVR/POT, attributes and traits.
2. **Matchmaking ladder** (original FACEIT-like platform) as the amateur pool, with Elo and scouting there. **Academies** as minor-league affiliates.
3. **Org management:** contracts and negotiations, finances ledger, sponsors with objectives, fans and followers, staff hiring, facilities and bootcamps, board goals; personalities and morale (bounded).
4. **Career mode:** user org in the ecosystem; accept/decline invites; qualifier entry; continuity warnings; dashboard; news feed; delegation.
5. **5 more maps** (Citadel, Glassworks, Plateau, Underpass, Foundry) to the v2 standard. This unblocks engine-backed BO3 world series.
6. **Engine-backed world matches:** worker pool, day-by-day; the veto screen; manager timeouts and half-time talk; series flow (BO3/BO5).
7. **Engine balance:** plant rate ~69% vs 54%; CT 44.1% over 5,255 rounds after the economy pass (was 47.2% at `63c7132`; the drop is spread across realistic changes: weapon recovery, half buys, plant-loss $800, SMG range); eco/half vs full wins ~5% (needs eco-round stack/ambush tactics); HE rarely bought (utility plan order). AMR analytics view and 100k calibration.
8. **History:** records, hall of fame, player and team career pages, trait badges.
9. **Web build.**
10. Steam API spike (blocked: needs a Steamworks account).

## 8. Known issues and gotchas

- **Calibration:** side balance is off (see §4). `reports/` is gitignored, so re-run `sim:calibrate` to regenerate it.
- **Shell:** `pkill -f` patterns can kill the agent's own shell. Kill by explicit PID instead.
- **Playwright:** the standalone launcher needs `executablePath: '/opt/pw-browsers/chromium'`. Electron e2e works through `xvfb-run -a`.
- **Node fetch through the cloud proxy:** set `NODE_USE_ENV_PROXY=1`. `art.mjs` re-spawns itself with it.
- **Snapshots:** golden snapshots (`tests/core/__snapshots__`) change whenever engine behaviour changes on purpose. Update them with `npx vitest run -u` and log why.
- **Map authoring:** edit `scripts/maps/<map>.py`, then run `python3 scripts/maps/<map>.py preview.png` to regenerate the `.layout.ts`.

## 9. Change log (newest first; one line per commit or milestone)

- (this commit) Tactical AI v1: director, squads, beliefs, map intelligence (exposure, covered routes, safe staging, derived execute utility), scenario harness, 12 tactical tests; Harbor v6 sight blockers; master directive docs
- `ad02ef2` Contract and salary market v1, club finance ledger, Club Finances screen, world v3 migration, PROJECT_OVERVIEW.txt
- `05a1004` Economy research integration: ledger + inventory invariants, plant-loss $800, half buy, AWP financing, weapon recovery (AK over M4; dropped AWPs taken unless a rich CT prefers the AK), GM economy settings, purposeful HE, SMG range fix, contextual shift-walking, `sim:econ` report; web build (`build:web`)

- `d4367e6` Art: 8 crests, 48 portraits with kit compositing, 7 map key arts; gallery team pages and transfer preview; competition design doc
- `14fdf67` Engine: situational saves; mid-edge pathing fix; bomb anchoring fix
- `4a74225` First 5 AI portraits · `0783c0a`/`433eee8` art tool via network secret + proxy · `f2adbed` AI art pipeline + gallery
- `7676af2` Viewer art pass (procedural map art, tokens, effects, camera)
- `52cd383` CI determinism on the real engine; Windows .exe gate verified
- `f6401b4` Map system v2 (tile maps, generated nav); CS2 overtime verified
- `a55b50d` Phase 1 match engine, roles/coach, invariants, calibration harness
- `e83bf3b`, `d7ff980`, `486b5bb` Phase 0: scaffold, RNG, secure shell, saves, viewer proof, packaging, CI
- (next commit) ARP ecosystem v1 complete in core: tournaments, schedule, season runner, AI decisions, need-based transfers/benching, validation report (12/12 pass over 20 seasons), tests

## 10. How to resume

1. `npm install` (uses `.npmrc`), `npm run typecheck && npm test`.
2. Read §4 and §7. Continue the first unchecked item.
3. Before committing, follow `CLAUDE.md`. Update **this file** (sections 2, 4, 7 and 9) and `docs/DEVELOPMENT_LOG.md`.
4. Commit attribution footer lines go at the end of every commit message (the session provides them). No model names in commits.
