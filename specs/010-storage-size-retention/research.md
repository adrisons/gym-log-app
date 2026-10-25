# Phase 0 Research: Storage Size Display and Old-Data Retention Cleanup

No `NEEDS CLARIFICATION` markers remain in `plan.md`'s Technical Context —
every item resolved directly from `docs/stack.md` (platform/language/
testing unchanged, no new dependency) or from the spec's own Assumptions.
The decisions below are the "how," made once here rather than left open
across `/speckit-tasks`.

## 1. How the stored-data size is computed

**Decision**: Compute size in the `application` layer, not a new port
method. `computeStorageSizeLabel` reads every record through the port's
*existing* methods — `listSessions(allStoredDataRange())`, `listExercises()`,
`getSettings()`, `getDraft()` — builds one plain object from the results,
and measures
`new TextEncoder().encode(JSON.stringify(thatObject)).length` (exact UTF-8
byte length of the object's JSON form).

**Rationale**:
- Every record this figure needs to cover is already readable through the
  port today; adding a `getStorageSizeBytes()` port method (as first
  considered before this research step) would mean three near-identical
  adapter implementations doing nothing a `list*`/`get*` combination in
  `application/` can't already do — unnecessary duplication for a
  spec that is explicit the figure is only an approximation, not a
  byte-exact adapter-level measurement (spec Assumptions).
- `TextEncoder` gives the actual UTF-8 byte count; `JSON.stringify(x).length`
  (a plain JS string length) undercounts anything with multi-byte
  characters (accented exercise names, emoji in notes) — wrong in exactly
  the direction that matters for this spec's domain (user-authored notes,
  per spec 006's export FR-023 about free-text fields).
- Keeps Principle IV's "ports in domain vocabulary" intact by not inventing
  a port method for something expressible through what's already there.

**Alternatives considered**:
- `navigator.storage.estimate()` — rejected: it reports the *origin's*
  total storage usage (shared with anything else same-origin, and
  unavailable/meaningless for the File System Access adapter, which isn't
  origin-scoped storage at all), not this app's own data specifically; the
  spec's own Assumptions already rule out relying on an exact
  OS/browser-reported quota figure for exactly this cross-adapter
  inconsistency.
- A new `getStorageSizeBytes()` port method with adapter-specific disk/DB
  size introspection (e.g. IndexedDB's own storage estimate API scoped
  somehow, or an actual file-size `stat` on the File System adapter's
  JSON files) — rejected: not available uniformly across both adapters
  (ADR-0002), and the spec explicitly accepts an approximation rather than
  requiring this.

## 2. Unit selection and rounding order (FR-002/FR-003)

**Decision**: `bytes` → exact `kb = bytes / 1024`.
1. If `kb >= 1024`: unit is MB, `displayValue = Math.round(kb / 1024)`.
2. Else: unit is KB, `displayValue = Math.round(kb)`. If that rounds up to
   exactly `1024`, promote instead: unit becomes MB,
   `displayValue = 1`.
3. If `displayValue === 0 && bytes > 0`, `displayValue = 1` (the FR-003
   floor).

**Rationale**: resolves spec-reviewer's earlier finding — the unit is
chosen from the *exact*, unrounded KB value (step 1/2's `kb >= 1024` test),
not from an already-rounded integer, so the common case is correct by
construction. Step 2's explicit promotion check is the one remaining
boundary FR-002 names directly: a true size just under 1024 KB (e.g.
1023.6 KB) picks the KB unit in step 2, but rounds up to the integer 1024
— exactly the "1024 KB" FR-002 forbids — so that one case is promoted to
"1 MB" explicitly rather than left to coincidence.

**Alternatives considered**: choosing the unit from the already-rounded KB
integer — rejected (spec-reviewer's original finding: this is exactly what
lets "1024 KB" leak through without the explicit promotion check above).

## 3. Quick-option date arithmetic and clamping (FR-006a)

**Decision**: A small pure helper, `cutoffMonthsAgo(from: Date, months: number): Date`
(1 year = `cutoffMonthsAgo(now, 12)`, 6/3 months direct): compute
`targetYear`/`targetMonth` by subtracting `months` from `from`'s
year*12+month index; compute that target month's last valid day via
`new Date(targetYear, targetMonth + 1, 0).getDate()`; the result's day is
`Math.min(from.getDate(), thatLastValidDay)`; hours/minutes/seconds are
zeroed (the cutoff is always start-of-day, FR-009a).

**Rationale**: `Date.prototype.setMonth`/`setFullYear` do not clamp on
overflow — they roll into the *next* month (e.g. Aug 31 minus 6 months via
naive `setMonth` lands on Mar 3, not Feb 28/29) — the opposite of FR-006a's
"clamp to the last valid day" rule. Computing the target month's length
directly (via the `new Date(y, m+1, 0)` idiom, which returns the last day
of month `m`) and clamping the day explicitly is the standard,
dependency-free way to get clamping instead of overflow from the platform
`Date` alone — matching `docs/stack.md`'s expectation that the platform
`Date` suffices here, no date library needed.

**Alternatives considered**: a date library (`date-fns`, Luxon) — rejected,
same as `docs/stack.md`'s existing "Not without an ADR" rule for a second
dependency in a concern (date handling) already deferred to "platform
`Date` is expected to suffice"; this feature is exactly the kind of small,
self-contained arithmetic that confirms that expectation rather than
overturning it.

## 4. `deleteSessionsBefore` atomicity per adapter

**Decision**: Add `deleteSessionsBefore(cutoff: string): Promise<number>`
to `StoragePort` (resolves to the number of Sessions removed, satisfying
FR-011's "how many were removed"). Implemented per adapter following each
one's own existing atomic-bulk-write precedent:

- **`InMemoryStorageAdapter`**: filter `#sessions` by `dateTime < cutoff`,
  delete the matches from the `Map`. Single-threaded, no partial-failure
  mode to guard against — same simplicity as every other method on this
  adapter.
- **`IndexedDbStorageAdapter`**: a single Dexie `'rw'` transaction on the
  `sessions` table — read every session, filter by `dateTime` in JS, then
  `bulkDelete` the matching ids, inside the transaction, returning the
  matched count. Not `where('dateTime').below(cutoff).delete()`: the
  `sessions` store has no Dexie index on `dateTime` (it's keyed by `id`
  alone — `infrastructure/indexed-db/schema.ts`), the same reason
  `listSessions` itself already does a full-table-scan-plus-JS-filter
  rather than an indexed range query; adding an index would mean a new
  Dexie schema version just for this one query, an unjustified schema
  change for a feature this small. Transactional atomicity is Dexie's
  existing guarantee either way, the same one `importBulk`/
  `resetToFreshInstall` already rely on.
- **`FileSystemStorageAdapter`**: a third `PendingBulkWrite` journal kind
  (`{ kind: 'delete-before', cutoff }`) alongside the existing `'import'`/
  `'reset'` kinds — written before any file is touched, replayed on the
  next read/write if a prior run was interrupted, removed once the matching
  session files are deleted — the exact crash-safety pattern
  `importBulk`/`resetToFreshInstall` already established (spec 006
  research.md §2), extended with one more journal variant rather than a new
  mechanism.

**Rationale**: `schema-guardian`'s review of the spec already established
that composing today's `listSessions` + a loop of individual
`deleteSession` calls cannot give FR-010's all-or-nothing guarantee — a
crash or thrown error partway through the loop leaves an undefined subset
deleted, with no journal to resume or roll back from. Each adapter already
has a proven atomic-bulk-write mechanism for exactly this shape of problem
(006); reusing it rather than inventing a fourth approach keeps the port's
one new method consistent with how the other two already behave.

**Alternatives considered**: looping `deleteSession` from `application/`
(no port change at all) — rejected, this is precisely the non-atomic
composition `schema-guardian` flagged as insufficient for FR-010.

## 5. UI pattern for the "Delete old data" modal

**Decision**: Follow this Settings screen's own existing inline-confirmation
convention exactly — `delete-everything-flow.tsx`'s own shape
(`role="alertdialog"`, the `.settings-preview`/`.settings-confirm-actions`
classes already in `settings.css`), not a new overlay/backdrop UI
primitive, and not the Logging/Catalogue screens' own `.block-card`
dialog shell (`logging.css`) — a different stylesheet and screen area
this feature has no reason to pull in. "Modal" in the spec's user-facing
language maps to this existing Settings-screen pattern, which
`docs/design.md`'s own dialog system already covers.

**Rationale**: `docs/stack.md`'s "no CSS-in-JS, one dialog system" posture
and this screen's own established precedent make introducing a second
dialog primitive (an actual `<dialog>`/backdrop overlay) an unjustified
new pattern for a feature whose own Non-Goals explicitly call for minimal
text and a simple, familiar shape — reusing what `delete-everything-flow.tsx`
already does is the simpler choice, not a new one.

**Alternatives considered**: a true modal backdrop (like
`block-card.tsx`'s own rename popup in the Logging screen,
`.block-card__rename-backdrop`) — rejected for this flow specifically;
that pattern exists in a different screen area for blocking interaction
with a specific in-progress edit mid-list, not for a
Settings-level confirmation, where every existing confirmation
(delete-everything, exercise-catalogue delete) already uses the inline
card shape instead.
