import { test, expect } from '@playwright/test';
import { CONTRACT_SCENARIOS } from '../contract/storage-adapter-contract';

// spec 003 US1-US4 (contracts/storage-adapters.md): the shared contract
// suite run against a real FileSystemStorageAdapter, in a real browser.
// chromium only — WebKit has no File System Access implementation,
// matching FR-004's production feature-detection fallback (a `webkit`
// project run of this file would be un-runnable, not merely skipped).

test('FileSystemStorageAdapter satisfies the shared storage-adapter contract', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'File System Access has no WebKit implementation — matches production feature detection.',
  );

  await page.goto('/test/e2e/fixtures/storage-harness.html');
  const result = await page.evaluate(() =>
    window.__runContractSuite('file-system'),
  );

  expect(result.failed, JSON.stringify(result.failed, null, 2)).toEqual([]);
  expect(result.passed.length).toBe(CONTRACT_SCENARIOS.length);
});

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
