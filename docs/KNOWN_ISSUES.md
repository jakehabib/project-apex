# Known Issues and Limitations

| ID | Area | Issue | Severity | Plan |
|---|---|---|---|---|
| KI-1 | Packaging | ~~Windows `.exe` unverified~~ Resolved: CI `windows-latest` launches the packaged exe. | Closed | — |
| KI-2 | Packaging | `signAndEditExecutable: false`: no code signing, icon or version resource on Windows yet. | Medium | Add an icon and signing certificate before any public build |
| KI-3 | Steam | No Steamworks integration or overlay test. | Gated | Needs partner account and App ID; spike in the main process only |
| KI-4 | Viewer | At 1280×720 the map is small because both 5-player strips stay expanded. | Medium | Collapsible/compact strips in Phase 2 |
| KI-5 | Viewer | Phase 0 shows the movement/sightline proof only: no combat, economy, bomb or score. Clearly labelled in UI. | Expected | Phase 1 engine, Phase 2 viewer |
| KI-6 | Viewer | Vision cones are presentation of facing only; Phase 0 spotting is omnidirectional (range plus LOS). | Low | Phase 1 adds facing/FOV to agent perception, and cones will then reflect it |
| KI-7 | Art | Map art is code-drawn geometry. Acceptable for proof, not for release. | Expected | Phase 5 art pass / commissioned illustration |
| KI-8 | Rendering | No-GPU machines use the Canvas 2D fallback. Performance under full-match load is unmeasured. | Medium | Profile in Phase 2; add a quality setting |
| KI-9 | Persistence | `node:sqlite` is flagged experimental upstream (stable in practice in Node 24 / Electron 44). | Low | Isolated behind `SaveStore`; better-sqlite3 fallback |
| KI-10 | Dev env | When running as root in containers, Electron needs `--no-sandbox` (test/dev harness only). | Info | Never used by the shipped app |
| KI-11 | Engine | ~~Blob movement, no visible tactics~~ Tactical AI v1 rebuilt (see `docs/TACTICAL_AI.md`); viewer debug overlay pending. | Medium | Overlay + further CT squad work |
| KI-12 | Balance | After the rebuild: CT 50.9% ✅, pistol 50.8% ✅, after-plant 25.5% ✅; plant rate 64.7% (54); opening conversion 68% (75/70); Switchyard more T-sided than Harbor. | Medium | Calibration pass |
| KI-13 | Viewer | ~~No broadcast HUD~~ Broadcast viewer v2 shipped; missing: sound, auto camera, highlight replays; non-featured players use initials instead of portraits. | Medium | Viewer polish |
| KI-14 | Product | ~~No career mode~~ Career mode v1 shipped. | Closed | — |
| KI-15 | Saves | ~~The browser build cannot save~~ IndexedDB saves shipped. | Closed | — |
| KI-16 | Content | 2 of 7 maps; world size 136 clubs (the brief targets 48–64 active); attributes 10 (the brief asks for 12 + 6 traits). | Medium | Content and attribute steps |

| KI-17 | Career | Only 2 maps are playable, so BO3/BO5 series repeat maps (the decider replays a picked map). The full veto starts once all 7 maps exist. | Medium | 5 more maps |
| KI-18 | Career | AI-vs-AI series are decided by the fast strength resolver, not the engine (0.36 s/map is too slow for ~8,000 background maps a season in a browser). Only your matches have engine stats. | High | Engine speed + worker pool, then engine-backed background matches for top events |
| KI-19 | Career | A whole event is resolved when it starts: your matches inside it are dated by stage, but squad changes are locked until each is played, and the line-up for the event is the one at its start. | Low | Day-by-day event progression |
| KI-20 | Career | Transfers of contracted players (bids, release clauses) and the offer editor are not yet available to the manager; free agents, extensions and releases are. | Medium | Management screens step |
| KI-21 | Saves | A season adds ~7 MB of JSON (~1 MB gzipped) before compaction; long careers are compacted monthly. 20-season size not yet measured in the browser. | Low | Measure in the 20-season career test |
