import { expect, test } from '@playwright/test';

// spec 001 quickstart.md scenarios 1-2: open the form, find/create an
// exercise, fill in a set, and confirm it — proves the optimistic-UI
// wiring end to end in a real browser.
//
// Deliberately does NOT reload the page and assert the set survives:
// InMemoryStorageAdapter (src/infrastructure/) is explicitly non-durable
// (research.md §1) — its state lives only in this page load's JS heap, so
// a real page.reload() loses it today, correctly. That check belongs to
// the follow-up persistence spec once a real on-device adapter exists
// (quickstart.md scenario 3's revised wording carries the same note).

test('logging a set requires an explicit Confirm tap and then appears instantly, in a real browser', async ({
  page,
}) => {
  await page.goto('/');

  // `/` redirects to `/diary` (the app's home — FR-1's design-refinement
  // pass); the logging form is reached from its floating action, not a
  // persistent nav tab.
  await expect(page.getByRole('heading', { name: 'Diary' })).toBeVisible();
  await page.getByRole('link', { name: 'Log session' }).click();

  await expect(
    page.getByRole('heading', { name: 'Log a session' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page
    .getByPlaceholder('Search or create an exercise')
    .fill('Back squat');
  await page.getByText('Create "Back squat"').click();

  await expect(page.getByRole('heading', { name: 'Back squat' })).toBeVisible();

  // ADR-0010: filling in only one of the two fields the template tracks
  // (Weight + Reps by default) never commits anything on its own — the
  // Confirm button stays disabled until both are filled.
  await page.getByRole('listbox', { name: 'Reps' }).click();
  await page.keyboard.press('ArrowDown', { delay: 20 });
  await page.keyboard.press('ArrowDown', { delay: 20 });
  await page.keyboard.press('ArrowDown', { delay: 20 });
  await page.keyboard.press('ArrowDown', { delay: 20 });
  await page.keyboard.press('ArrowDown', { delay: 20 });

  await expect(page.getByText('5 reps')).toHaveCount(0);
  const confirm = page.getByRole('button', { name: 'Add set' });
  await expect(confirm).toBeDisabled();

  await page.getByRole('spinbutton', { name: /weight/i }).fill('60');
  await expect(confirm).toBeEnabled();
  await confirm.click();

  await expect(page.getByText('60 kg')).toBeVisible();
  await expect(page.getByText('5 reps')).toBeVisible();
  // Confirming collapses the form to a compact "+ Add set" button
  // (ADR-0010) rather than leaving the full form open.
  await expect(page.getByRole('spinbutton', { name: /weight/i })).toHaveCount(
    0,
  );
  await expect(confirm).toBeVisible();
});
