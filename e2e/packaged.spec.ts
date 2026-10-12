import { _electron as electron, expect, test } from '@playwright/test';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Smoke test of a packaged build. Run with APEX_PACKAGED_EXE pointing at the
 * unpacked executable (see `npm run test:packaged`).
 */
const exe = process.env.APEX_PACKAGED_EXE;

test.skip(!exe, 'APEX_PACKAGED_EXE not set');

test('packaged build launches, renders the viewer and persists a save', async () => {
  expect(existsSync(exe!)).toBe(true);
  const userData = mkdtempSync(join(tmpdir(), 'apex-pkg-'));
  const args = process.getuid?.() === 0 ? ['--no-sandbox'] : [];
  const env = { ...process.env, APEX_USER_DATA_DIR: userData };
  let app = await electron.launch({ executablePath: exe!, args, env });
  let page = await app.firstWindow();
  await expect(page.getByRole('heading', { name: /Project\s*Apex/i })).toBeVisible();
  expect(await app.evaluate(({ app }) => app.isPackaged)).toBe(true);
  await page.getByTestId('menu-viewer').click();
  await expect(page.locator('.v-card')).toHaveCount(10, { timeout: 15000 });
  await page.keyboard.press('Escape');
  await page.getByTestId('menu-systems').click();
  await expect(page.getByTestId('check-save')).toHaveAttribute('data-status', 'pass', { timeout: 20000 });
  await app.close();

  app = await electron.launch({ executablePath: exe!, args, env });
  page = await app.firstWindow();
  await page.getByTestId('menu-systems').click();
  await expect(page.getByTestId('check-restart')).toHaveAttribute('data-status', 'pass', { timeout: 20000 });
  await app.close();
});
