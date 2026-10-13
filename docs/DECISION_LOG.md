# Decision log

The full owner decision table (#1–#36) is in `HANDOFF.md` §2. Decisions from 2026-10-13 onward are recorded here first and mirrored there.

| # | Date | Decision |
|---|---|---|
| 37 | 2026-10-12 | Viewer: top-down, but rendered to look close to 3D (competitor reference screenshot: detailed map, portrait side panels, kill feed, score bar, round timeline). |
| 38 | 2026-10-12 | **Rebuild tactical match intelligence** (owner brief): three AI layers (Team Director, Squad, Player); semantic map regions; plan templates (default, rush, A/B execute, split, fake, contact, mid control, aggressive/passive CT, retake, save) with roles, timing, success criteria and fallbacks; honest information with age and confidence (fakes work through beliefs); purposeful utility; adaptation with replanning triggers and cooldowns; a dev tactical overlay; scenario tests (5v5, 5v4, 5v3, 3v3 post-plant, 2v2, 1vX); one excellent round on one map first; tactical preferences from IGL, coach, roles, chemistry, map familiarity, opponent and economy. GM sets philosophy only. |
| 39 | 2026-10-13 | **Master directive adopted** (`docs/MASTER_SPEC.md`): autonomous full-team development toward a finished commercial game. |
| 40 | 2026-10-13 | **Browser game first, Steam later** (owner note on the directive). |
| 41 | 2026-10-13 | **Use OpenAI image generation (dev-time only)** for art, logos and imagery even where the brief doesn't mention it; **amazing animations** in matches and UI. |
| 42 | 2026-10-13 | Order of work: tactical AI → broadcast viewer → browser career mode and saves → management screens → attribute model → content → polish → release. Rationale: the engine is the brief's top risk, and the owner's feedback targets it. |
| 43 | 2026-10-13 | **Career match flow:** the human club's series are played by the match engine and stop the calendar; tournaments are re-run with stored results so pairings stay deterministic. AI-vs-AI series keep the fast resolver until the engine is fast enough (0.36 s/map ≈ 50 min per season of background maps). |
| 44 | 2026-10-13 | **Browser saves:** IndexedDB, autosave after every action, gzip + SHA-256 checksum, previous save kept as backup, export/import files. Long careers are compacted (old per-series detail dropped; rankings provably unchanged). |
