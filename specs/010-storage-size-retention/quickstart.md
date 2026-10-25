# Quickstart: Storage Size Display and Old-Data Retention Cleanup

Manual validation, run once after `/speckit-implement` completes and
`npm run test`/`npm run lint`/`npm run typecheck` are green.

## Prerequisites

```bash
npm install
npm run dev
```

Open the app and log a handful of sessions spread across different dates —
at least one strictly before, and one strictly after, a date you'll use as
a cutoff below (e.g. one from over a year ago, one from this week).

## 1. Storage size readout (User Story 1, FR-001-004)

1. Open `/settings` → Data. Confirm a size figure appears next to the
   existing storage-status line, as a whole number with a `KB` or `MB`
   unit — never a decimal (SC-001).
2. Log one more session (or import a file via 006's existing Import flow).
   Return to `/settings` → Data. Confirm the figure increased (FR-004);
   reload the whole app first if it doesn't look different, then re-check
   — a live update while the screen stays open is not required (Non-Goals).
3. With only a fresh/seed-only install (no sessions logged yet, e.g. in a
   private/incognito window), open `/settings` → Data. Confirm a figure is
   still shown — at least "1 KB," never blank, an error, or "0 KB"
   (Acceptance Scenario 1.3).

## 2. Delete old data — quick option (User Story 2, FR-005-012)

1. `/settings` → Data → "Delete old data". Confirm the modal opens showing
   three quick options (older than 1 year / 6 months / 3 months) and an
   explicit-date field, with the delete action disabled until one is
   chosen (Acceptance Scenario 2.1).
2. Pick "older than 3 months" (or whichever matches your seeded data).
   Confirm a count of matching sessions appears before you confirm
   (Acceptance Scenario 2.2) and that it matches what you logged.
3. Confirm the delete action. Confirm a brief success message appears, the
   modal closes, and the deleted sessions are gone from `/diary` while
   every more-recent session is still there (Acceptance Scenario 2.4,
   SC-003).
4. Return to `/settings` → Data. Confirm the size figure from Part 1
   reflects the deletion (SC-004).

## 3. Delete old data — explicit date and edge cases

1. Reopen "Delete old data," enter an explicit date for which you know no
   sessions are older. Confirm the count reads zero and the delete action
   is disabled (Acceptance Scenario 2.3).
2. Enter an explicit date strictly in the future. Confirm it's accepted
   and the count reflects every remaining session (Edge Cases).
3. Enter an explicit date equal to a session's own logged day (same
   calendar day, different time). Confirm that session is **not** counted
   or deleted — the cutoff is start-of-day (FR-009a).
4. While typing an incomplete date in the explicit-date field, confirm no
   stale count from a previous selection is shown and the delete action
   stays disabled (Edge Cases).
5. Cancel out of the modal without confirming. Confirm nothing changed and
   reopening the modal starts with no cutoff chosen (Key Entities:
   Retention cutoff is not persisted).

## 4. Minimal text (FR-012)

Read through the "Delete old data" modal end to end. Confirm it carries
only: the cutoff chooser, the count, a confirm action, and a cancel
action — no extra explanatory paragraphs beyond those.

## 5. Contract tests (adapter parity)

```bash
npm run test:contract-adapters
```

Confirm the new `deleteSessionsBefore` scenarios
(`contracts/storage-port-additions.md`) pass identically for both the
IndexedDB and File System Access adapters, including the File System
adapter's interruption/resume case.
