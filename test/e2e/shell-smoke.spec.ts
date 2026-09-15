import { expect, test } from '@playwright/test';

// Spec 000 FR-021: "an empty app that launches, with a smoke test" —
// proves the built app actually boots in a real browser, not just that the
// unit tests pass. Runs in both Chromium and WebKit (playwright.config.ts
// projects) — WebKit covers the iOS Safari / IndexedDB path (ADR-0002).
//
// Spec 001 replaces the Phase 0 placeholder shell with the real logging
// screen (`src/presentation/main.tsx`) — this test now checks for that
// screen's own heading instead of the placeholder's "gym-log" text.
//
// Spec 004 wraps the composition root in a react-router-dom router
// (diary/search/progression screens) — this test's own assertions confirm
// "/" resolves and the service worker registers.
//
// Spec 005 adds "/insights" alongside the others — same pattern.
//
// Spec 006 adds "/settings" alongside the others — same pattern.
//
// Design-refinement pass (docs/requirements.md FR-1): "/" now redirects to
// "/diary" — the diary is the app's home, and the logging form moved to
// "/log", reached from a floating action there rather than a nav tab. This
// test checks for the Diary heading at "/" accordingly.

test('the app boots to the diary screen and the service worker registers', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Diary' })).toBeVisible();

  const serviceWorkerReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      return false;
    }
    const registration = await navigator.serviceWorker.ready;
    return Boolean(registration.active);
  });
  expect(serviceWorkerReady).toBe(true);
});

test('the diary route is reachable and shows the empty state with no sessions logged', async ({
  page,
}) => {
  await page.goto('/diary');

  await expect(page.getByRole('heading', { name: 'Diary' })).toBeVisible();
  await expect(page.getByText(/no sessions logged yet/i)).toBeVisible();
});

test('the insights route is reachable and shows missing-data notices with no sessions logged', async ({
  page,
}) => {
  await page.goto('/insights');

  await expect(page.getByRole('heading', { name: 'Insights' })).toBeVisible();
  await expect(
    page.getByText(/log an exercise a few more times/i),
  ).toBeVisible();
});

test('the settings route is reachable and shows the Data section (spec 006 FR-001/006)', async ({
  page,
}) => {
  await page.goto('/settings');

  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Data' })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Export data' }),
  ).toBeVisible();
});
