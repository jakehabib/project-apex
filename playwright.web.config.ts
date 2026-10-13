import { defineConfig } from '@playwright/test';

/** Browser build tests: the production web bundle served by `vite preview`, driven in Chromium. */
export default defineConfig({
  testDir: 'e2e',
  testMatch: /web-.*\.spec\.ts/,
  timeout: 240_000,
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results/web',
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1600, height: 1000 }, launchOptions: { executablePath: process.env.APEX_CHROMIUM ?? undefined } },
  webServer: { command: 'npm run preview:web -- --host 127.0.0.1 --strictPort', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 60_000 },
});
