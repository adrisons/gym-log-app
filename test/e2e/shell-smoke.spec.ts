import { expect, test } from '@playwright/test';

// Spec 000 FR-021: "an empty app that launches, with a smoke test" —
// proves the built app actually boots in a real browser, not just that the
// unit tests pass. Runs in both Chromium and WebKit (playwright.config.ts
// projects) — WebKit covers the iOS Safari / IndexedDB path (ADR-0002).

test('the app shell loads and the service worker registers', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'gym-log' })).toBeVisible();

  const serviceWorkerReady = await page.evaluate(async () => {
    if (!('serviceWorker' in navigator)) {
      return false;
    }
    const registration = await navigator.serviceWorker.ready;
    return Boolean(registration.active);
  });
  expect(serviceWorkerReady).toBe(true);
});
