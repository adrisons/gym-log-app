import { test, expect } from './fixtures/fresh-browser-test';
import { CONTRACT_SCENARIOS } from '../contract/storage-adapter-contract';

// spec 003 US1-US4 (contracts/storage-adapters.md): the shared contract
// suite run against a real FileSystemStorageAdapter, in a real browser.
// chromium only — WebKit has no File System Access implementation,
// matching FR-004's production feature-detection fallback (a `webkit`
// project run of this file would be un-runnable, not merely skipped).
//
// One page.evaluate() per scenario, AND a fresh browser process per test
// (fixtures/fresh-browser-test.ts) — CI's chromium crashed reproducibly,
// repeatedly, across several different mitigations ("Target page,
// context or browser has been closed", Chromium crashpad visible in the
// browser logs), never reproduced locally. Splitting into one Playwright
// test per scenario showed the crash isn't one specific scenario's
// fault: once the shared browser process crashed, every later test in
// that worker failed identically, even ones whose own logic never ran —
// pointing at the browser *process* itself, not this suite's code. A
// fresh browser per test removes whatever accumulates across repeated
// OPFS directory creation over many page loads in this CI container.

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
