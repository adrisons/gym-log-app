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
// "/" still renders the logging screen exactly as before (plan.md
// Constitution Check, Principle II: no regression to the logging critical
// path), and a second test confirms the new "/diary" route is reachable.

test('the app boots to the logging screen and the service worker registers', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Log a session' }),
  ).toBeVisible();

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
