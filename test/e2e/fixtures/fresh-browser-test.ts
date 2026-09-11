/**
 * A `test` that launches (and closes) a brand-new browser process for
 * every single test, instead of Playwright's default of reusing one
 * browser process across every test a worker runs.
 *
 * Used only by the storage-adapter contract specs
 * (`test/e2e/*.contract.spec.ts`): CI's `chromium` crashed reproducibly
 * partway through the OPFS-heavy File System Access contract suite
 * ("Target page, context or browser has been closed", Chromium crashpad
 * visible in the browser logs) — never on the very first test, and
 * splitting the suite into one Playwright test per scenario (so each got
 * its own fresh page/context) did not fix it either: once the shared
 * browser process crashed, every later test scheduled onto that same
 * worker failed identically, even though each test's own storage logic
 * never got the chance to run. That points at the browser *process*
 * accumulating some instability across repeated OPFS directory
 * creation/deletion over many page loads in this specific CI container
 * (never reproduced locally) — not any one scenario's code. A fresh
 * browser process per test removes whatever accumulates.
 */
import { test as base, type Page } from '@playwright/test';

export const test = base.extend<{ page: Page }>({
  page: async ({ playwright, browserName, baseURL }, use) => {
    const browserType = playwright[browserName];
    const browser = await browserType.launch(
      browserName === 'chromium' ? { channel: 'chromium' } : {},
    );
    try {
      const context = await browser.newContext(
        baseURL === undefined ? {} : { baseURL },
      );
      const page = await context.newPage();
      await use(page);
      await context.close();
    } finally {
      await browser.close();
    }
  },
});

export { expect } from '@playwright/test';
