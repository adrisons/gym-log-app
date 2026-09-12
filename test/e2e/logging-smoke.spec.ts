import { expect, test } from '@playwright/test';

// spec 001 quickstart.md scenarios 1-2: open the form, find/create an
// exercise, add a set, and see it appear instantly with no Save control —
// proves the optimistic-UI wiring end to end in a real browser.
//
// Deliberately does NOT reload the page and assert the set survives:
// InMemoryStorageAdapter (src/infrastructure/) is explicitly non-durable
// (research.md §1) — its state lives only in this page load's JS heap, so
// a real page.reload() loses it today, correctly. That check belongs to
// the follow-up persistence spec once a real on-device adapter exists
// (quickstart.md scenario 3's revised wording carries the same note).

test('logging a set appears instantly, with no Save control, in a real browser', async ({
  page,
}) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Log a session' }),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Add exercise' }).click();
  await page
    .getByPlaceholder('Search or create an exercise')
    .fill('Back squat');
  await page.getByText('Create "Back squat"').click();

  await expect(page.getByRole('heading', { name: 'Back squat' })).toBeVisible();

  await page.getByRole('listbox', { name: 'Reps' }).click();
  await page.keyboard.press('ArrowDown', { delay: 20 });
  await page.keyboard.press('ArrowDown', { delay: 20 });
  await page.keyboard.press('ArrowDown', { delay: 20 });
  await page.keyboard.press('ArrowDown', { delay: 20 });
  await page.keyboard.press('ArrowDown', { delay: 20 });
  await page.getByRole('button', { name: 'Add set' }).click();

  await expect(page.getByText('5 reps')).toBeVisible();
  await expect(page.getByText('Save', { exact: false })).toHaveCount(0);
});
