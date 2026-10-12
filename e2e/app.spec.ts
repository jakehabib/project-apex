import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SHOTS = 'reports/screenshots';
mkdirSync(SHOTS, { recursive: true });

// Containers run as root, where Chromium refuses its OS-level sandbox; this flag is
// never used by the shipped app. Renderer sandbox/isolation preferences are unchanged.
const ciArgs = process.getuid?.() === 0 ? ['--no-sandbox'] : [];

async function launch(userDataDir: string): Promise<{ app: ElectronApplication; page: Page }> {
  const app = await electron.launch({ args: ['.', ...ciArgs], env: { ...process.env, APEX_USER_DATA_DIR: userDataDir } });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  return { app, page };
}

async function setWindowSize(app: ElectronApplication, width: number, height: number) {
  await app.evaluate(({ BrowserWindow }, [w, h]) => {
    const win = BrowserWindow.getAllWindows()[0]!;
    win.setMinimumSize(640, 480);
    win.setContentSize(w, h);
  }, [width, height] as const);
}

test.describe('Phase 0 desktop shell', () => {
  let userData: string;
  test.beforeAll(() => {
    userData = mkdtempSync(join(tmpdir(), 'apex-e2e-'));
  });

  test('title screen renders inside a locked-down renderer', async () => {
    const { app, page } = await launch(userData);
    await expect(page.getByRole('heading', { name: /Project\s*Apex/i })).toBeVisible();
    const probe = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      const apex = w.apex as Record<string, unknown> | undefined;
      return {
        require: typeof w.require,
        process: typeof w.process,
        buffer: typeof w.Buffer,
        apiKeys: apex ? Object.keys(apex).sort() : [],
        frozen: apex ? Object.isFrozen(apex) : false,
        origin: location.origin,
      };
    });
    expect(probe).toEqual({ require: 'undefined', process: 'undefined', buffer: 'undefined', apiKeys: ['appInfo', 'quit', 'saves'], frozen: true, origin: 'app://apex' });
    // CSP is served by the app protocol and enforced on page-inserted inline script.
    // (DevTools evaluation is CSP-exempt, so we test real page mechanisms instead.)
    const csp = await page.evaluate(async () => (await fetch('app://apex/index.html')).headers.get('content-security-policy'));
    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain('unsafe-eval');
    const inlineRan = await page.evaluate(
      () =>
        new Promise<boolean>((resolve) => {
          const s = document.createElement('script');
          s.textContent = 'window.__apexInline = true';
          document.head.appendChild(s);
          setTimeout(() => resolve((window as unknown as { __apexInline?: boolean }).__apexInline === true), 100);
        }),
    );
    expect(inlineRan).toBe(false);
    // Navigation away from the app origin is refused.
    await page.evaluate(() => {
      location.href = 'https://example.com/';
    });
    await page.waitForTimeout(500);
    expect(page.url()).toMatch(/^app:\/\/apex\//);
    await setWindowSize(app, 1920, 1080);
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${SHOTS}/title-1080p.png` });
    await app.close();
  });

  test('tactical viewer animates the seeded simulation smoothly', async () => {
    const { app, page } = await launch(userData);
    await setWindowSize(app, 1920, 1080);
    await page.getByTestId('menu-viewer').click();
    await expect(page.locator('[data-testid=viewer-canvas] canvas')).toBeVisible();
    await expect(page.locator('.v-card')).toHaveCount(10, { timeout: 15000 });
    // Measure real frame delivery over 3 seconds.
    const fps = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let frames = 0;
          const start = performance.now();
          const tick = () => {
            frames++;
            if (performance.now() - start < 3000) requestAnimationFrame(tick);
            else resolve((frames * 1000) / (performance.now() - start));
          };
          requestAnimationFrame(tick);
        }),
    );
    console.log(`viewer rAF rate: ${fps.toFixed(1)} fps, backend: ${await page.getByTestId('backend').textContent()}`);
    expect(fps).toBeGreaterThan(30);
    // Fast-forward so agents are deployed, then capture.
    await page.keyboard.press('4');
    await page.waitForTimeout(2500);
    await page.keyboard.press('Space');
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${SHOTS}/viewer-1080p.png` });
    for (const [w, h, name] of [
      [1280, 720, '720p'],
      [2560, 1440, '1440p'],
    ] as const) {
      await setWindowSize(app, w, h);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/viewer-${name}.png` });
    }
    const print1 = await page.locator('.v-print').textContent();
    // Restarting playback and changing speed must not change the simulation.
    await page.keyboard.press('r');
    await page.keyboard.press('1');
    await page.waitForTimeout(300);
    expect(await page.locator('.v-print').textContent()).toBe(print1);
    await app.close();
  });

  test('systems check passes and saves survive an app restart', async () => {
    const first = await launch(userData);
    await setWindowSize(first.app, 1280, 720);
    await first.page.getByTestId('menu-systems').click();
    for (const id of ['isolation', 'determinism', 'seeds', 'save']) {
      await expect(first.page.getByTestId(`check-${id}`)).toHaveAttribute('data-status', 'pass', { timeout: 20000 });
    }
    await first.app.close();

    const second = await launch(userData);
    await setWindowSize(second.app, 1280, 720);
    await second.page.getByTestId('menu-systems').click();
    await expect(second.page.getByTestId('check-restart')).toHaveAttribute('data-status', 'pass', { timeout: 20000 });
    await expect(second.page.getByTestId('check-save')).toHaveAttribute('data-status', 'pass');
    // The CI container has no GPU: a software rasterizer must be reported as a warning, never a silent pass.
    await expect(second.page.getByTestId('check-gpu')).toHaveAttribute('data-status', /^(pass|warn)$/);
    console.log('gpu check:', await second.page.getByTestId('check-gpu').textContent());
    await second.page.screenshot({ path: `${SHOTS}/systems-check-720p.png` });
    await second.app.close();
  });
});
