# Feature Specification: Settings, Export and Import

**Feature Branch**: `006-settings-data`

**Created**: 2026-09-12

**Status**: Reviewed

**Input**: User description: "Settings, export and import (FR-11, FR-12) —
v1, Phase 6 per docs/agent-brief.md §3. Build the Settings screen (default
unit kg/lb, quick increments, theme light/dark/system, first day of week,
band catalogue management, and a Data section with export, import, and
delete-everything with double confirmation) and the export/import mechanism
itself: export all data to an open, self-describing, versioned interchange
file (documented format, no opaque internal identifiers wherever a readable
form exists) plus an additional tabular export for spreadsheets; import a
previously exported file with a preview of what will be added or replaced
before anything is applied, and reject with a clear message — writing
nothing — any file whose schema version is newer than the app understands.
This is the mechanism that lets a user move their data to another device by
file (not live multi-device sync, which stays out of scope per
docs/requirements.md §9). Ground the spec in docs/requirements.md FR-11,
FR-12, and §6 (Data and schema), and in the schema-version migrate/open/
refuse behavior already implemented in specs/003-persistence (current
schema version 1) — this feature must not change that behavior, only add
the export/import surface on top of it and define the interchange format's
own versioning and the import merge policy (what happens when an imported
record's ID already exists locally: replace, skip, or offer a choice in the
preview)."

## Context *(mandatory)*

Every other v1 feature (FR-1 to FR-9) assumes the user's data lives and
stays on one device. `specs/003-persistence` already gives that single
device a durable schema version and a migrate/open/refuse behavior across
app updates, but there is still no way to get data *off* a device — for a
backup, a phone replacement, or moving between two installs (desktop and
mobile) of the same app. This spec closes that gap (`docs/requirements.md`
FR-11, FR-12; `docs/agent-brief.md` "Phase 6 — Settings, data, closing")
by adding a Settings screen (unit, increments, theme, first day of week,
band catalogue management) and a Data section on it that exports all
canonical data to a documented, versioned file and imports it back,
including into a different, empty or non-empty, installation. It builds on
the existing `StoragePort` and schema-version mechanism without changing
either — the interchange file carries its own copy of that same schema
version number and is migrated with the same rules before anything is
merged into local storage. This is manual, file-based, one-shot transfer;
continuous multi-device sync is explicitly future work
(`docs/requirements.md` §9) and is not attempted here.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Export all data to move to another device or back it up (Priority: P1)

A user who is about to switch phones, reinstall the app, or just wants a
safety copy opens Settings → Data → Export, and gets a single file
containing every session, the exercise catalogue, band labels, their
settings, and their pending logging draft if they left one unsubmitted,
tagged with the schema version it was written at. They can also get a
spreadsheet-friendly export of their session/set history for their own
analysis outside the app.

**Why this priority**: without export, nothing else in this spec has
anything to work with — it is the foundation both for import (User Story 2)
and for the user's own peace of mind that their data is not trapped on one
device.

**Independent Test**: on a device with existing sessions and a customized
catalogue, trigger export, and confirm the resulting file opens/parses as a
single self-contained, versioned record of that data, independent of
whether import (User Story 2) exists yet.

**Acceptance Scenarios**:

1. **Given** a device with logged sessions, a customized exercise
   catalogue, band labels, settings, and a pending logging draft,
   **When** the user exports their data, **Then** they receive one file
   containing all of it, carrying the current schema version, readable
   without needing the app's internal storage format.
2. **Given** the same device, **When** the user also requests the tabular
   export, **Then** they receive a spreadsheet-friendly file listing their
   session/set history in a form a spreadsheet application can open
   directly.
3. **Given** a brand-new install with no sessions, no custom catalogue
   entries, and no settings changed yet — never truly "empty," since D9/
   ADR-0005 guarantees the seed exercise catalogue is present from first
   launch — **When** the user exports, **Then** they receive a valid,
   schema-versioned file describing that seed-only, no-history state, not
   an error.

---

### User Story 2 - Import a previously exported file (Priority: P1)

A user setting up a new device, or restoring after reinstalling, opens
Settings → Data → Import, picks a file produced by User Story 1 (from this
device or another one running the same app), sees a preview of exactly what
will be added and what will be replaced, and confirms before anything
changes.

