import { defineConfig, devices } from '@playwright/test';

// Phase 0: only the app-shell smoke test lives here. It must run in a
// Chromium context (the File System Access path from ADR-0002) and a WebKit
// context (the iOS Safari / IndexedDB path).
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // spec 003: the OPFS-heavy storage-adapter contract tests
        // (test/e2e/*.contract.spec.ts) crash Playwright's default
        // headless "chrome-headless-shell" binary in CI (reproducible,
        // not a flake — "Target page, context or browser has been
        // closed" mid-page.evaluate). The full Chrome-for-Testing build,
        // requested via `channel`, does not have this issue — verified
        // locally against the same test code. No other project here
        // needs the lightweight shell's speed badly enough to risk it.
        channel: 'chromium',
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
