import { test, expect } from '@playwright/test';
import { CONTRACT_SCENARIOS } from '../contract/storage-adapter-contract';

// spec 003 US1-US4 (contracts/storage-adapters.md): the shared contract
// suite run against a real FileSystemStorageAdapter, in a real browser.
// chromium only — WebKit has no File System Access implementation,
// matching FR-004's production feature-detection fallback (a `webkit`
// project run of this file would be un-runnable, not merely skipped).
//
// One page.evaluate() per scenario, not one call for the whole suite —
// CI's chromium crashed reproducibly (3/3, not a flake) on a single
// giant page.evaluate() running all ~15 scenarios in one browser-side
// call ("Target page, context or browser has been closed", Chromium
// crashpad visible in the browser logs), never reproduced locally on
// either the default headless-shell binary or the full
// Chrome-for-Testing build. Splitting per scenario gives the CDP
// protocol a boundary per scenario; see runOneScenario's doc comment in
// storage-adapter-contract.ts.

for (const scenario of CONTRACT_SCENARIOS) {
  test(`FileSystemStorageAdapter: ${scenario.name}`, async ({
    page,
    browserName,
  }) => {
    test.skip(
      browserName !== 'chromium',
      'File System Access has no WebKit implementation — matches production feature detection.',
    );

    await page.goto('/test/e2e/fixtures/storage-harness.html');
    const outcome = await page.evaluate(
      (name) => window.__runContractScenario('file-system', name),
      scenario.name,
    );
    expect(outcome.passed, outcome.passed ? '' : outcome.error).toBe(true);
  });
}

test('a lost File System Access permission surfaces StorageError with kind "permission-lost", distinguishable from "no data yet"', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'File System Access is chromium-only.');

  await page.goto('/test/e2e/fixtures/storage-harness.html');
  const outcome = await page.evaluate(() => window.__runPermissionLossTest());

  expect(outcome.threw).toBe(true);
  if (outcome.threw) {
    expect(outcome.isStorageError).toBe(true);
    expect(outcome.kind).toBe('permission-lost');
  }
});
