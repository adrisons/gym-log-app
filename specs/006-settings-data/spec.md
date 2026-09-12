# Feature Specification: Settings, Export and Import

**Feature Branch**: `006-settings-data`

**Created**: 2026-09-12

**Status**: Draft

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
containing every session, the exercise catalogue, band labels and their
settings, tagged with the schema version it was written at. They can also
get a spreadsheet-friendly export of their session/set history for their
own analysis outside the app.

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
   catalogue, band labels and settings, **When** the user exports their
   data, **Then** they receive one file containing all of it, carrying the
   current schema version, readable without needing the app's internal
   storage format.
2. **Given** the same device, **When** the user also requests the tabular
   export, **Then** they receive a spreadsheet-friendly file listing their
   session/set history in a form a spreadsheet application can open
   directly.
3. **Given** a brand-new install with no data yet, **When** the user
   exports, **Then** they receive a valid, schema-versioned file describing
   an empty data set, not an error.

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
fields (User Story 3).

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
   migrates the file's data to the current schema version — the same rule
   `specs/003-persistence` already applies to a device's own stored data on
   open — before computing the preview, and the migration is recorded the
   same way a normal open-time migration is.
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
logged loads, theme applied, week view starting on the chosen day, quick
increments offered while logging).

**Acceptance Scenarios**:

1. **Given** the Settings screen, **When** the user changes the default
   unit, quick increments, theme, or first day of the week, **Then** the
   change applies immediately without restarting the app.
2. **Given** a changed setting, **When** the app is closed and reopened,
   **Then** the setting is still in effect.
3. **Given** the theme set to "system", **When** the operating system's
   light/dark preference changes, **Then** the app's theme follows it
   without the user opening the app's own settings again.

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
with a completely empty install.

**Why this priority**: destructive and irreversible, useful but rare, and
strictly lower priority than being able to get data out safely first
(User Story 1) — a user should always be able to export before they ever
reach for this.

**Independent Test**: with existing data, trigger delete-everything, pass
both confirmations, and confirm every session, catalogue entry, band label
and setting is gone and the app behaves like a fresh install.

**Acceptance Scenarios**:

1. **Given** existing data, **When** the user chooses delete-everything,
   **Then** they must confirm twice, with the second confirmation stating
   plainly that the action is irreversible, before anything is deleted.
2. **Given** both confirmations given, **When** the deletion completes,
   **Then** sessions, the exercise catalogue (including the seed set),
   band labels and settings are all gone, and the schema version marker
   itself is reset the same way a fresh install's is.
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
- What happens to the pending logging draft (`specs/001-log-a-session`
  FR-024) during an import? → It is unaffected; import only touches
  canonical records (sessions, catalogue, band labels, settings), never
  the in-progress draft.
- What happens if delete-everything is used and the user then tries to
  import a previously exported file? → Works exactly like importing into
  any fresh install: every record in the file is added, since nothing
  local remains to match against.

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
- **A new schema version.** This feature adds an export/import surface on
  top of the existing schema-version mechanism (`specs/003-persistence`);
  it does not itself change what is stored or bump the current version
  (still 1).
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
  record the app stores (sessions, exercise catalogue, band labels,
  settings), in an open, documented, versioned format, carrying the
  schema version the data was exported at.
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
  record kind (sessions, catalogue entries, band labels, settings).
- **FR-011**: Import MUST apply nothing until the user explicitly confirms
  the preview, and applies the previewed additions and replacements
  atomically: either every one of them is applied, or, if the operation is
  interrupted, none of them is left half-applied (`docs/requirements.md`
  §6 recoverable-writes rule).
- **FR-012**: When an import file's schema version is older than the
  app's current schema version, the system MUST migrate the file's data to
  the current schema version — using the same migration logic
  `specs/003-persistence` already applies on a normal open — before
  computing the preview, and MUST record that this migration happened.
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
- **FR-016**: Once both confirmations are given, delete-everything MUST
  remove every session, every exercise catalogue entry (including the
  seed set — `docs/requirements.md` D9), every band label and every
  setting, and MUST reset the device to the same state a fresh install
  starts from, including its schema-version marker.
- **FR-017**: This feature MUST NOT alter the existing schema-version
  migrate/open/refuse behavior for a device's own local storage
  (`specs/003-persistence`); it only adds the export/import surface and
  the interchange file's own versioning and validation on top of it.

### Key Entities *(include if feature involves data)*

- **Settings.** The user's own preferences: default unit, quick
  increments, theme, first day of the week. Not one of the canonical
  entities in `docs/requirements.md` §3.1 today — this spec is what
  introduces it as a stored, exportable record, alongside the existing
  band-label list (already stored, `specs/001-log-a-session` FR-011).
- **Export file (interchange record).** A single, self-contained,
  versioned snapshot of a device's canonical data (sessions, exercise
  catalogue, band labels, settings) at the moment it was produced, plus
  the schema version it was written at. Not a canonical entity itself —
  it is a point-in-time export of the canonical entities that already
  exist, per `docs/requirements.md` §6's "interchange format" language.
- **Import preview.** A computed, transient comparison between an export
  file's records and the device's current local records, grouped into
  "to add" and "to replace" by record kind. Never persisted — recomputed
  each time a file is selected, discarded once the import is confirmed or
  cancelled.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can export all of their data and, on a second,
  independent installation, recover 100% of their sessions, catalogue
  entries and band labels through import, with no manual re-entry.
- **SC-002**: Selecting an incompatible file (too-new schema, corrupted,
  or unrelated) for import always results in a clear rejection message and
  zero changes to local data — verified across every rejection path
  (User Story 2, Scenarios 4-5; Edge Cases).
- **SC-003**: Every setting change is visible in the app's behavior
  (unit shown, theme applied, week start, quick increments offered)
  without the user needing to leave the Settings screen to confirm it took
  effect.
- **SC-004**: Users can reach the point of irreversible data deletion only
  after two distinct, deliberate confirmations — zero cases of accidental
  full deletion from a single tap or click.
- **SC-005**: An import of a file exported from the same device is fully
  idempotent: importing it a second time changes no visible data.

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
- **"Identity" for matching** means each canonical record's own stable
  identifier (the same identifier already used within a single device for
  renaming-without-breaking-history, merges, etc. — `docs/requirements.md`
  §3.3) — not a fuzzy or content-based match.
- **Settings are per-device, not part of the schema-version-bump
  conversation for existing entities.** Adding the Settings record is new
  stored data, not a reshape of an existing canonical entity — the exact
  persisted shape and whether it needs its own schema consideration is
  confirmed at `/speckit-plan` time, alongside `schema-guardian` review.
- **Tabular export has no corresponding import.** FR-12's spreadsheet
  export exists for the user's own external analysis, not as a second
  interchange format to round-trip through.
- **Where the exported file goes is the user's responsibility.** The
  system produces and consumes a file via the platform's normal file
  picker/share mechanisms; it does not manage cloud storage, email, or any
  transport of that file between devices.
