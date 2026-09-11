# Feature Specification: Persistence

**Feature Branch**: `003-persistence`

**Created**: 2026-09-11

**Status**: Implemented — pending merge (PR opening)

**Input**: User description: "Persistence: real durable storage adapters
behind the existing StoragePort (ADR-0002) — IndexedDbStorageAdapter
(Dexie) and FileSystemStorageAdapter, chosen once per device via feature
detection at the composition root, both tested against one shared contract
test suite. Closes the gap left by spec 001 (Log a Session), which was
built and tested against a non-durable InMemoryStorageAdapter: FR-005 (no
data lost across an app close) and FR-024 (the logging draft survives an
app close) are not yet true on a real device. Also covers the
schema-version read/write seam docs/requirements.md §6 already named at
the port level (getSchemaVersion/setSchemaVersion) — migrate-older/
open-same/refuse-newer behavior on real storage, per
docs/agent-brief.md's Phase 2 — Persistence."

## Context *(mandatory)*

`specs/002-domain-and-ports/` finalized `StoragePort`
(`src/application/ports/storage-port.ts`) and its in-memory fake.
`specs/001-log-a-session/` built the entire logging screen against that
fake, wired at the composition root (`src/presentation/main.tsx`) via
`InMemoryStorageAdapter` — whose own doc comment says explicitly it is
"NOT durable". Every scenario in spec 001 (saving a session, editing the
catalogue, the in-progress draft surviving an interruption) currently
passes only because the whole app lifetime fits inside one page load; none
of it survives a real reload, tab close, or device restart. That gap is
tracked by name in `specs/001-log-a-session/research.md` §1 as this spec's
starting point.

ADR-0002 already decided the shape of the fix: one `StoragePort`, two real
adapters (`IndexedDbStorageAdapter` for platforms without File System
Access — notably iOS Safari — and `FileSystemStorageAdapter` where it is
available), chosen once per device via feature detection at the
composition root, both proven against one shared contract test suite so
"does this adapter satisfy the port" is asked once, not once per adapter.
This spec is that decision made real: it swaps the composition root's one
`InMemoryStorageAdapter` line for a real, feature-detected adapter and
gives every existing `StoragePort` method (including `getSchemaVersion`/
`setSchemaVersion`, named at the port level but never yet exercised
against real storage) a durable, spec-tested implementation. No new
domain entity, no new port method, and no change to any screen — spec 001
and 002's own contracts already describe everything this spec must make
true on disk.

## User Scenarios & Testing *(mandatory)*

This spec has no new UI. Its "users" are every existing spec-001 scenario,
now required to hold across a real reload rather than only within one page
session — plus the schema-version behavior `docs/requirements.md` §6
already specifies at the data layer.

### User Story 1 - A logged session survives closing the app (Priority: P1)

A person logs a full training session, then closes the browser tab (or the
installed PWA) without explicitly doing anything to "save". They reopen
the app later, on the same device, and their session is exactly as they
left it.

**Why this priority**: This is the constitution's Principle I (Data
Ownership & Recoverability) and Principle II (Logging Is the Critical
Path) made concrete — without it, the app has no reason to exist as a
training log. It is the single gap spec 001 was explicitly built and
merged without closing.

**Independent Test**: Log a session end-to-end against a real adapter
(IndexedDB or File System Access, whichever the test environment
provides), reload the page (a fresh script context, not just a
re-render), and confirm the session reads back byte-for-byte equal in
every field that matters (exercises, sets, loads, effort, timestamps).

**Acceptance Scenarios**:

1. **Given** a session with two blocks and several sets has been logged,
   **When** the app is closed and reopened on the same device, **Then**
   `listSessions` for a range covering that session returns it with every
   block, exercise entry, and set intact.
2. **Given** the exercise catalogue has an added, renamed, or merged
   exercise, **When** the app is reopened, **Then** `listExercises`
   reflects the same state it had before closing.
