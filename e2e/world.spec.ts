import { _electron as electron, expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const ciArgs = process.getuid?.() === 0 ? ['--no-sandbox'] : [];

test('world rankings, calendar, event detail and forecast render from the simulated ecosystem', async () => {
  mkdirSync('reports/screenshots', { recursive: true });
  const app = await electron.launch({ args: ['.', ...ciArgs], env: { ...process.env, APEX_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'apex-w-')) } });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(1600, 1000));
  await page.getByTestId('menu-world').click();
  const table = page.getByTestId('rankings-table');
  await expect(table).toBeVisible({ timeout: 60_000 });
  await expect(table.locator('tbody tr')).toHaveCount(60);
  await page.screenshot({ path: 'reports/screenshots/world-rankings.png' });
  await page.getByTestId('tab-calendar').click();
  await expect(page.getByTestId('calendar')).toBeVisible();
  await page.screenshot({ path: 'reports/screenshots/world-calendar.png' });
  await page.locator('[data-testid^="event-S1-T1"]').first().click();
  await expect(page.getByTestId('event-detail')).toBeVisible();
  await page.screenshot({ path: 'reports/screenshots/world-event.png' });
  await page.getByTestId('event-detail').getByRole('button', { name: 'Close' }).click();
  await page.getByTestId('tab-forecast').click();
  await expect(page.getByTestId('forecast')).toBeVisible();
  await page.screenshot({ path: 'reports/screenshots/world-forecast.png' });
  // Time advances: the world keeps simulating.
  const before = await page.locator('.w-date strong').textContent();
  await page.getByTestId('advance-month').click();
  await expect(page.locator('.w-date strong')).not.toHaveText(before ?? '', { timeout: 30_000 });
  await app.close();
});
