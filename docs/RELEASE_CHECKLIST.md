# Release checklist

## Browser release (primary)

- [ ] Career mode end to end: new career → season → titles; management acceptance loop (MASTER_SPEC quality gates).
- [ ] Tactical round acceptance gate passed and demonstrated in the viewer with the debug overlay.
- [ ] Save acceptance: create, advance a season, sign a player, finish a tournament, save, reload the tab, load, verify; long saves (20 seasons).
- [ ] No dead buttons, placeholders or "Coming Soon".
- [ ] Performance: viewer at 60 FPS on a mid laptop; instant sim faster than real time.
- [ ] Asset licences recorded (`docs/ASSET_LICENSES.md`).
- [ ] Hosted build URL documented; works offline after first load (service worker) if feasible.
- [ ] Test suite green; results recorded in `TEST_RESULTS.md`.

## Windows / Steam (later)

- [ ] Electron build of the same renderer; SQLite saves; packaged smoke test on Windows CI.
- [ ] Icon, version resource, code signing (KI-2).
- [ ] Steamworks partner account, App ID and SDK (owner action required); modular integration.
- [ ] Store assets and EULA (owner).
