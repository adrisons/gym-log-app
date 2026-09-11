import { test, expect } from '@playwright/test';
import { CONTRACT_SCENARIOS } from '../contract/storage-adapter-contract';

// spec 003 US1-US4 (contracts/storage-adapters.md): the shared contract
// suite run against a real IndexedDbStorageAdapter, in a real browser.
// Runs in BOTH the chromium and webkit Playwright projects
// (playwright.config.ts) — IndexedDB is available in both, matching the
// production feature-detection fallback WebKit/iOS Safari takes
// (spec 003 FR-004).

test('IndexedDbStorageAdapter satisfies the shared storage-adapter contract', async ({
  page,
}) => {
  await page.goto('/test/e2e/fixtures/storage-harness.html');
  const result = await page.evaluate(() =>
    window.__runContractSuite('indexed-db'),
  );

  expect(result.failed, JSON.stringify(result.failed, null, 2)).toEqual([]);
  expect(result.passed.length).toBe(CONTRACT_SCENARIOS.length);
});
