import { test, expect } from './fixtures/fresh-browser-test';
import { CONTRACT_SCENARIOS } from '../contract/storage-adapter-contract';

// spec 003 US1-US4 (contracts/storage-adapters.md): the shared contract
// suite run against a real IndexedDbStorageAdapter, in a real browser.
// Runs in BOTH the chromium and webkit Playwright projects
// (playwright.config.ts) — IndexedDB is available in both, matching the
// production feature-detection fallback WebKit/iOS Safari takes
// (spec 003 FR-004).
//
// One page.evaluate() per scenario, not one call for the whole suite,
// AND a fresh browser process per test (fixtures/fresh-browser-test.ts) —
// see that file's doc comment for why (a reproducible CI-only browser
// crash on the File System Access sibling spec).

for (const scenario of CONTRACT_SCENARIOS) {
  test(`IndexedDbStorageAdapter: ${scenario.name}`, async ({ page }) => {
    // Real disk/IndexedDB I/O plus this test's own fresh browser launch
    // can be slower under CI's shared runner than locally — generous
    // headroom over Playwright's 30s default (spec 003; see
    // fixtures/fresh-browser-test.ts's doc comment).
    test.setTimeout(90_000);
    await page.goto('/test/e2e/fixtures/storage-harness.html');
    const outcome = await page.evaluate(
      (name) => window.__runContractScenario('indexed-db', name),
      scenario.name,
    );
    expect(outcome.passed, outcome.passed ? '' : outcome.error).toBe(true);
  });
}

test('ADR-0006 v1->v2 migration backfills a legacy Exercise and bumps the stored schema version', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/test/e2e/fixtures/storage-harness.html');
  const outcome = await page.evaluate(() =>
    window.__runMigrationTest('indexed-db'),
  );

  expect(outcome.canonicalNamePreserved).toBe(true);
  expect(outcome.defaultLoadTypePreserved).toBe(true);
  expect(outcome.defaultVolumeKind).toBe('reps');
  expect(outcome.trackEffort).toBe(false);
  // CURRENT_SCHEMA_VERSION has since advanced to 4 (ADR-0008, ADR-0013); a
  // legacy v1 record still runs this same v1->v2 backfill on its way up
  // and lands at whatever the current version now is — there is no
  // v2->v3 or v3->v4 data rewrite to add (neither `Block.rounds`'s
  // addition nor its later removal needed one).
  expect(outcome.storedSchemaVersion).toBe(4);
});

test('ADR-0008 v2->v3: a Block with no `rounds` upgrades cleanly, with rounds left absent', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/test/e2e/fixtures/storage-harness.html');
  const outcome = await page.evaluate(() =>
    window.__runV2ToV3MigrationTest('indexed-db'),
  );

  expect(outcome.blockNamePreserved).toBe(true);
  expect(outcome.roundsStillAbsent).toBe(true);
  expect(outcome.storedSchemaVersion).toBe(4);
});

test('ADR-0013 v3->v4: a Block with `rounds` set upgrades cleanly, with rounds left unchanged on disk', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto('/test/e2e/fixtures/storage-harness.html');
  const outcome = await page.evaluate(() =>
    window.__runV3ToV4MigrationTest('indexed-db'),
  );

  expect(outcome.blockNamePreserved).toBe(true);
  expect(outcome.roundsLeftUnchangedOnDisk).toBe(true);
  expect(outcome.storedSchemaVersion).toBe(4);
});