**Why this priority**: paired with User Story 1, this is the actual
"migration between devices" the user needs — export alone only produces a
file, import is what makes the data usable again. Both are P1 because
neither delivers the underlying value (moving data between devices) alone.

**Independent Test**: take a file produced by User Story 1 on one
(real or simulated) device, import it into a second, independent
installation, and confirm the imported data matches the source after
confirming the preview — independent of the Settings screen's other
fields (User Story 3). Sessions, band labels, settings and the draft
should match exactly; the exercise catalogue matches for every
user-added/edited entry, but the two installations' own independently
seeded entries are expected to show up as additions rather than a clean
match (Assumptions: seed IDs are not deterministic across installs) — the
test should confirm that specific, documented outcome, not a byte-for-byte
catalogue match.

**Acceptance Scenarios**:

1. **Given** a valid export file at the app's current schema version,
   **When** the user selects it for import, **Then** they see a preview
   stating how many records will be added and how many existing records
   (matched by identity) will be replaced, before anything is written.
2. **Given** that preview, **When** the user confirms, **Then** the
   described additions and replacements are applied atomically and the
   user sees a confirmation; **When** the user cancels instead, **Then**
   nothing changes.
3. **Given** an export file at a schema version older than the app's
   current version, **When** the user imports it, **Then** the app
   migrates the file's data to the current schema version in memory only
   — the same migration logic `specs/003-persistence` already applies to
   a device's own stored data on open, but applied here to the file's data
   without writing anything locally — before computing the preview; if the
   user then confirms, the migration having happened is recorded as part
   of that same atomic write (FR-011), alongside the imported data itself;
   if the user cancels, nothing is written and nothing is recorded, exactly
   as if the file had never been opened.
4. **Given** a file whose schema version is newer than the app
   understands, **When** the user selects it for import, **Then** the app
   rejects it with a clear, actionable message and writes nothing —
   partial reads never happen.
5. **Given** a file that is not a valid export (wrong format, corrupted,
   unrelated file), **When** the user selects it, **Then** the app rejects
   it with a clear message before any preview is shown, and writes
   nothing.

---

### User Story 3 - Adjust personal settings (Priority: P2)

A user opens Settings and changes their default unit (kg/lb), quick
increments, theme (light/dark/system) or first day of the week, and sees
those choices take effect immediately and persist across restarts.

**Why this priority**: real quality-of-life value, and independent of the
Data section entirely, but lower priority than getting data on and off a
device at all (User Stories 1-2).

**Independent Test**: change each setting in isolation, restart the app,
and confirm each choice persisted and is visibly in effect (unit shown on
logged loads, theme applied, the Insights consistency card's week count
following the chosen first day of the week, quick increments offered while
logging).

**Acceptance Scenarios**:

1. **Given** the Settings screen, **When** the user changes the default
   unit, quick increments, theme, or first day of the week, **Then** the
   change applies immediately without restarting the app.
2. **Given** a changed setting, **When** the app is closed and reopened,
   **Then** the setting is still in effect.
3. **Given** the theme set to "system", **When** the operating system's
   light/dark preference changes, **Then** the app's theme follows it
   without the user opening the app's own settings again.
4. **Given** a first-day-of-week setting changed away from the ISO
   (Monday-start) default, **When** the Insights screen next computes its
   consistency card (`specs/005-insights` FR-010), **Then** the weeks it
   counts are bounded by the chosen day, not Monday (FR-018).

---

### User Story 4 - Manage the band label catalogue from Settings (Priority: P3)

A user opens Settings and reorders, renames, adds or removes their band
load labels from one place, instead of only in the middle of logging a set.

**Why this priority**: the band catalogue and its storage already exist
(`specs/001-log-a-session` FR-011); this story only adds a dedicated
management surface for it, so it is the smallest, most self-contained piece
of this spec.

**Independent Test**: from Settings alone (no active logging session), add,
rename, reorder and remove a band label, and confirm the change is
reflected the next time band labels are offered while logging a set.

**Acceptance Scenarios**:

1. **Given** existing band labels, **When** the user reorders them in
   Settings, **Then** the new order is what is offered next time while
   logging.
2. **Given** existing band labels, **When** the user renames or removes
   one, **Then** the change is reflected immediately everywhere band
   labels are shown, and existing logged sets that used a removed label
   keep showing their originally recorded label (renaming/removing the
   catalogue entry never rewrites history).

---

### User Story 5 - Delete everything (Priority: P4)

