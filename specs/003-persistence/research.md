# Research: Persistence

Phase 0 output for `specs/003-persistence/plan.md`. Each section resolves
one Technical Context item or one implementation-shape question spec.md's
review left for planning to settle (spec-reviewer/schema-guardian findings
already resolved *in* spec.md itself — FR-007a, FR-004a, FR-011, FR-012a —
are not re-litigated here; this file is about *how*, not *what*).

## 1. Schema version: storage location and decision function

**Decision**: A single pure function,
`decideSchemaAction(stored: number, current: number): 'migrate' | 'open' | 'refuse'`,
lives in `src/infrastructure/schema-version.ts` alongside
`export const CURRENT_SCHEMA_VERSION = 1`. Both adapters call it identically
on startup, before any other storage operation, per FR-008/009/010:

- `stored === 0` (FR-007a's "never initialized" sentinel) → treated as
  `'open'` (no migration: there is nothing to migrate), and the adapter
  writes `CURRENT_SCHEMA_VERSION` on its first real write, not before.
- `0 < stored < current` → `'migrate'`.
- `stored === current` → `'open'`.
- `stored > current` → `'refuse'`.

Each adapter stores the version number itself in its own native location
(Dexie: a `meta` table row; File System Access: a `_meta.json` file — see
§5/§6) — the port's `getSchemaVersion`/`setSchemaVersion` contract already
abstracts this, so the two adapters never need to agree on a physical
format, only on the number and the decision function above.

**Rationale**: Keeping the three-way (four-way, counting the sentinel)
decision in one pure, adapter-agnostic function means it is unit-testable
under Vitest with zero real storage, and both adapters are guaranteed to
agree — a divergence here is exactly the "silent corruption" risk
schema-guardian flagged in review.

**Alternatives considered**: Duplicating the decision inline in each
adapter — rejected, it is the one place a future third adapter (were one
ever added) could silently diverge, and it adds no value duplicated.

## 2. File System Access: handle acquisition, persistence, and re-permission

**Decision**: `FileSystemStorageAdapter` does not acquire its
`FileSystemDirectoryHandle` in its constructor. It exposes a method the
composition root calls once, inside the first real user-gesture-triggered
write path (FR-004a) — concretely, `logging-store.ts`'s existing "confirm a
set" action already runs inside a user gesture (a tap), so the very first
`saveDraft`/`saveSession` call is a legitimate place to trigger
`window.showDirectoryPicker()` if no handle is stored yet. Once acquired,
the handle itself (structured-cloneable per the File System Access spec) is
persisted in a small dedicated IndexedDB store (via Dexie — the same helper
already in the stack, used here purely as a handle-cache, not as the
adapter's own data store) so it survives a reload. On every later launch,
the adapter calls `handle.queryPermission({ mode: 'readwrite' })` in the
background — no dialog — and only surfaces a `StorageError` with
`kind: 'permission-lost'` (FR-012a) if that query does not resolve to
`'granted'`.

**Rationale**: This is the only sequencing that satisfies both FR-004
(adapter *class* selection at startup, no gesture) and FR-004a (handle
*acquisition* deferred to an already-gesture-triggered write) without
adding a picker dialog to the logging critical path (Principle II). Storing
the handle in IndexedDB rather than re-prompting every launch is the
standard pattern the File System Access API's own persistence design
assumes (`queryPermission` existing specifically to avoid re-prompting).

**Alternatives considered**: Prompting at app open — rejected outright,
violates FR-004a and Principle II (a blocking dialog on launch). Re-deriving
the handle from a stored path string — rejected, the API does not expose
real filesystem paths for security reasons; the handle object itself is the
only durable reference.

## 3. Contract test execution strategy

**Decision**: The shared contract test suite
(`test/contract/storage-adapter-contract.ts`) is written once, as a plain
function taking a `StoragePort` factory and running every Given/When/Then
scenario from spec.md's User Stories 1–4 against it (extending, not
replacing, the vocabulary spec 002 already established for the in-memory
fake). It is invoked from two Playwright spec files
(`test/e2e/indexed-db-adapter.contract.spec.ts`,
`test/e2e/file-system-adapter.contract.spec.ts`), each of which loads a
minimal fixture page (`test/e2e/fixtures/storage-harness.html`, served by
the same Vite preview server the existing e2e suite already uses) that
imports the adapter module and exposes a small
`window.__runContractSuite(adapterKind)` hook; the Playwright test calls it
via `page.evaluate()` and asserts on the structured result it returns. The
IndexedDB spec runs in both the `chromium` and `webkit` Playwright projects
(already configured in `playwright.config.ts`); the File System Access spec
runs in `chromium` only, since WebKit has no File System Access
implementation — matching exactly the feature-detection fallback FR-004
specifies for production, so an untested combination in CI (File System
Access on WebKit) is also a combination that can never occur on a real
device.

For the File System Access contract runs specifically, the harness acquires
its directory handle via `navigator.storage.getDirectory()` (Origin Private
File System) rather than `showDirectoryPicker()` — OPFS returns a real
`FileSystemDirectoryHandle` with no user gesture and no dialog, so it
exercises the exact same adapter code path (the adapter is written against
the `FileSystemDirectoryHandle` interface, not against which acquisition
API produced it) while staying fully automatable. The production
composition root still calls `showDirectoryPicker()` per §2 above; only the
test harness substitutes OPFS as the handle source.

**Rationale**: This is the only approach that proves the real reload-
survival behavior spec.md's Independent Test sections literally ask for ("a
fresh script context, not just a re-render") without adding a new
dependency for a concern (`IndexedDB`/File System Access in a non-browser
test runtime) `docs/stack.md` does not already list. It also directly
proves FR-004's feature-detection fallback is correct, since the WebKit run
is the one place in the whole test suite that structurally cannot use File
System Access.

**Alternatives considered**: `fake-indexeddb` npm package under Vitest+jsdom
— rejected as a new devDependency for a concern already coverable by the
existing Playwright stack, and it would prove nothing about File System
Access at all (no equivalent jsdom polyfill exists for that API), leaving
User Story 3's "both adapters behave identically" claim only half-tested.
A real native filesystem directory via Playwright's Node-side `fs` APIs
bridged into the page — rejected in favor of OPFS: OPFS is same-origin,
sandboxed, requires no Node/browser IPC bridge, and is a real, spec-defined
`FileSystemDirectoryHandle`, not a stand-in.

## 4. Atomic writes (FR-011)

**Decision**:

- **IndexedDB (Dexie)**: every `StoragePort` method that writes more than
  one record (notably `mergeExercises`, `deleteExerciseCascade`, and any
  method that also touches the `meta` schema-version row) wraps its writes
  in a single `db.transaction('rw', [...tables], fn)`. Dexie/IndexedDB
  transactions are atomic and isolated by the platform itself — no
  hand-rolled rollback logic is needed.
- **File System Access**: `FileSystemFileHandle.createWritable()` writes to
  a temporary swap file per the File System Access API's own specification,
  and only replaces the real file's contents when the stream's `close()` is
  called; a failure before `close()` leaves the original file completely
  untouched. Each write therefore serializes its full JSON payload in
  memory first, calls `write()` once, then `close()` — never a sequence of
  partial writes — so a mid-write failure (quota, interruption) never
  produces a half-written file. A multi-file cascade (`mergeExercises`,
  `deleteExerciseCascade` touching several session files) performs every
  file's writable-stream `write()`/`close()` pair, and only if all of them
  succeed; if any fails partway through the set, the adapter treats the
  whole call as failed and reports `StorageError` — per-call atomicity
  (FR-011) is about "no partially-written record" for each file this
  spec's scope covers, not a distributed multi-file transaction, which the
  File System Access API has no primitive for. (This matches FR-011's own
  text: "every underlying record... MUST succeed together or leave
  previously stored data completely unchanged" is satisfied per-record by
  the swap-file guarantee; the review finding this closes was about a
  *single* half-written record, not a lack of cross-file transactions —
  the latter is explicitly bounded to "not required... across separate
  `StoragePort` calls" territory by FR-011's own last sentence.)

**Rationale**: Both platforms already provide the atomicity primitive this
spec needs natively — no hand-rolled journaling/rollback code, which would
itself be a new source of bugs on the data-recoverability path Principle I
treats as non-negotiable.

**Alternatives considered**: Write-ahead logging with a manual commit
marker file — rejected as unnecessary complexity given the File System
Access API's swap-file behavior already provides the guarantee.

## 5. Dexie table schema

**Decision**: One Dexie database, tables: `sessions` (keyed by session id),
`exercises` (keyed by exercise id), `bodyMeasurements` (keyed by id),
`draft` (a single row, fixed key `'current'`), `bandLabels` (a single row,
fixed key `'current'`, value is the ordered array), `meta` (a single row,
fixed key `'schemaVersion'`). Every stored value is the same plain-object
shape the domain/application layer already produces (`Session`, `Exercise`,
etc., branded ids stored as their underlying string) — Dexie stores
structured-cloneable JS values directly, no serialization step of its own.

**Rationale**: Mirrors the port's own method grouping 1:1
(`src/application/ports/storage-port.ts`'s comments already group methods
by "Sessions" / "Exercise catalogue" / "Body measurements" / "The logging
draft" / band labels / schema version) — the simplest possible mapping,
nothing to design beyond naming the tables.

## 6. File System Access file layout

**Decision**: One user-selected root directory, with:

- `sessions/<sessionId>.json` — one file per Session, so a person who opens
  the directory sees individually legible, dated training records (ADR-0002's
  own promise: "data lives as files the user can locate and inspect" — a
  folder of per-session files fulfills this far more literally than one
  opaque blob would).
- `exercises.json` — the whole catalogue as one file (typically small,
  rarely more than a few hundred entries for a personal tool).
- `body-measurements.json` — all body measurements as one file (same
  reasoning).
- `draft.json` — the single pending `LoggingDraft`, absent when there is
  none.
- `band-labels.json` — the ordered Band label list.
- `_meta.json` — `{ "schemaVersion": number }`.

**Rationale**: Per-session files directly serve the "files a person can
locate and inspect" promise for the one record kind a person is most likely
to actually want to open individually (a specific day's training); grouping
the smaller, whole-catalogue-shaped data (exercises, body measurements,
band labels) into single files avoids hundreds of tiny files for data that
is never meaningfully read one-at-a-time.

**Alternatives considered**: One single `data.json` file for everything —
rejected, defeats ADR-0002's "locate and inspect" rationale for choosing
File System Access at all. A file per Body measurement — rejected as
unnecessary file-count growth for data with no natural "inspect this one"
use case the way a session has.

## 7. `StorageError.kind` discriminant (FR-012a)

**Decision**: `src/application/errors.ts`'s `StorageError` gains one new
optional field: `kind?: 'quota-exceeded' | 'permission-lost' |
'schema-too-new'`. Absent (`undefined`) covers every other failure — the
discriminant only needs to distinguish the three causes spec.md's FR-010
and Edge Cases explicitly require distinguishing; it is not a general
error-code system. `message` stays the human-readable text; `kind` is for
the application layer's own branching logic, never shown to the user
directly.

**Rationale**: The narrowest change that satisfies FR-012a, consistent with
the constitution's "no typing escape hatch... without being local, loud"
guidance applied in reverse — the smallest addition, not a speculative
general-purpose error taxonomy.

## 8. Concurrent tabs — confirmed no new technology needed

Per spec.md's Non-Goals, no cross-tab coordination is built. Both adapters'
"last write wins" behavior falls out naturally from not adding any
coordination — IndexedDB and File System Access both simply apply whichever
write reaches them last, no extra research needed here.
