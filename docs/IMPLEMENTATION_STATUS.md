# Implementation status

Honest status of every major system. ✅ works and is tested · 🟡 partial · ⬜ not started. Details: `HANDOFF.md` §4.

| System | Status | Notes |
|---|---|---|
| Deterministic RNG, event log, replay | ✅ | Fingerprint and determinism tests |
| MR12 rules, overtime, economy, buys, drops, pick-ups | ✅ | Ledger and inventory invariants |
| Combat, utility, bomb, saves | 🟡 | Works. Side balance CT ~44% vs 52% target; plant rate ~69% vs 54% |
| **Tactical AI** | 🟡 v1 rebuilt | Director (6 plan templates, stages, replanning with cooldowns), squads (spaced files, distinct slots, synchronised arrival, utility-first hits, angle reactions, trades), beliefs (sightings, footsteps, gunfire, utility cues, with age and confidence), map intelligence (areas, exposure, covered routing, safe staging, geometry-derived execute utility), `ai` debug events, scenario harness and tests. Next: debug overlay in the viewer, CT-side squads, plant-rate tuning |
| Maps | 🟡 | 2 of 7 (Harbor, Switchyard) |
| Match viewer | 🟡 v2 broadcast | `src/renderer/broadcast/`. Near-3D three-quarter map rendering with AI textures and sprites, operator figures (rotation, walk bob, recoil, muzzle flash), tracers, billowing smokes, fire, flash, HE, bomb and defuse rings. Broadcast HUD: score bar with crests, portrait panels (weapon and utility icons, money, K/D, HP, armour, kit, bomb), kill feed (weapon, headshot, trade, assist), round-win banner, round history, timeline with event markers and seek, 1–8×, next round, stance calls, developer tactical overlay (D). Next: auto-director camera, sound, killcam/highlights, series score |
| AMR and stats, recap | ✅ | Mean 1.00 |
| Match Day (play / sim, stance calls) | ✅ | Quick Match demo; the same live flow is used inside the career |
| World: players, attributes, development | 🟡 | 10 engine attributes. The brief asks for 12 + 6 traits, development traits and OVR 40–99 role weights |
| Contracts, wages, ledger, finances | ✅ v1 | AI market. The manager can extend, release and sign free agents (club-led negotiation, outcome shown with the player's reasons); no offer editor or transfer bids yet |
| Rankings (ARP), lineage, tournaments, qualifiers, calendar | ✅ | 20-season validation passes |
| **Career mode (user org)** | ✅ v1 | `src/core/career/`. New career (any of 136 clubs, seeded world, simulated history), the club inside the live ecosystem, your series played by the engine (live with calls, or simulated), the calendar stops on match days, windows and invitations; qualifier choices; inbox; record and trophies; re-watch any played map exactly. Background (AI vs AI) series still use the fast resolver (KI-18) |
| Saves | ✅ v1 (browser) | IndexedDB slots, autosave after every action, gzip, SHA-256 checksum, automatic backup of the previous save, versioned format with a migration hook, export/import `.apexsave` files. Desktop SQLite store exists separately |
| Scouting | ⬜ | Scout staff exist; no reports |
| Sponsors, news, history/legacy | ⬜ | Inbox covers club news only |
| Career UI shell | ✅ v1 | Top bar (date, rank, cash, next event, Continue), sidebar, Dashboard, Inbox, Squad (profiles, lineup, extend, release), Free agents, Tactics (game plan + economy philosophy), Schedule (qualifier entry), Rankings, Results & stats, Finances, Settings, Match Center (VS intro, maps, line-ups, live/sim, recap, result) |
| Browser build | ✅ | `npm run build:web`, published privately as an Artifact; browser e2e `npm run test:web` |
| Windows build | 🟡 | CI produces an exe (shell only); release candidate later |