A user who wants to start over, or is handing off/retiring a device, opens
Settings → Data → Delete everything, is asked to confirm twice, and ends up
in the same state as a fresh install.

**Why this priority**: destructive and irreversible, useful but rare, and
strictly lower priority than being able to get data out safely first
(User Story 1) — a user should always be able to export before they ever
reach for this.

**Independent Test**: with existing data, trigger delete-everything, pass
both confirmations, and confirm every session, custom catalogue entry, band
label, setting and pending draft is gone, the exercise catalogue is back to
just the seed set, and the app otherwise behaves like a fresh install.

**Acceptance Scenarios**:

1. **Given** existing data, **When** the user chooses delete-everything,
   **Then** they must confirm twice, with the second confirmation stating
   plainly that the action is irreversible, before anything is deleted.
2. **Given** both confirmations given, **When** the deletion completes,
   **Then** every session, every user-added or user-modified exercise
   catalogue entry, every band label, every setting and the pending
   logging draft (if one existed) are all gone, the exercise catalogue is
   restored to the seed set (`docs/requirements.md` D9, ADR-0005) exactly
   as a fresh install's is, and the schema version marker itself is reset
   the same way a fresh install's is.
3. **Given** the first confirmation only, **When** the user backs out
   instead of giving the second confirmation, **Then** nothing is deleted.

---

### Edge Cases

