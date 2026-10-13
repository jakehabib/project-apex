# Implementation status

Honest status of every major system. ✅ works and is tested · 🟡 partial · ⬜ not started. Details: `HANDOFF.md` §4.

| System | Status | Notes |
|---|---|---|
| Deterministic RNG, event log, replay | ✅ | Fingerprint and determinism tests |
| MR12 rules, overtime, economy, buys, drops, pick-ups | ✅ | Ledger and inventory invariants |
| Combat, utility, bomb, saves | 🟡 | Works. Side balance CT ~44% vs 52% target; plant rate ~69% vs 54% |
| **Tactical AI** | 🟡 v1 rebuilt | Director (6 plan templates, stages, replanning with cooldowns), squads (spaced files, distinct slots, synchronised arrival, utility-first hits, angle reactions, trades), beliefs (sightings, footsteps, gunfire, utility cues, with age and confidence), map intelligence (areas, exposure, covered routing, safe staging, geometry-derived execute utility), `ai` debug events, scenario harness and tests. Next: debug overlay in the viewer, CT-side squads, plant-rate tuning |
| Maps | 🟡 | 2 of 7 (Harbor, Switchyard) |
| Match viewer | 🟡 | 2D PixiJS viewer with a Tab scoreboard. No kill feed, broadcast HUD or near-3D look |
| AMR and stats, recap | ✅ | Mean 1.00 |
| Match Day (play / sim, stance calls) | ✅ | Demo screen only; not part of a career |
| World: players, attributes, development | 🟡 | 10 engine attributes. The brief asks for 12 + 6 traits, development traits and OVR 40–99 role weights |
| Contracts, wages, ledger, finances | ✅ v1 | AI market. No user negotiation UI yet |
| Rankings (ARP), lineage, tournaments, qualifiers, calendar | ✅ | 20-season validation passes |
| Career mode (user org) | ⬜ | |
| Saves | 🟡 | Desktop SQLite store exists. Browser IndexedDB and career save/load are not built |
| Scouting | ⬜ | Scout staff exist; no reports |
| Sponsors, news, history/legacy | ⬜ | |
| Browser build | ✅ | `npm run build:web`, published privately as an Artifact |
| Windows build | 🟡 | CI produces an exe (shell only); release candidate later |