3. **Given** a body measurement was recorded, **When** the app is
   reopened, **Then** `listBodyMeasurements` for a covering range returns
   it.

---

### User Story 2 - An in-progress draft survives closing the app (Priority: P1)

A person is mid-way through logging a session (some sets entered, more to
go) when the app is closed unexpectedly — the phone locks, the browser is
force-closed, the tab crashes. They reopen the app and their in-progress
draft is exactly where they left it, not lost.

**Why this priority**: spec 001 FR-024 requires this; a lost mid-session
draft is the single worst failure mode for a tool meant to be used
one-handed, mid-workout, with an unreliable connection to nothing but the
device itself.

**Independent Test**: Start a draft, add a block and a partial exercise
entry, reload the page without calling `discardDraft`, and confirm
`getDraft()` returns the same draft content.

**Acceptance Scenarios**:

1. **Given** a draft with one block and one exercise entry with two
   confirmed sets, **When** the app is reopened without the draft having
   been explicitly discarded or promoted to a Session, **Then** `getDraft`
   returns that same draft.
2. **Given** a draft was explicitly discarded (`discardDraft`) or promoted
   to a saved Session before closing, **When** the app is reopened,
   **Then** `getDraft` returns nothing left over from that draft.

---

### User Story 3 - The app works the same way on every supported device (Priority: P2)

The two real adapters (IndexedDB, File System Access) must behave
identically from the application layer's point of view — a person moving
between a desktop browser and an iOS device should never notice which
storage mechanism is underneath.

**Why this priority**: ADR-0002's explicit promise is "full feature
parity, not a degraded tier" for the adapter iOS Safari falls back to.
Without one shared contract test suite proving both adapters equally,
that promise is undocumented intent, not a tested fact.

**Independent Test**: Run the same contract test suite (the same
Given/When/Then scenarios spec 001/002 already wrote against the
in-memory fake) against both `IndexedDbStorageAdapter` and
`FileSystemStorageAdapter` in this feature's own test environment, and
confirm both pass every scenario identically.

**Acceptance Scenarios**:

1. **Given** the shared contract test suite, **When** it is run against
   `IndexedDbStorageAdapter`, **Then** every scenario passes.
2. **Given** the same shared contract test suite, **When** it is run
   against `FileSystemStorageAdapter`, **Then** every scenario passes with
   no adapter-specific exceptions or skipped cases.
3. **Given** a device where File System Access is unavailable (e.g. iOS
   Safari, detected via feature detection), **When** the app starts,
   **Then** the composition root selects `IndexedDbStorageAdapter`
   automatically, with no user-facing choice.
4. **Given** a device where File System Access is available, **When** the
   app starts, **Then** the composition root selects
   `FileSystemStorageAdapter` automatically.
5. **Given** the user's reorderable Band load labels (spec 001 FR-011)
   have been saved, **When** the app is reopened, **Then**
   `listBandLabels` returns them in the same order, for both adapters —
   the shared contract suite covers this surface the same way it covers
   Sessions and the draft, per this story's own promise of identical
   behavior across every `StoragePort` method.

---

### User Story 4 - The stored schema version is honored on open (Priority: P2)

The app reads the schema version stored alongside the data every time it
opens, and behaves per `docs/requirements.md` §6: migrates automatically
if the stored version is older than what the app expects, opens normally
if it matches, and refuses to write anything (with a clear explanation)
if the stored version is newer than the app understands.

**Why this priority**: `getSchemaVersion`/`setSchemaVersion` already exist
on the port (spec 002) but have never been exercised against real
storage or a real version mismatch — this is the seam
`docs/agent-brief.md` names explicitly for this phase, and getting it
wrong risks silent data corruption, which Principle I treats as
unacceptable.

**Independent Test**: Seed a real adapter's underlying storage with each
of the three version relationships (older, same, newer than the app's
current schema version) before app start, and confirm the app's observed
behavior (migrate-and-record, open normally, or refuse-and-explain)
matches `docs/requirements.md` §6 in each case.

