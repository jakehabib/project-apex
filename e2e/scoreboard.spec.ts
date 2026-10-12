import { _electron as electron, expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ciArgs = process.getuid?.() === 0 ? ['--no-sandbox'] : [];

test('scoreboard shows AMR from the simulated match and explains a player', async () => {
  mkdirSync('reports/screenshots', { recursive: true });
  const app = await electron.launch({ args: ['.', ...ciArgs], env: { ...process.env, APEX_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'apex-sb-')) } });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(1600, 960));
  await page.getByTestId('menu-viewer').click();
  await expect(page.locator('[data-testid=viewer-canvas] canvas')).toBeVisible();
  await expect(page.locator('.v-round-pip').first()).toBeVisible({ timeout: 60_000 });
  // Jump to a late round so the board has history.
  const pips = page.locator('.v-round-pip');
  await pips.nth(Math.min(14, (await pips.count()) - 1)).click();
  await page.getByTestId('scoreboard-toggle').click();
  await expect(page.getByTestId('scoreboard')).toBeVisible();
  const rows = page.locator('[data-testid^="sb-row-"]');
  await expect(rows).toHaveCount(10);
  const amrs = await page.locator('.sb-amr').allTextContents();
  const nums = amrs.map(Number).filter((x) => !Number.isNaN(x));
  expect(nums.length).toBe(10);
  const mean = nums.reduce((s, x) => s + x, 0) / nums.length;
  expect(mean).toBeGreaterThan(0.5);
  expect(mean).toBeLessThan(1.6);
  await rows.first().click();
  await expect(page.getByTestId('sb-detail')).toBeVisible();
  await page.screenshot({ path: 'reports/screenshots/scoreboard.png' });
  await app.close();
});
