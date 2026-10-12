# AI art pipeline (OpenAI Images)

Presentation art only (player portraits, map key art). It never affects the simulation.

## One-time setup (done by the project owner in the browser)

1. **API key:** create a key at platform.openai.com → API keys. In the Claude Code cloud
   environment settings (environment menu in the session title bar → Edit), add it as a
   secret / environment variable named `OPENAI_API_KEY`. Never paste it into chat or commit it.
2. **Network:** in the same settings, under Network access, add `api.openai.com` to
   Allowed domains (keep "Allow package managers" ticked).
3. Start a **new session** so both settings apply.
4. OpenAI may require organization verification for image models
   (platform.openai.com → Settings → Organization → General), and the account needs billing credit.

## Commands

| Command | What it does | Costs money? |
|---|---|---|
| `npm run art:check` | Confirms key, network, model access, output folder | No |
| `npm run art:plan -- portraits` | Lists what would be generated, full prompt, rough cost | No |
| `npm run art:make -- portraits` | Generates missing images (cap 10 per run, `--max` to raise) | Yes |
| `npm run art:make -- portraits --only p003 --redo` | Regenerate one image | Yes |
| `npm run art:make -- maps` | Map key art | Yes |

Model defaults to `gpt-image-1`; override with the `APEX_IMAGE_MODEL` environment variable
(`art:check` lists the image models the key can use).

## Where things live

- Definitions (style + people/scenes): `src/shared/art/portraits.json`, `src/shared/art/maps.json`.
  The shared `style` block keeps lighting, framing and jersey treatment consistent.
- Output: `src/renderer/assets/generated/<set>/<id>.webp` (committed; bundled by Vite into the app).
- Provenance: `art/manifest.json` records model, size, quality, prompt and date per file.
- Game access: `src/renderer/art/generated.ts` (`portraitUrl(id)`, `mapKeyArtUrl(id)`); missing images fall back to placeholders.
- Preview: main menu → **Art Gallery**. `e2e/gallery.spec.ts` checks every image decodes in the packaged renderer under the CSP.

## Rules

- All people are fictional; prompts forbid resemblance to real players. No real team or sponsor logos, no text.
- Map key art is decoration. Playable layouts always come from the map tile data.
- Scaling to hundreds of players: add entries to `portraits.json` (later generated from the world
  generator's player records) and run `art:make` in batches with `--max`.