**Acceptance Scenarios**:

1. **Given** stored data at a schema version older than the app's current
   version, **When** the app opens, **Then** it migrates the data
   automatically, records that a migration happened, and the app is
   usable afterward with the schema version now current.
2. **Given** stored data at the app's current schema version, **When** the
   app opens, **Then** it opens normally with no migration and no data
   change.
3. **Given** stored data at a schema version newer than the app
   understands, **When** the app opens, **Then** it writes nothing,
   leaves the stored data untouched, and shows a clear explanation that
   the app is out of date — logging is not available until the app is
   updated.

### Edge Cases

- What happens when the device's storage quota is exceeded mid-write
  (a `saveSession` or `saveDraft` call fails partway)? The write must fail
  atomically — either the whole record is stored or the previous state is
  left intact, never a half-written record — and the failure surfaces as
  a `StorageError` (see FR-012a on distinguishing its cause) for the
  application layer to handle (no new UI this spec is adding).
- What happens if the File System Access adapter's file handle permission
  is revoked or lost between sessions (the browser forgets the grant)? The
  adapter must reject with a `StorageError` whose cause identifies
  "permission lost/denied" (FR-012a), distinguishable from a "no data yet"
  state, so the application layer does not mistake "permission lost" for
  "nothing has ever been saved here" — the concrete UI for re-requesting
  permission is out of scope for this spec (see Non-Goals).
- What happens to a `LoggingDraft` that referenced an Exercise since
  deleted or merged away, when it is read back after a restart? The
  existing cascade/repoint behavior already specified on `mergeExercises`
  and `deleteExerciseCascade` (spec 002 port doc) applies the same way
  whether the draft was just written or read back after a restart — this
  spec adds no new draft-repair behavior.
- What happens on the very first launch on a device with no stored data at
  all? `getSchemaVersion` MUST return a defined sentinel value (0 — the
  same "not yet initialized" value `InMemoryStorageAdapter` already
  defaults to) rather than being treated as absent, since the port's
  signature (`Promise<number>`) has no `undefined` variant. A stored
  version of 0 is a fourth, distinct case from FR-008/009/010's
  older/same/newer: it means "never initialized," triggers no migration,
  and the adapter writes the app's current schema version (see FR-007a)
  on its first real write, not before. Every list/get method for Session,
  Exercise, BodyMeasurement, and Draft still returns the "nothing here
  yet" result the port already defines for them (an empty list /
  `undefined`) — only `getSchemaVersion`'s non-nullable `number` return
  needed its own sentinel.
- What happens when the same device has two tabs or windows of the app
  open at once, each writing independently? This spec does not add
  cross-tab write coordination or locking — the last write to complete
  for a given record wins, consistent with this being a single-user,
  single-device personal tool (`docs/requirements.md` §1.2) rather than a
  multi-writer system. Coordinating concurrent tabs is explicitly out of
  scope (see Non-Goals).

## Non-Goals *(mandatory)*

- **Export/import (FR-12 in `docs/requirements.md`)** — the interchange
  format ADR-0002 references is a separate, later capability; this spec
  only makes the two adapters durable and schema-aware, not portable
  between devices via a file a person hands over manually.
- **A user-facing re-permission flow for File System Access** — when a
  browser revokes or forgets a file handle grant, this spec's adapter
  surfaces `StorageError` per the Edge Cases above; the screen/flow that
  asks the user to re-grant permission is presentation-layer work for a
  future spec.
- **Any new schema version or migration script** — this spec proves the
  three-way migrate/open/refuse behavior `docs/requirements.md` §6 and
  spec 002 already specify, using the app's current (first real) schema
  version; it does not introduce a schema change of its own.
- **Multi-device sync** — `docs/requirements.md` §1.2 already rules this
  out project-wide; each adapter is durable on its own device only.
- **Changing anything about spec 001's screens, `logging-store.ts`, or any
  use case** — every existing call site already goes through
  `StoragePort`; this spec only changes which concrete class the
  composition root instantiates, plus the narrow `StorageError`
  discriminant FR-012a adds.