- What happens when an import file's schema version matches the app's
  current version, but the file's own internal structure fails validation
  (a required field missing, a value out of the domain's valid range)? →
  Rejected the same way as an unparseable file (User Story 2, Scenario 5):
  a clear message, nothing written, no partial import.
- What happens if the app is closed or the device loses power mid-import,
  after the preview was confirmed? → On next launch, the app's own
  recoverable-writes rule (`docs/requirements.md` §6) applies: it
  reconciles from the source of truth exactly as it does after any other
  interrupted write, so the user never ends up with half an import applied
  as if it fully succeeded.
- What happens when the same export file is imported twice in a row? → The
  second import is idempotent: every record in the file already matches an
  existing local record by identity, so the preview shows zero additions
  and every record as a replacement with unchanged content.
- What happens when the imported file carries a pending logging draft
  (`specs/001-log-a-session` FR-024) and the device already has one of its
  own? → The draft is a singleton, like Settings and the band-label list
  (see Assumptions): the imported draft, if present in the file, replaces
  the local one when the user confirms; the preview states this plainly
  ("your in-progress, unsubmitted entry will be replaced") rather than
  silently merging the two or leaving the local draft untouched.
- What happens if delete-everything is used and the user then tries to
  import a previously exported file? → Sessions, band labels, settings and
  the logging draft behave exactly like importing into any fresh install:
  every one in the file is added, since nothing local remains to match
  against. The exercise catalogue is the one exception: delete-everything
  leaves the seed set in place (FR-016), and — per the seed-ID limitation
  above — the file's own seed entries typically carry different IDs than
  this device's freshly-reseeded ones, so they are added alongside the
  local seed set rather than matching it, the same duplicate-seed outcome
  as importing onto any other already-seeded device.

## Non-Goals *(mandatory)*

- **Continuous or automatic multi-device sync.** This spec is manual,
  file-based, one-shot export and import — not a live sync mechanism.
  `docs/requirements.md` §9 keeps that explicitly for later, pending its
  own recorded decision.
- **Selective/partial import.** v1 imports a file exactly as shown in its
  preview (every record either added or replaced); choosing individual
  records to include or exclude is not supported.
- **Importing data from another application.** The interchange format
  documented here is this app's own; reading a competing app's export
  format is explicitly future work (`docs/requirements.md` §9, "import
  from other apps").
- **A new schema version for adding Settings itself.** The constitution's
  schema-version-bump rule (Principle III) is scoped to "any new persisted
  field on a canonical entity" (`docs/requirements.md` §3.1: Session,
  Exercise, Set). Settings is not a field on any of those — it is new,
  additive, preference-shaped state, the same category as the band-label
  list and the logging draft, neither of which triggered a bump when they
  were added (`specs/001-log-a-session/research.md` §7). On that same
  precedent, adding Settings (and exporting/importing the logging draft,
  User Story 1-2) does not itself require a version bump — the current
  version stays 1 for that reason specifically, not by assumption. This
  spec's `schema-guardian` review (Assumptions) confirmed the claim sound
  against Principle III's literal wording, while flagging that
  `docs/requirements.md` §6's own, broader wording ("any change to the
  persisted schema bumps the version") is not identically scoped —
  Principle III governs here per the same precedent already accepted for
  band labels and the logging draft, but the two documents' wording is
  not reconciled, and any future spec relying on this precedent again
  should address §6 explicitly, not just Principle III.
- **Body measurements in the export.** Body composition tracking was
  removed from scope entirely (Decision D10); there is nothing of that
  kind to export or import.
- **Account-based backup (cloud storage, email-yourself, etc.).** Export
  produces a file the user is responsible for moving and keeping; where
  that file ends up is the user's choice, not this feature's concern.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a Settings screen where the user can
  view and change: default unit (kg/lb), quick increments, theme
  (light/dark/system), and first day of the week.
- **FR-002**: Every setting change MUST apply immediately and persist
  durably across an app restart.
- **FR-003**: When the theme is set to "system", the system MUST follow
  the operating system's light/dark preference and MUST update
  automatically if that preference changes while the app is open.
- **FR-004**: The Settings screen MUST provide a dedicated surface to add,
  rename, reorder and remove band load labels, using the same underlying
  band-label list already used while logging a set
  (`specs/001-log-a-session` FR-011).
- **FR-005**: Removing or renaming a band label from Settings MUST NOT
  alter the label text already recorded on existing logged sets.
- **FR-006**: The system MUST provide a Data section on the Settings
  screen offering export, import, and delete-everything.
- **FR-007**: Export MUST produce one file containing every canonical
  record the app stores (sessions, exercise catalogue) plus the app's
  non-canonical singleton state — band labels, settings, and the pending
  logging draft if one exists (`specs/001-log-a-session` FR-024) — in an
  open, documented, versioned format, carrying the schema version the data
  was exported at.
- **FR-008**: The exported file's content MUST be readable without the
  app's internal storage format, and MUST reference records by a readable
  form (e.g., an exercise's name) wherever one exists, rather than by an
  opaque internal identifier alone.
- **FR-009**: The system MUST also offer a separate tabular export of
  session/set history, in a form a general-purpose spreadsheet application
  can open directly, for the user's own analysis outside the app; this
  tabular form is one-way (export only, not a supported import source).
- **FR-010**: Import MUST accept a file produced by FR-007 and, before
  changing anything, MUST show the user a preview stating how many records
  will be added (no matching local record) and how many will be replaced
  (a local record with matching identity already exists), broken down by
  record kind (sessions, catalogue entries, band labels, settings, the
  logging draft). Matching is by stable identifier for Sessions and
  Exercise catalogue entries; the band-label list, Settings, and the
  logging draft are each a single record on a device (Assumptions), so for
  those three kinds the preview instead states whether the file carries
  one at all and, if so, that it replaces the device's own (or is added,
  if the device has none).
- **FR-011**: Import MUST apply nothing until the user explicitly confirms
  the preview, and applies the previewed additions and replacements
  atomically: either every one of them, across every record kind, is
  applied, or, if the operation is interrupted, none of them is left
  half-applied (`docs/requirements.md` §6 recoverable-writes rule). This
  requires a single atomic, multi-record write operation at the storage
  layer: `StoragePort`'s existing per-kind methods
  (`specs/002-domain-and-ports`) each individually persist durably, but
  `specs/003-persistence` guarantees atomicity only within one such call,
  not across several — confirmed import (and delete-everything, FR-016)
  both need a new bulk/transactional write capability that does not exist
  on the port today; adding it is this feature's own dependency, to be
  designed at `/speckit-plan`, not assumed to already exist.
- **FR-012**: When an import file's schema version is older than the
  app's current schema version, the system MUST migrate the file's data to
  the current schema version — using the same migration logic
  `specs/003-persistence` already applies on a normal open, but applied
  in memory to the file's data only, writing nothing locally — before
  computing the preview. The fact that a migration happened MUST be
  recorded only as part of the confirmed atomic import (FR-011); a
  cancelled import MUST leave no trace that the file was ever opened or
  migrated.
- **FR-013**: When an import file's schema version is newer than the
  app's current schema version, the system MUST reject the file with a
  clear, actionable message and MUST NOT write anything, and MUST NOT read
  the file partially — the same refuse behavior FR-010 in
  `specs/003-persistence` already applies to a device's own stored data.
- **FR-014**: When a selected file fails to parse as a valid export (wrong
  format, corrupted, unrelated file, or fails structural validation at a
  schema version the app does understand), the system MUST reject it with
  a clear message before showing any preview, and MUST NOT write anything.
- **FR-015**: Delete-everything MUST require two explicit confirmations
  in sequence, the second one stating plainly that the action is
  irreversible, before deleting anything; declining either confirmation
  MUST leave all data unchanged.
- **FR-016**: Once both confirmations are given, delete-everything MUST,
  atomically (FR-011's dependency), remove every session, every band
  label, every setting and the pending logging draft if one exists, and
  MUST reset the exercise catalogue to exactly the seed set
  (`docs/requirements.md` D9, ADR-0005) — not to empty. The reseeding
  write is itself the device's next "first real write" in
  `specs/003-persistence` FR-007a's sense, so "reset the schema-version
  marker" means this same atomic operation ends with the marker at the
  app's current schema version — the same constant a genuinely fresh
  install's own first-run seed write already sets it to (D9/ADR-0005: the
  seed catalogue is written at install/first run, before a user does
  anything observable) — never a hardcoded version literal that could go
  stale after a future schema bump.
- **FR-017**: This feature MUST NOT alter the existing schema-version
  migrate/open/refuse behavior for a device's own local storage
  (`specs/003-persistence`); it only adds the export/import surface and
  the interchange file's own versioning and validation on top of it.
- **FR-018**: Once this feature ships a first-day-of-week setting, the
  Insights consistency computation (`specs/005-insights` FR-010) MUST use
  it as the week-boundary convention, replacing that spec's provisional
  ISO (Monday-start) default — closing the dependency `specs/005-insights`
  FR-010 explicitly left for this spec to resolve.
- **FR-019**: This feature's screens (Settings, the export/import flow,
  delete-everything's confirmations) MUST pass the accessibility audit
  `docs/requirements.md` §7.4 requires, and `docs/agent-brief.md`'s Phase 6
  names as part of closing this phase — not deferred to a later pass.
- **FR-020**: `docs/requirements.md` §7.1 sets no numeric target for
  export, import or delete-everything specifically (its targets cover
  launch, logging interactions, and search/insight recomputation) — but
  `docs/agent-brief.md`'s Phase 6 still names "performance measured
  against §7.1, before and after any optimisation" as part of closing this
  phase. The system MUST have a recorded, repeatable measurement of each
  operation's duration against a representative data set, taken both
  before and after any optimization made in response to it; this feature
  does not itself set a pass/fail number where §7.1 doesn't provide one —
  that is confirmed at `/speckit-plan` time, alongside whichever concrete
  representative data-set size is chosen.

### Key Entities *(include if feature involves data)*

- **Settings.** The user's own preferences: default unit, quick
  increments, theme, first day of the week. Not one of the canonical
  entities in `docs/requirements.md` §3.1 today — this spec is what
  introduces it as a stored, exportable record, alongside the existing
  band-label list (already stored, `specs/001-log-a-session` FR-011).
- **Export file (interchange record).** A single, self-contained,
  versioned snapshot of a device's canonical data (sessions, exercise
  catalogue) plus its non-canonical singleton state — band labels,
  settings, and the pending logging draft if one exists — at the moment it
  was produced, plus the schema version it was written at. Not a canonical
  entity itself — it is a point-in-time export of the canonical entities
  that already exist plus the non-canonical, per-device state
  (band labels, Settings, `specs/001-log-a-session` "Logging draft") that
  isn't part of §3.1 but that this spec (FR-007) requires exported anyway,
  per `docs/requirements.md` §6's "interchange format" language and §1.2's
  "everything exportable" invariant.
