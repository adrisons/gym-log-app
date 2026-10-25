# Contract: `StoragePort` additions

Adds one method to `src/application/ports/storage-port.ts` (existing
methods unchanged). Follows the port's existing rules: returns a
`Promise`, rejects with `StorageError`, no infrastructure vocabulary.

```ts
/**
 * Deletes every Session whose own `dateTime` falls strictly before the
 * start of `cutoff`'s calendar day (FR-009/FR-009a), atomically — either
 * every matching Session is removed or (on failure) none of the intended
 * removals is left partially applied (FR-010, same all-or-nothing
 * guarantee as `importBulk`/`resetToFreshInstall`). Does not touch the
 * Exercise catalogue, band labels, Settings, or the pending logging draft,
 * regardless of their own dates (FR-009). Resolves to the number of
 * Sessions removed (FR-011).
 */
deleteSessionsBefore(cutoff: string): Promise<number>;
```

- `cutoff` is an ISO 8601 date-time string denoting the start of a
  calendar day in the device's local timezone (FR-009a) — the same
  "start of day" instant the "Delete old data" modal's cutoff calculation
  (quick option or explicit date) already resolves to before calling this
  method. This method does no clamping or date-arithmetic of its own; that
  happens in `application`/`presentation` before the call (research.md
  §3), matching Principle IV (a port expressed in plain "before this
  instant" terms, not in UI-selection vocabulary).
- Comparison is on parsed instants (`Date.parse`), not raw string
  comparison, matching every existing `listSessions`/`deleteSession`
  comparison in each adapter today (`in-memory-storage-adapter.ts`,
  `indexed-db-storage-adapter.ts`, `file-system-storage-adapter.ts`) — two
  equivalent timestamps with different UTC offsets must compare correctly.
- A `cutoff` matching zero Sessions is a valid call that resolves to `0`,
  not an error (spec Edge Cases: a future cutoff, or re-running after an
  earlier cleanup).

## Atomicity requirement

`deleteSessionsBefore` MUST be all-or-nothing: an interruption mid-call
MUST leave every Session either already removed or still fully present —
never a Session partially written/corrupted, and never some-but-not-all of
the matched set removed with no record of which. Per-adapter technique is
an implementation detail (research.md §4 — a `Map` filter for the in-memory
adapter, a single Dexie transaction for IndexedDB, a `PendingBulkWrite`
journal entry for the File System Access adapter); the contract only
constrains the observable guarantee, the same convention
`specs/006-settings-data/contracts/storage-port-additions.md` already
established for `importBulk`/`resetToFreshInstall`.

## Contract tests

`test/e2e/indexed-db-adapter.contract.spec.ts` and
`test/e2e/file-system-adapter.contract.spec.ts` each gain the same
scenario list (mirroring how both files already run the same cases for
every existing port method), plus an `InMemoryStorageAdapter` unit-test
counterpart:

1. `deleteSessionsBefore(cutoff)` removes every Session whose `dateTime` is
   strictly before `cutoff` and leaves every Session on or after `cutoff`
   untouched, durably (survives a simulated restart for the two real
   adapters, matching every other durability case in these files).
2. `deleteSessionsBefore(cutoff)` resolves to the exact count of Sessions
   removed.
3. `deleteSessionsBefore(cutoff)` matching zero Sessions resolves to `0`
   and changes nothing.
4. `deleteSessionsBefore(cutoff)` leaves the Exercise catalogue, band
   labels, Settings, and the pending logging draft completely unchanged.
5. A Session whose `dateTime` is later the same calendar day as `cutoff`
   is kept, not removed (start-of-day semantics, FR-009a).
6. (File System adapter only, mirroring the existing `importBulk`/
   `resetToFreshInstall` interruption cases in that file) a
   `deleteSessionsBefore` call interrupted after the journal is written but
   before every matching file is removed resumes correctly — on the next
   read or write, the remaining matches are removed and the journal is
   cleared, with no double-counting or partial state observable in between.
