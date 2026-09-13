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
  // CURRENT_SCHEMA_VERSION has since advanced to 3 (ADR-0008); a legacy v1
  // record still runs this same v1->v2 backfill on its way up and lands at
  // whatever the current version now is — there is no v2->v3 data rewrite
  // to add (ADR-0008: `Block.rounds` needs none).
  expect(outcome.storedSchemaVersion).toBe(3);
});