- **Import preview.** A computed, transient comparison between an export
  file's records and the device's current local records, grouped into
  "to add" and "to replace" by record kind. Never persisted — recomputed
  each time a file is selected, discarded once the import is confirmed or
  cancelled.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can export all of their data and, on a second,
  independent installation, recover 100% of their sessions, catalogue
  entries, band labels, settings and pending logging draft (if any)
  through import, with no manual re-entry.
- **SC-002**: Selecting an incompatible file (too-new schema, corrupted,
  or unrelated) for import always results in a clear rejection message and
  zero changes to local data — verified across every rejection path
  (User Story 2, Scenarios 4-5; Edge Cases).
- **SC-003**: Every setting change applies immediately, with no restart
  needed, and is verifiable on whichever screen actually shows its effect
  — unit and quick increments while logging a set, theme and first day of
  week wherever they're rendered, first day of week specifically in the
  Insights consistency card (FR-018) — not all from the Settings screen
  itself, since most of these settings have no effect visible there.
- **SC-004**: Users can reach the point of irreversible data deletion only
  after two distinct, deliberate confirmations — zero cases of accidental
  full deletion from a single tap or click.
- **SC-005**: An import of a file exported from the same device is fully
  idempotent: importing it a second time changes no visible data.
- **SC-006**: This feature's screens pass the `docs/requirements.md` §7.4
  accessibility audit with zero unresolved critical findings before Phase
  6 (`docs/agent-brief.md`) is considered closed.