- **A settings UI to override the automatically detected adapter** —
  ADR-0002 is explicit that the choice is "never a user-facing setting."
- **Coordinating writes across multiple simultaneously open tabs/windows
  of the app on one device** — last write wins; explicit conflict
  detection or locking across tabs is deferred to a future spec if it
  ever proves necessary for this single-user tool.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an `IndexedDbStorageAdapter` that
  implements every method of `StoragePort`
  (`src/application/ports/storage-port.ts`) durably — data written in one
  page load MUST be readable, unchanged, after a full reload or app
  restart on the same device.
- **FR-002**: The system MUST provide a `FileSystemStorageAdapter` that
  implements every method of `StoragePort` durably, with the same
  reload-survival guarantee as FR-001, backed by the File System Access
  API.
- **FR-003**: Both adapters MUST be verified against one shared contract
  test suite expressing every `StoragePort` method's behavior in
  domain/Given-When-Then terms (ADR-0002), with no adapter-specific
  exceptions, skips, or weakened assertions in either adapter's run of
  that suite.
- **FR-004**: The composition root (`src/presentation/main.tsx`) MUST
  select which adapter class to use via feature detection, at startup,
  with no user-facing choice and no build-time branch:
  `FileSystemStorageAdapter` where the File System Access API is
  available, `IndexedDbStorageAdapter` otherwise.
- **FR-004a**: Feature-detecting *which class to use* MUST happen at
  startup without any user gesture. Actually *acquiring* the
  `FileSystemStorageAdapter`'s directory handle (which the File System
  Access API requires a user gesture for) MUST be deferred to the first
  storage write the adapter performs — which is already triggered by a
  real user action in every existing flow (e.g. confirming a set) — never
  by a dialog shown at app-open time. On every later launch, the adapter
  MUST silently re-check a previously granted, persisted handle's
  permission in the background (no dialog) and only surface a
  `StorageError` (FR-012a) if that permission is gone, per
  `docs/requirements.md` §7.5's "requested inside a user gesture...
  background code checks permission and never prompts."
- **FR-005**: A Session saved via `saveSession` MUST be returned unchanged
  by `listSessions`/`getSession` after the app is closed and reopened on
  the same device, for both adapters (closes the gap spec 001's FR-005
  left open against the in-memory fake).
- **FR-006**: A `LoggingDraft` saved via `saveDraft` MUST be returned
  unchanged by `getDraft` after the app is closed and reopened on the same
  device, for both adapters, unless it was explicitly discarded
  (`discardDraft`) or superseded by a saved Session before closing (closes
  spec 001's FR-024 gap).
- **FR-007**: `getSchemaVersion`/`setSchemaVersion` MUST persist the
  schema version durably across a restart, for both adapters.
- **FR-007a**: The app's current schema version, for this spec, is **1**.
  `getSchemaVersion` on a device where no schema version has ever been
  written MUST return **0** (matching the sentinel
  `InMemoryStorageAdapter` already uses), which is neither "older" nor
  "same" nor "newer" than 1 — it is the distinct "never initialized" case
  (see Edge Cases): no migration runs, and the adapter writes 1 on its
  first real write.
- **FR-008**: On app start, if the stored schema version is older than the
  app's current schema version (i.e. between 1 and current − 1 inclusive
  — excluding the 0 "never initialized" sentinel, per FR-007a), the
  system MUST migrate the stored data to the current version
  automatically and record that the migration happened, before any other
  storage operation proceeds.
- **FR-009**: On app start, if the stored schema version equals the app's
  current schema version, the system MUST open normally with no migration
  and no data change.
- **FR-010**: On app start, if the stored schema version is newer than the
  app's current schema version, the system MUST NOT write anything to
  storage, and MUST make available a clear explanation that the app is out
  of date, distinct from any other error state (see FR-012a).
