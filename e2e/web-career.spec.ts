import { expect, test, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const SHOTS = 'reports/screenshots/web';

async function toMatchDay(page: Page) {
  for (let i = 0; i < 40; i++) {
    if (await page.getByTestId('match-center').isVisible()) return;
    const btn = page.getByTestId('tb-continue');
    await expect(btn).toBeEnabled({ timeout: 60_000 });
    await btn.click();
    await page.waitForTimeout(300);
    await expect(btn).toBeEnabled({ timeout: 60_000 });
  }
  await expect(page.getByTestId('match-center')).toBeVisible();
}

test('browser career: new career, manage, play a live map, sim, save and continue after reload, re-watch', async ({ page }) => {
  mkdirSync(SHOTS, { recursive: true });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByTestId('menu-new-career').click();
  await expect(page.getByTestId('cn-team').first()).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: `${SHOTS}/career-new.png` });
  await page.getByTestId('cn-start').click();
  await expect(page.getByTestId('career-dashboard')).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${SHOTS}/career-dashboard.png` });

  for (const p of ['squad', 'tactics', 'schedule', 'rankings', 'finances', 'market', 'inbox', 'settings'] as const) {
    await page.getByTestId(`nav-${p}`).click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/career-${p}.png` });
  }
  await page.getByTestId('nav-squad').click();
  await page.getByTestId('squad-row').first().click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/career-profile.png` });
  await page.getByTestId('nav-tactics').click();
  await page.getByTestId('plan-utility').click();
  await expect(page.locator('.toast')).toContainText('Utility Executes');

  await toMatchDay(page);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/career-matchcenter.png` });
  await page.getByTestId('mc-play').click();
  await expect(page.getByTestId('matchday-live')).toBeVisible({ timeout: 60_000 });
  await page.getByTestId('speed-4').click();
  await page.getByTestId('stance-aggressive').click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${SHOTS}/career-live.png` });
  await page.getByTestId('md-simend').click();
  await expect(page.getByTestId('match-recap')).toBeVisible({ timeout: 60_000 });
  await page.screenshot({ path: `${SHOTS}/career-recap.png` });
  await page.getByTestId('recap-done').click();
  if (await page.getByTestId('mc-sim').isVisible()) await page.getByTestId('mc-sim').click();
  await expect(page.getByTestId('mc-done')).toBeVisible({ timeout: 90_000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/career-series-done.png` });
  await page.getByTestId('mc-continue').click();
  await expect(page.getByTestId('tb-continue')).toBeEnabled({ timeout: 90_000 });
  const date = await page.getByTestId('tb-date').textContent();

  // Saved automatically: a reload continues from the same day.
  await page.reload();
  await page.getByTestId('menu-continue').click();
  await expect(page.getByTestId('career-shell')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('tb-date')).toHaveText(date!);

  await page.getByTestId('nav-results').click();
  await page.screenshot({ path: `${SHOTS}/career-results.png` });
  await page.getByTestId('res-watch').first().click();
  await expect(page.getByTestId('matchday-live')).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.getByTestId('md-simend').click();
  await expect(page.getByTestId('nav-results')).toBeVisible();
  expect(errors).toEqual([]);
});
