# Quickstart: Settings, Export and Import

Manual validation, run once after `/speckit-implement` completes and
`npm run test`/`npm run lint`/`npm run typecheck` are green.

## Prerequisites

```bash
npm install
npm run dev
```

Open the app, log a couple of sessions with a few exercises/sets each (or
seed via the browser's storage devtools) so export/import have real data.

## 1. Settings persist and apply immediately (SC-003)

1. Open `/settings`. Change default unit to `lb`, theme to `dark`, first
   day of week to `sunday`.
2. Confirm the theme changes immediately (no reload).
3. Reload the app. Confirm all three choices are still in effect.
4. Open `/insights`; confirm the consistency card's week boundaries follow
   Sunday, not Monday (FR-018).

## 2. Export → import round-trip (SC-001, SC-005)

1. `/settings` → Data → "Export data". Save the JSON file.
2. Open the saved file in a text editor — confirm it is plain, readable
   JSON: exercise names appear next to their ids, no opaque-only
   identifiers, no file paths or user-agent strings anywhere (SC-009).
3. On the same install, Import that same file. Confirm the preview shows
   every session/exercise as "replace" (same ids) and zero "add" (SC-005:
   idempotent self-import).
4. Confirm the import.
5. In a private/incognito window (a second, independent install), import
   the same file. Confirm the preview shows every session and
   user-added/edited exercise as "add," and the two installs' seed
   entries show as additions too (documented limitation, spec.md
   Assumptions).

## 3. AI-agent readability (SC-008, manual, not CI-gated)

1. Take the exported JSON from step 2 (or a smaller one-session sample).
2. Paste its full content into a general-purpose LLM chat with the prompt:
   "Here is my workout data export. What exercises did I do in my most
   recent session, and what were the loads/reps?"
3. Confirm the assistant correctly states the session's date, its
   exercises, and the load/reps per set, using only the pasted file.
4. Record the outcome (pass/fail, date, model used) as a one-line note
   appended to this file's "Validation log" section below.

## 4. Rejection paths (SC-002)

1. Try importing a random unrelated JSON file. Confirm a clear rejection
   message, no preview shown.
2. Hand-edit a valid export's `schemaVersion` to a number higher than the
   app's `CURRENT_SCHEMA_VERSION`. Try importing it. Confirm rejection
   with no preview and no local-data change.

## 5. Delete everything (SC-004)

1. With existing data, `/settings` → Data → "Delete everything".
2. Confirm the first dialog, then the second (irreversible wording).
3. Confirm: diary is empty, exercise catalogue is back to exactly the
   seed set, Settings are back to defaults, band labels are empty.

## 6. Performance measurement (FR-020)

Run against a representative data set (100 sessions × 4 blocks × 3
exercises × 3 sets — build via a small script or the existing test
fixtures) using the browser devtools Performance panel or
`console.time`/`console.timeEnd` around each operation:

- Export (JSON): record duration.
- Export (CSV): record duration.
- Import (same-size file): record duration.
- Delete-everything: record duration.

Record each number, the date measured, and the browser/adapter tested
(File System vs. IndexedDB) below.

## Validation log

*(Filled in during implementation — one line per check above, date and
result.)*
