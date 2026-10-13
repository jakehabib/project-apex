# Asset licences and provenance

| Asset | Source | Licence / rights | Record |
|---|---|---|---|
| Player portraits (48), crests (8), map key art (7) | Generated with OpenAI gpt-image-1 during development (owner's API account) | Outputs owned by the owner under OpenAI terms; fictional subjects | `art/manifest.json` (prompt, model, date, hash) |
| Viewer textures (13), sprites (15: operators, containers, crates, vehicles, props), HUD icons (18: original weapon and equipment silhouettes) | Generated with OpenAI gpt-image-2 (textures) and gpt-image-1.5 (transparent sprites and icons) during development; downscaled by `scripts/art/optimize.py` | Owner's outputs under OpenAI terms; original designs (no real products or game assets copied) | `art/manifest.json`, `src/shared/art/{textures,sprites,icons}.json` |
| Fonts: Inter, Barlow Condensed, JetBrains Mono | @fontsource packages | SIL Open Font License 1.1 | `package.json` |
| Map tile art, viewer effects | Code-drawn (procedural) in this repo | Project-owned | — |
| Libraries | npm packages (React MIT, PixiJS MIT, Zustand MIT, Zod MIT, Electron MIT) | Permissive | `package.json` |
| Sounds | None yet | — | — |
