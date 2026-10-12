import { _electron as electron, test } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const ciArgs = process.getuid?.() === 0 ? ['--no-sandbox'] : [];
test('gallery showcase screenshots', async () => {
  const app = await electron.launch({ args: ['.', ...ciArgs], env: { ...process.env, APEX_USER_DATA_DIR: mkdtempSync(join(tmpdir(), 'apex-s-')) } });
  const page = await app.firstWindow();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]!.setContentSize(1600, 1000));
  await page.getByTestId('menu-gallery').click();
  await page.waitForTimeout(4000);
  const out = 'reports/art';
  await page.getByTestId('transfer-preview').screenshot({ path: `${out}/transfer-northwind.png` });
  await page.getByTestId('wear-obsidiantide').click();
  await page.waitForTimeout(800);
  await page.getByTestId('transfer-preview').screenshot({ path: `${out}/transfer-obsidiantide.png` });
  for (const t of ['northwind', 'sunline', 'hollowcrown']) {
    await page.getByTestId(`team-${t}`).scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);
    await page.getByTestId(`team-${t}`).screenshot({ path: `${out}/team-${t}.png` });
  }
  await page.getByTestId('mapart-harbor').scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.locator('.gal-maps').screenshot({ path: `${out}/map-keyart.png` });
  await app.close();
});