- **SC-007**: Export, import and delete-everything each have a recorded,
  repeatable performance measurement against a representative data set,
  taken both before and after any optimization — closing
  `docs/agent-brief.md`'s Phase 6 performance-measurement requirement even
  though `docs/requirements.md` §7.1 sets no number specific to these
  three operations (FR-020).

## Assumptions

- **Import identity matching.** FR-12's own wording ("preview of what will
  be added or replaced") is the merge policy: an imported record whose
  identity already exists locally is replaced by the imported version
  (the file "wins" for that record); a record with no local match is
  added; nothing is ever silently skipped or dropped. Per-record,
  user-chosen conflict resolution is deferred (see Non-Goals) as a
  reasonable default — v1's whole point is getting a user's data onto a
  new or empty device, where conflicts are the exception rather than the
  norm, not reconciling two actively-diverging histories.
- **"Identity" for matching applies only to Sessions and Exercise
  catalogue entries** — each has its own stable identifier already
  (the same identifier used within a single device for
  renaming-without-breaking-history, merges, etc. — `docs/requirements.md`
  §3.3), and that identifier is what FR-010's add-vs-replace comparison
  matches on for those two kinds. It does **not** apply to band labels,
  Settings, or the logging draft: band labels are one ordered list with no
  per-label identifier (`specs/001-log-a-session` FR-011), and Settings
  and the logging draft are each a single record per device, not a
  collection. For those three, FR-010's preview instead reports
  whole-record presence and replacement (Edge Cases), never per-item
  matching.
- **Settings, and the exported logging draft, are per-device state, not
  part of the schema-version-bump conversation for canonical entities.**
  Adding the Settings record, and including the logging draft in the
  interchange file, are new, additive, non-canonical concerns — not a
  reshape of an existing canonical entity (Session, Exercise, Set) — on
  the same footing as the already-shipped band-label list and the logging
  draft itself (Non-Goals; `specs/001-log-a-session/research.md` §7). This
  spec's own claim that no version bump is needed was reviewed and
  confirmed sound by `schema-guardian` against Principle III's literal
  scope (Non-Goals) — settled for this spec, though the reconciliation
  with `docs/requirements.md` §6's broader wording that review flagged is
  not, and is left for whichever future spec next relies on this
  precedent to address explicitly.
- **Seed exercise IDs are not deterministic across installs.** Catalogue
  entry IDs are generated with `crypto.randomUUID()` per install
  (`specs/001-log-a-session/research.md` §2), including for the seed set
  (D9, ADR-0005) — two independent installs' seed entries for, say, "Back
  Squat" do not share an ID. Importing between two already-seeded,
  independent installs (as opposed to importing into a fresh or emptied
  one, User Story 2's primary case) will therefore show each source-device
  seed entry as an addition rather than a match, and can leave a device
  with duplicate-looking catalogue entries for what was originally the
  same seed exercise. This is a known, accepted v1 limitation, not a bug
  to fix here: the user can resolve any resulting duplicates with the
  exercise catalogue's existing merge capability
  (`specs/002-domain-and-ports` FR-012); making seed IDs deterministic
  across installs instead is a larger change (ADR-0005's own generation
  strategy) out of this spec's scope.
- **Tabular export has no corresponding import.** FR-12's spreadsheet
  export exists for the user's own external analysis, not as a second
  interchange format to round-trip through.
- **Where the exported file goes is the user's responsibility.** The
  system produces and consumes a file via the platform's normal file
  picker/share mechanisms; it does not manage cloud storage, email, or any
  transport of that file between devices.
