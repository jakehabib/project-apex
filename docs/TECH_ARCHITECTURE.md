# Technical Architecture: Project Apex

Status: **Phase 0 complete on Linux; Windows launch gate pending its first CI run** · Last updated 2026-10-12

## 1. Architecture decision record

**Decision:** Electron 44 + React 19 + TypeScript 6 + Vite 8, PixiJS 8 for the match renderer, a pure TypeScript simulation core, and SQLite through the runtime's built-in `node:sqlite` in the main process.

| Layer | Choice (pinned) | Why |
|---|---|---|
| Desktop shell | Electron 44.4.5 (Chromium 152, Node 24.21) | Mature Windows packaging, trusted main process for files/saves, current security model |
| UI | React 19.3 + Vite 8.3 | Fast iteration; bespoke design system (no component kit) |
| Match renderer | PixiJS 8.21 | Fast 2D. Auto-selects WebGL, WebGPU or a **Canvas 2D fallback** (verified at ~56 FPS with no GPU) |
| Core simulation | Pure TS, no imports outside `src/core` | Testable headless, runs in a Web Worker, Node CLI or tests |
| Saves | `node:sqlite` (built into Electron's Node 24) | **No native module to rebuild or cross-compile**; verified in Electron 44 and Node 22 |
| Validation | Zod 4 at every trust boundary (IPC, save load) | Corrupt/forged data rejected before reaching the domain |
| Tests | Vitest 5 (unit/invariant), Playwright 1.63 (Electron e2e, packaged smoke) | Business-rule bugs are the existential risk |
| Packaging | electron-builder 26 (`--win dir`, `--linux dir`) | Cross-builds the Windows `.exe` from Linux; CI launches it on `windows-latest` |

**Why `node:sqlite` over `better-sqlite3`:** in the spike, `better-sqlite3` installed but failed in Electron with an ABI mismatch, so it would need `electron-rebuild` and per-platform prebuilt binaries for every Electron upgrade. `node:sqlite` ships inside Electron, works with no flags in Electron 44, and removes the largest Phase 0 packaging risk. *Fallback:* `better-sqlite3` behind the same `SaveStore` interface, if `node:sqlite` regresses.

**Fallback stack:** if Electron's footprint or Steam overlay compatibility fails a later gate, keep `src/core` unchanged (it has zero platform dependencies) and move the shell to Tauri, with the viewer staying on PixiJS. Godot remains an option for the viewer only. The core boundary exists to make either move cheap.

**Steam:** deliberately *not* integrated yet. It is a separate gate requiring a Steamworks partner account, an App ID and the SDK (see §6). All development is fully offline.

## 2. Security model (Electron)

- Renderer: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity: true`.
- The renderer is served from a privileged custom scheme `app://apex/`, not `file://`. Path traversal is rejected; every response carries a strict CSP (`script-src 'self'`, no `unsafe-eval`, `object-src 'none'`, `frame-ancestors 'none'`).
- Preload exposes one frozen object, `window.apex`, with exactly `appInfo`, `saves.{list,read,write,remove}` and `quit`. No `ipcRenderer`, no paths, no SQL.
- Every IPC handler verifies that the sender is our main frame on our scheme and host. Note: Node's `URL.origin` is `"null"` for custom schemes and `file:`, so origins are **never** compared; scheme and host are (`electron/security.ts`, unit-tested).
- Navigation, redirects, `window.open`, webviews and all permission requests are denied.
- `--no-sandbox` is passed **only** by the test harness when running as root in containers; the shipped app never uses it.

## 3. Module boundaries

```
src/core/          pure domain: no React/DOM/Node/Electron, no Math.random, no wall-clock (enforced by tests)
  rng/             apex-rng/1: cyrb128 seeding + sfc32; serializable state; label-forked streams
  match/maps/      MapDefinition data, rasterized walk/sight grid, nav graph + A*, ray casting
  match/rules/     Ruleset (MR12 economy/timings/format) and Arsenal; data only
  match/events.ts  canonical MatchEvent contract (append-only, seq-ordered)
  match/replay/    event log -> positions (shared by viewer and tests)
  match/spike/     Phase 0 movement/sightline proof (explicitly not the match engine)
src/shared/        Node-free types/schemas shared across processes (IPC contract, save schemas)
src/persistence/   SaveStore (node:sqlite); trusted contexts only
electron/          main process (protocol, IPC, window) + sandboxed preload
src/renderer/      React screens, design tokens, Pixi viewer, sim Web Worker
```

Planned additions follow the brief (§14.2): `core/world`, `core/management`, `core/competition`.

## 4. Domain map: entities, commands, events

**Entities** (stable string IDs; one owner per fact): World, Club, Player, Contract, Offer, FinancialTransaction (immutable), Tournament, Series, MapDefinition, MatchState, MatchEvent, Statistic (derived), News, SaveManifest.

**Commands** (validated, all-or-nothing): `AdvanceWorld{to}`, `SubmitOffer`, `RespondToOffer`, `SignFreeAgent`, `ReleasePlayer`, `SetLineup`, `SetTactics`, `SubmitVeto`, `CallTimeout{policy}`, `AcceptSponsor`, `SaveGame`.

**Domain events:** `ContractSigned`, `TransferCompleted`, `ContractExpired`, `LedgerPosted`, `MatchCompleted`, `TournamentAdvanced`, `RankingUpdated`, `NewsPublished`.

**Match events** (`src/core/match/events.ts`): map_start, round_start, side_switch, spawn, buy, drop, move, hold, spotted, utility, damage, kill, plant_start, plant, defuse_start, defuse, detonate, timeout, money, round_end, map_end. **Every displayed stat is a fold over these.**

**Single sources of truth:** cash = opening balance + ledger; match stats = fold(events); contract cost = contract terms; player ownership = exactly one contract or free-agent state.

## 5. Determinism and replay

- `simulate(initialState, seed, engineVersion, commandLog) -> events` is a pure function. The viewer, instant-sim and stats all consume the same events.
- RNG streams are forked by label (`plan`, `routes`, later `combat`, `economy` and so on), so adding a consumer in one subsystem never shifts another's sequence.
- Golden-seed snapshots pin the RNG output and the proof fingerprint; any change to outcomes fails CI until reviewed and the snapshot is deliberately updated.
- Live decisions (timeouts and tactics) will be appended to the command log at legal freeze points only; resolved rounds are immutable.
- Presentation has its own clock (`Playback`); speed, pause, seek and restart never touch simulation state (tested in e2e).

## 6. Risks and open gates

| Risk | Status / mitigation |
|---|---|
| Windows `.exe` launch | Cross-built PE32+ verified on Linux; **launch is verified only by the CI `windows` job.** Pending first CI run. |
| Steam overlay/API with a secure Electron config | Not started; needs Steamworks credentials. Will spike `steamworks.js` (or similar) in the main process only, behind IPC. Never by disabling isolation. |
| No-GPU machines | PixiJS Canvas 2D fallback measured at ~56 FPS for the Phase 0 scene; full-match load is untested |
| Simulation credibility | The biggest product risk. Phase 1 invariant and batch tests come before any more UI. |
| `node:sqlite` is still flagged experimental upstream | Isolated behind `SaveStore`; `better-sqlite3` fallback documented |
| Save growth over long careers | Full replays will be optional; careers persist summaries and highlight events (brief §10.6) |
