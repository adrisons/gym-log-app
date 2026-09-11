# Quickstart: Persistence

How to validate this feature end-to-end once implemented. See
`contracts/storage-adapters.md` for the full scenario list and
`data-model.md` for the storage layout referenced below.

## Prerequisites

- `npm install` (Dexie is already a `dependencies` entry).
- `npm run build && npm run preview` (or let Playwright's `webServer` start
  it, as the existing e2e config already does).

## Automated validation

```sh
# Unit: the pure schema-version decision function and StorageError.kind
npm run test:unit -- test/unit/infrastructure

# Contract: the shared suite against both real adapters, in real browsers
npx playwright test test/e2e/indexed-db-adapter.contract.spec.ts
npx playwright test test/e2e/file-system-adapter.contract.spec.ts

# Full suite (unit + integration + e2e + boundaries), same as CI
npm run test:unit
npm run test:e2e
```

Expected outcome: every scenario in `contracts/storage-adapters.md` passes
for `IndexedDbStorageAdapter` in both the `chromium` and `webkit` Playwright
projects, and for `FileSystemStorageAdapter` in `chromium` only (WebKit has
no File System Access implementation — a `webkit` run of that spec file
would be un-runnable, not merely skipped, matching FR-004's feature
detection).

## Manual validation (real reload, not just re-render)

1. `npm run build && npm run preview`, open the app in Chromium.
2. Log a full session: add a block, add an exercise, confirm two sets.
3. Close the tab completely (not just navigate away).
4. Reopen the app at the same URL.
5. **Expected**: the session appears exactly as logged (User Story 1).
6. Start a new draft, add one exercise entry, confirm one set, then close
   the tab **without** finishing the session.
7. Reopen the app.
8. **Expected**: the in-progress draft is exactly where it was left (User
   Story 2), not lost.
9. Repeat steps 1–8 in a WebKit-based browser (Safari, or Playwright's
   `webkit` project manually) — behavior must be identical even though the
   underlying adapter (`IndexedDbStorageAdapter`, since File System Access
   is unavailable there) differs (User Story 3).
10. Inspect the File System Access-chosen directory (Chromium desktop) in
    the OS file browser — a `sessions/<id>.json` file per logged session
    should be present and legible as JSON (ADR-0002's "files the user can
    locate and inspect" promise, `data-model.md` §"File System Access —
    file map").