- **FR-011**: Every write MUST be atomic from the caller's point of view,
  at the granularity of one `StoragePort` method call — every underlying
  record a single call touches (for example `mergeExercises`'s or
  `deleteExerciseCascade`'s cascade across many Sessions and the draft)
  MUST succeed together or leave previously stored data completely
  unchanged; a failed write (e.g. quota exceeded, or a File System Access
  write interrupted partway) MUST never leave a partially written record
  or a partially applied cascade, for both adapters. Atomicity across
  separate `StoragePort` calls is not required (see Non-Goals on
  concurrent tabs).
- **FR-012**: Every rejection either adapter produces MUST be a
  `StorageError` (`src/application/errors`), never a raw
  infrastructure/browser error object, matching the existing port contract
  spec 002 already established.
- **FR-012a**: `StorageError` MUST carry a machine-checkable discriminant
  (for example a `kind`/`reason` field) distinguishing at least: quota
  exceeded, File System Access permission lost/denied, and schema version
  too new to open — so the application layer can react to each
  differently (FR-010's "distinct from any other error state," the
  permission-loss Edge Case) without resorting to matching on free-text
  `message` strings. Adding this discriminant to `StorageError` is the one
  `application/` file this spec is allowed to touch (a narrow exception to
  the Non-Goals' "no application-layer changes," since no adapter can
  satisfy FR-010/FR-012a without it).
- **FR-013**: `mergeExercises` and `deleteExerciseCascade`, when run
  against a real adapter, MUST leave storage in the same end state their
  existing port documentation already specifies (cascading/repointing
  Session and draft references), proven durable across a restart.
- **FR-014**: Swapping the composition root's adapter selection MUST
  require no change to any `application/` or `presentation/` file — the
  existing `StoragePort` interface is unchanged by this spec.

### Key Entities *(include if feature involves data)*

This spec introduces no new domain entity or value object; it makes the
existing `StoragePort` surface (Session, Exercise, BodyMeasurement,
LoggingDraft, band labels, schema version — all finalized by spec 002 and
spec 001) durable on real storage. See `docs/requirements.md` §3 and
`specs/002-domain-and-ports/data-model.md` for their definitions, which
this spec does not change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can log a full session, close the app completely,
  reopen it, and find every set exactly as logged — 100% of fields
  preserved, on both supported storage mechanisms.
- **SC-002**: A person mid-workout who has the app closed unexpectedly
  (lock screen, force-close, crash) loses zero already-confirmed sets when
  they reopen the app.
- **SC-003**: The same shared contract test suite passes unmodified
  against both storage mechanisms, for every `StoragePort` method — no
  adapter-specific test, skip, or behavioral exception exists anywhere in
  the suite.
- **SC-004**: An out-of-date app never writes to a newer-schema store — 0
  silent overwrites or corruptions across the migrate/open/refuse test
  matrix.

## Assumptions

- The app's "current schema version" is fixed by this spec at 1 (FR-007a)
  — the first real version number either adapter writes. This spec proves
  the migrate/open/refuse mechanism using that baseline, not a specific
  future migration; a later schema change bumps this number under
  `docs/requirements.md` §6's own rule ("any change to the persisted
  schema bumps the version and ships with its ADR and a tested
  migration"), not this spec.
- "Contract test suite" reuses and extends the Given/When/Then scenarios
  already written for the in-memory fake in `specs/002-domain-and-ports/`
  rather than starting a parallel test vocabulary from scratch.
- Feature detection for File System Access follows the standard
  capability check (presence of the relevant API on `window`), not
  user-agent sniffing, consistent with `docs/requirements.md` §7.5's
  "platform-gated capabilities... requested inside a user gesture;
  background code checks permission and never prompts."
- The `InMemoryStorageAdapter` (`src/infrastructure/in-memory-storage-adapter.ts`)
  remains in the codebase after this spec, unchanged, as the test-only
  fake ADR-0002 names as the third implementation — this spec does not
  remove it.
