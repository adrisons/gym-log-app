import { test, expect } from './fixtures/fresh-browser-test';
import { CONTRACT_SCENARIOS } from '../contract/storage-adapter-contract';

// spec 003 US1-US4 (contracts/storage-adapters.md): the shared contract
// suite run against a real FileSystemStorageAdapter, in a real browser.
// chromium only — WebKit has no File System Access implementation,
// matching FR-004's production feature-detection fallback (a `webkit`
// project run of this file would be un-runnable, not merely skipped).
//
// One page.evaluate() per scenario, a fresh browser process per test
// (fixtures/fresh-browser-test.ts), and a generous per-test timeout: CI
// repeatedly failed the exact same ~11 restart-simulating scenarios
// (every one calling makeAdapter() twice, which reads the persisted
// FileSystemDirectoryHandle back out of IndexedDB) with "Target page,
// context or browser has been closed" — identically, across several
// different code changes that should each have altered the failure
// pattern if they'd addressed the real cause, which they didn't. That
// invariance, plus the failing count times Playwright's 30s default
// timeout roughly matching the run's total wall-clock time, points at a
// timeout (real disk/IndexedDB I/O plus a fresh browser launch per test
// being slower under CI's shared runner than locally) rather than an
// actual crash — this fixture's own try/finally then surfaces a timed-out
// in-flight page.evaluate() as exactly this "closed" error when the
// timeout forces browser.close(). Never reproduced locally either way.

for (const scenario of CONTRACT_SCENARIOS) {
  test(`FileSystemStorageAdapter: ${scenario.name}`, async ({
    page,
    browserName,
  }) => {
    test.setTimeout(90_000);
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

test('ADR-0006 v1->v2 migration backfills a legacy Exercise and bumps the stored schema version', async ({
  page,
  browserName,
}) => {
  test.setTimeout(90_000);
  test.skip(browserName !== 'chromium', 'File System Access is chromium-only.');

  await page.goto('/test/e2e/fixtures/storage-harness.html');
  const outcome = await page.evaluate(() =>
    window.__runMigrationTest('file-system'),
  );

  expect(outcome.canonicalNamePreserved).toBe(true);
  expect(outcome.defaultLoadTypePreserved).toBe(true);
  expect(outcome.defaultVolumeKind).toBe('reps');
  expect(outcome.trackEffort).toBe(false);
  // CURRENT_SCHEMA_VERSION has since advanced to 3 (ADR-0008); a legacy v1
  // record still runs this same v1->v2 backfill on its way up and lands at
  // whatever the current version now is — there is no v2->v3 data rewrite
  // to add (ADR-0008: `Block.rounds` needs none).
  expect(outcome.storedSchemaVersion).toBe(3);
  // The port's own read-time normalization would report a correctly
  // shaped record either way — this is the field that actually tells a
  // real physical migration apart from that safety net alone.
  expect(outcome.rawFileMigrated).toBe(true);
});

test('ADR-0008 v2->v3: a Block with no `rounds` upgrades cleanly, with rounds left absent', async ({
  page,
  browserName,
}) => {
  test.setTimeout(90_000);
  test.skip(browserName !== 'chromium', 'File System Access is chromium-only.');

  await page.goto('/test/e2e/fixtures/storage-harness.html');
  const outcome = await page.evaluate(() =>
    window.__runV2ToV3MigrationTest('file-system'),
  );

  expect(outcome.blockNamePreserved).toBe(true);
  expect(outcome.roundsStillAbsent).toBe(true);
  expect(outcome.storedSchemaVersion).toBe(3);
});

test('ADR-0006 migration survives a gesture-less first write followed by a real handle acquisition against a pre-existing v1 directory', async ({
  page,
  browserName,
}) => {
  test.setTimeout(90_000);
  test.skip(browserName !== 'chromium', 'File System Access is chromium-only.');

  await page.goto('/test/e2e/fixtures/storage-harness.html');
  const outcome = await page.evaluate(() =>
    window.__runMigrationTestFreshAcquire(),
  );

  expect(outcome.canonicalNamePreserved).toBe(true);
  expect(outcome.defaultLoadTypePreserved).toBe(true);
  expect(outcome.defaultVolumeKind).toBe('reps');
  expect(outcome.trackEffort).toBe(false);
  // CURRENT_SCHEMA_VERSION has since advanced to 3 (ADR-0008); see the
  // sibling test above for why this lands at 3, not 2.
  expect(outcome.storedSchemaVersion).toBe(3);
  // The port's own read-time normalization would report a correctly
  // shaped record either way — this is the field that actually tells a
  // real physical migration apart from that safety net alone.
  expect(outcome.rawFileMigrated).toBe(true);
});

test('a queued gesture-less exercise write merges with real pre-existing records instead of replacing them on first handle acquisition', async ({
  page,
  browserName,
}) => {
  test.setTimeout(90_000);
  test.skip(browserName !== 'chromium', 'File System Access is chromium-only.');

  await page.goto('/test/e2e/fixtures/storage-harness.html');
  const outcome = await page.evaluate(() =>
    window.__runQueuedExerciseMergeTest(),
  );

  expect(outcome.exerciseIds).toEqual(['legacy-1', 'new-1']);
});

test('a queued merge of two exercises does not resurrect the merged-away loser from its real pre-existing record on first handle acquisition', async ({
  page,
  browserName,
}) => {
  test.setTimeout(90_000);
  test.skip(browserName !== 'chromium', 'File System Access is chromium-only.');

  await page.goto('/test/e2e/fixtures/storage-harness.html');
  const outcome = await page.evaluate(() =>
    window.__runQueuedMergeTombstoneTest(),
  );

  expect(outcome.exerciseIds).toEqual(['legacy-a']);
});

test('a lost File System Access permission surfaces StorageError with kind "permission-lost", distinguishable from "no data yet"', async ({
  page,
  browserName,
}) => {
  test.setTimeout(90_000);
  test.skip(browserName !== 'chromium', 'File System Access is chromium-only.');

  await page.goto('/test/e2e/fixtures/storage-harness.html');
  const outcome = await page.evaluate(() => window.__runPermissionLossTest());

  expect(outcome.threw).toBe(true);
  if (outcome.threw) {
    expect(outcome.isStorageError).toBe(true);
    expect(outcome.kind).toBe('permission-lost');
  }
});
