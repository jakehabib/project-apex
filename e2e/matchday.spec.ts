import { _electron as electron, expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ciArgs = process.getuid?.() === 0 ? ['--no-sandbox'] : [];

test('match day: play live with a stance call, sim to end, recap; and instant sim', async () => {
  mkdirSync('reports/screenshots', { recursive: true });
  const app = await electron.launch({ args: ['.', ...ciArgs], env: { ...process.env, APEX_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'apex-md-')) } });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(1600, 1000));
  await page.getByTestId('menu-matchday').click();
  await expect(page.getByTestId('matchday-setup')).toBeVisible();
  await page.getByTestId('md-home').selectOption('northwind');
  await page.getByTestId('md-away').selectOption('hollowcrown');
  await page.screenshot({ path: 'reports/screenshots/matchday-setup.png' });
  await page.getByTestId('md-play').click();
  await expect(page.getByTestId('matchday-live')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('stance-aggressive').click();
  await page.getByTestId('speed-4').click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'reports/screenshots/matchday-live.png' });
  await page.getByTestId('md-simend').click();
  await expect(page.getByTestId('match-recap')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('recap-mvp')).toBeVisible();
  await expect(page.getByTestId('recap-stories').locator('.rc-story').first()).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'reports/screenshots/matchday-recap.png', fullPage: true });
  await page.getByTestId('recap-done').click();
  await page.getByTestId('md-sim').click();
  await expect(page.getByTestId('match-recap')).toBeVisible({ timeout: 60_000 });
  await app.close();
});
