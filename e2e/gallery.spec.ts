import { _electron as electron, expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ciArgs = process.getuid?.() === 0 ? ['--no-sandbox'] : [];

test('art gallery shows every defined portrait and loads generated images under the CSP', async () => {
  mkdirSync('reports/screenshots', { recursive: true });
  const app = await electron.launch({ args: ['.', ...ciArgs], env: { ...process.env, APEX_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'apex-gal-')) } });
  const page = await app.firstWindow();
  await page.getByTestId('menu-gallery').click();
  await expect(page.getByTestId('art-gallery')).toBeVisible();
  await expect(page.locator('[data-testid^="portrait-"]')).toHaveCount(5);
  await expect(page.locator('[data-testid^="mapart-"]')).toHaveCount(2);
  // Every generated image must actually decode (wrong path or CSP would leave naturalWidth at 0).
  const broken = await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll<HTMLImageElement>('[data-testid="art-gallery"] img')];
    await Promise.all(imgs.map((i) => i.decode().catch(() => undefined)));
    return imgs.filter((i) => i.naturalWidth === 0).map((i) => i.src);
  });
  expect(broken).toEqual([]);
  await page.screenshot({ path: 'reports/screenshots/art-gallery.png' });
  await app.close();
});
