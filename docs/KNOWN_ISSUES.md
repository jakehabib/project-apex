# Known Issues and Limitations

| ID | Area | Issue | Severity | Plan |
|---|---|---|---|---|
| KI-1 | Packaging | The Windows `.exe` has not yet been launched on Windows; only cross-built and inspected. | High until CI runs | CI `windows` job launches it via Playwright |
| KI-2 | Packaging | `signAndEditExecutable: false`: no code signing, icon or version resource on Windows yet. | Medium | Add an icon and signing certificate before any public build |
| KI-3 | Steam | No Steamworks integration or overlay test. | Gated | Needs partner account and App ID; spike in the main process only |
| KI-4 | Viewer | At 1280×720 the map is small because both 5-player strips stay expanded. | Medium | Collapsible/compact strips in Phase 2 |
| KI-5 | Viewer | Phase 0 shows the movement/sightline proof only: no combat, economy, bomb or score. Clearly labelled in UI. | Expected | Phase 1 engine, Phase 2 viewer |
| KI-6 | Viewer | Vision cones are presentation of facing only; Phase 0 spotting is omnidirectional (range plus LOS). | Low | Phase 1 adds facing/FOV to agent perception, and cones will then reflect it |
| KI-7 | Art | Map art is code-drawn geometry. Acceptable for proof, not for release. | Expected | Phase 5 art pass / commissioned illustration |
| KI-8 | Rendering | No-GPU machines use the Canvas 2D fallback. Performance under full-match load is unmeasured. | Medium | Profile in Phase 2; add a quality setting |
| KI-9 | Persistence | `node:sqlite` is flagged experimental upstream (stable in practice in Node 24 / Electron 44). | Low | Isolated behind `SaveStore`; better-sqlite3 fallback |
| KI-10 | Dev env | When running as root in containers, Electron needs `--no-sandbox` (test/dev harness only). | Info | Never used by the shipped app |
