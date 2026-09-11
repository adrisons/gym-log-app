# Contract: Real `StoragePort` adapters

This spec does not change `StoragePort`'s method signatures
(`src/application/ports/storage-port.ts`, finalized by spec 002) except the
one addition below. This document states what both real adapters must
prove, via one shared contract test suite, extending — not replacing — the
Given/When/Then vocabulary spec 002 already established for the in-memory
fake.

## `StorageError.kind` addition (FR-012a)

```ts
// src/application/errors.ts
export interface StorageError extends Error {
  cause?: unknown;
  kind?: 'quota-exceeded' | 'permission-lost' | 'schema-too-new';
}
```

`kind` is absent for any failure not covered above — it is not a general
error-code system, only the three cases spec.md's FR-010 and Edge Cases
require the application layer to distinguish. `message` remains the only
human-readable text; `kind` is never shown to the user directly (that
remains a future presentation-layer concern, out of this spec's scope).

## Shared contract test suite — scenario list

`test/contract/storage-adapter-contract.ts` exports one function,
`runStorageAdapterContract(makeAdapter: () => Promise<StoragePort>)`, run
against both real adapters (research.md §3). Every scenario below restates
a spec.md Acceptance Scenario; the number in parentheses is that scenario's
ID.

**Sessions (User Story 1)**

1. Save a Session with two Blocks and several Sets → new adapter instance
   (simulating an app restart) → `listSessions`/`getSession` returns it
   unchanged (US1 #1).
2. Add/rename/merge an Exercise → restart → `listExercises` reflects the
   same state (US1 #2).
3. Save a Body measurement → restart → `listBodyMeasurements` returns it
   (US1 #3).

**Draft (User Story 2)**

4. Save a Draft with one Block, one Exercise entry, two confirmed Sets →
   restart without discarding or promoting → `getDraft` returns the same
   draft (US2 #1).
5. Discard the draft, or promote it to a saved Session → restart →
   `getDraft` returns nothing left over (US2 #2).

**Cross-adapter parity (User Story 3)**

6. Every scenario in this list passes identically against both adapters —
   asserted by running the same suite function against each, not a
   separate scenario of its own.
7. `saveBandLabels`/`listBandLabels` round-trips in order → restart →
   `listBandLabels` returns the same order (US3 #5).

**Schema version (User Story 4)**

8. Seed `stored = 0` (never initialized) → open → no migration recorded,
   first write leaves `getSchemaVersion() === CURRENT_SCHEMA_VERSION`.
9. Seed `0 < stored < CURRENT_SCHEMA_VERSION` → open → migration runs,
   `getSchemaVersion()` reads back `CURRENT_SCHEMA_VERSION` afterward (US4
   #1). (No real migration script exists yet at `CURRENT_SCHEMA_VERSION =
   1` — this scenario is exercised against a synthetic "version 0 with
   data" fixture the test suite constructs, per spec.md's Non-Goals: "no
   new schema version or migration script.")
10. Seed `stored === CURRENT_SCHEMA_VERSION` → open → no migration, no data
    change (US4 #2).
11. Seed `stored > CURRENT_SCHEMA_VERSION` → open → nothing written, stored
    data unchanged, a `StorageError` with `kind: 'schema-too-new'` surfaces
    (US4 #3).

**Cascades and atomicity**

12. `mergeExercises` reassigns every referencing Session/Set and repoints a
    referencing Draft → restart → all reads reflect the merged state (FR-013).
13. `deleteExerciseCascade` removes every referencing Block/Exercise
    entry/Set and prunes a referencing Draft → restart → all reads reflect
    the cascade (FR-013).
14. A simulated write failure partway through a multi-record cascade
    leaves every previously stored record completely unchanged (FR-011).

**Errors**

15. A simulated quota-exceeded condition surfaces `StorageError` with
    `kind: 'quota-exceeded'`, previous data unchanged.
16. (File System Access adapter only) A simulated lost/revoked permission
    surfaces `StorageError` with `kind: 'permission-lost'`, distinguishable
    from "no data yet" (an empty read).

Adapters run every scenario above with no skip and no weakened assertion
(spec.md FR-003) — a scenario an adapter's platform cannot support at all
(there is none identified for v1 scope) would itself be a plan-level
finding, not a silent per-adapter exception.
