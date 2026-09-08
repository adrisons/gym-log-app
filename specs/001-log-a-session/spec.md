# Feature Specification: Log a Session (FR-1 to FR-5)

**Feature Branch**: `001-log-a-session`

**Created**: 2026-09-08

**Status**: Draft

**Input**: User description: "The logging critical path from docs/requirements.md: FR-1 (log a session), FR-2 (blocks), FR-3 (sets and load), FR-4 (effort), FR-5 (exercise catalogue). This is the smallest complete, independently valuable slice of behavior, and the first spec in the build order set by docs/agent-brief.md."

## Clarifications

### Session 2026-09-08

- Q: D4 — What is the default unit for Weight loads? → A: kg by default; the unit is stored exactly as entered and converted only for display (never in storage).
- Q: D6 — Are multiple sessions per calendar day allowed? → A: Yes — a user can start a second, fully independent session on the same day (FR-021).
- Q: If a session is still open when midnight passes, does it stay "today's" session for FR-001's auto-resume, or does a new session start at the new calendar date? → A: A session's date is fixed at creation; FR-001 resumes it as long as it's unfinished, regardless of the current calendar date.
- Q: When a user deletes a set and immediately backgrounds or closes the app while the 5-second undo window is still open, does the deletion finalize, or does closing cancel it? → A: The deletion finalizes — undo is a time-boxed reversal of an already-applied change, not a delayed commit; closing the app does not cancel it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Log a set between reps (Priority: P1)

A user is standing in the gym, mid-workout, one hand free. They open the app,
land on today's session (new or already in progress), add or pick an
exercise, and record a set — its load and how many reps (or how long, or how
far) — in a few taps, with no save step and no waiting.

**Why this priority**: this is the app's entire reason to exist (mission
statement, `docs/requirements.md` §1.1) and invariant 2 (logging always
works). Every other feature is secondary to this working perfectly.

**Independent Test**: with no other feature built, a user can open the app,
add an exercise, add a set with a load and a rep count, and see it recorded
instantly, surviving an app close/reopen. Delivers the app's core value on
its own.

**Acceptance Scenarios**:

1. **Given** the user has no session open today, **When** they open the app,
   **Then** a new session for today is created in a single tap and is ready
   to accept blocks and exercises.
2. **Given** the user already has an unfinished session from today,
   **When** they open the app, **Then** that session is resumed automatically
   — no picker, no "continue?" dialog.
2a. **Given** the user has an unfinished session that started yesterday (e.g.
    began at 11:40pm and is still open after midnight), **When** they open
    the app, **Then** that same session is resumed — a session's date is
    fixed at creation and does not split at midnight.
3. **Given** the user is adding an exercise, **When** they open the exercise
   field, **Then** they see their most-used and most-recently-used exercises
   first, and can create a brand-new exercise from the same field.
4. **Given** an exercise already has at least one set in the current session,
   **When** the user adds another set to it, **Then** the new set is
   pre-filled with the previous set's load and volume, so confirming it is
   one tap.
5. **Given** the user just recorded a set, **When** the set is saved,
   **Then** there is no visible "Save" control anywhere on the screen — the
   set appears recorded the instant it is confirmed.
6. **Given** the user closes the app (backgrounds it, loses connectivity, the
   OS kills it) immediately after entering a set, **When** they reopen the
   app, **Then** that set is still there, unchanged.

---

### User Story 2 - Organize a session into blocks (Priority: P2)

A user structures their session into blocks — e.g. a straight-set block for
squats, then a superset block for two accessory exercises — naming some,
leaving others unnamed, and reordering exercises within and across blocks as
their plan changes mid-session.

**Why this priority**: blocks are the session's organizing structure (FR-2)
and are needed as soon as a session has more than one exercise, which is the
common case — but the app is still useful, if flatter, without this (P1
covers a single running list of sets).

**Independent Test**: with User Story 1 built, a user can create two blocks
in one session, name one of them, leave the other unnamed, add exercises to
each, and reorder an exercise from one block into the other — independently
verifiable by inspecting the session's block/exercise order afterward.

**Acceptance Scenarios**:

1. **Given** an open session, **When** the user creates a new block,
   **Then** it can optionally be named, and appears in the session in
   creation order.
2. **Given** a block with no name, **When** the user views the session,
   **Then** the block is shown by its position (e.g. "Block 2"), never as
   "Untitled".
3. **Given** a session with two blocks, **When** the user reorders an
   exercise from one block to another, **Then** the exercise moves with its
   already-recorded sets intact.
4. **Given** a block the user no longer wants, **When** they delete it,
   **Then** the deletion is undoable from the same screen for at least 5
   seconds before becoming permanent.

---

### User Story 3 - Record load and effort per set (Priority: P1)

A user records not just "a set happened" but what it consisted of: a load
(a weight, a resistance band, a bodyweight variant, or free text for a
machine setting) with either reps, a duration, or a distance, and optionally
how hard the set felt.

**Why this priority**: load and volume are what make a set meaningful data,
not just a tally — without them there is nothing to show progression on
later (FR-8) and nothing for insights (FR-9) to compute over. Tied with User
Story 1 as foundational; separated here only because it is testable as its
own slice once a set can be added at all.

**Independent Test**: with User Story 1 built, a user can set an exercise's
load type to each of Weight, Band, Bodyweight, and Free text in turn, record
a set for each, and read back the same load type and value — independently
verifiable per load type without needing blocks or effort.

**Acceptance Scenarios**:

1. **Given** an exercise with no load type chosen yet, **When** the user
   records its first set, **Then** they choose a load type (Weight, Band,
   Bodyweight, Free text, or None) and it is remembered as that exercise's
   default for future sets, overridable per set.
2. **Given** a numeric load or volume field, **When** the user taps it,
   **Then** a numeric keypad appears by default, with quick-increment
   controls (e.g. ± 2.5 kg).
3. **Given** a Band load, **When** the user picks one, **Then** it comes from
   their own reorderable list of band labels, not a fixed catalogue.
4. **Given** a Free text load, **When** the user types, **Then** entry is
   capped at 40 characters and autocompletes from values already used for
   that exercise.
5. **Given** a set with no effort recorded, **When** the session is viewed
   later, **Then** the set is valid and its load/volume are usable in every
   computation that does not require effort.
6. **Given** the user records effort, **When** they view the effort control,
   **Then** it always shows the scale's meaning in words, never a bare
   number, and settings allow entering it as RIR (converted to RPE on entry,
   per `docs/decisions/ADR-0003-effort-scale.md`).

---

### User Story 4 - Manage the exercise catalogue while logging (Priority: P2)

A user searches for an exercise by a name or alias they habitually use (e.g.
"hip thrust" for an exercise catalogued as "glute bridge"), finds it without
retyping the canonical name, and can create, rename, or merge catalogue
entries without leaving the logging flow.

**Why this priority**: without a forgiving catalogue, User Story 1 degrades
into retyping exact names every session — this is what makes fast logging
actually fast in practice, but the raw ability to log (P1) does not strictly
require it.

**Independent Test**: with User Story 1 built, a user can create an exercise,
give it an alias, search using only the alias, and get it as a top result —
independently verifiable without blocks, load types, or effort.

**Acceptance Scenarios**:

1. **Given** an exercise catalogue, **When** the user searches by name or
   alias, **Then** matching is case- and accent-insensitive and tolerant of
   typos and partial matches.
2. **Given** an exercise the user wants to rename, **When** they rename it,
   **Then** every past set referencing it still refers to the same exercise
   (renaming never breaks history, per `docs/requirements.md` §3.3).
3. **Given** two catalogue entries that turn out to be duplicates,
   **When** the user merges them, **Then** every set from both is reassigned
   to the surviving exercise, and the merged name becomes an alias of the
   survivor.
4. **Given** a catalogue exercise that has recorded history, **When** the
   user tries to delete it, **Then** the app asks for explicit confirmation
   and offers merging as an alternative.

### Edge Cases

- What happens when the user starts a set, then loses connectivity or the
  app is killed mid-entry? The set-in-progress may be lost, but every
  previously confirmed set MUST already be persisted (User Story 1, Scenario
  6) — there is no "unsaved session" to recover, because nothing waits to be
  saved.
- What happens when the user tries to log a set with neither load nor volume
  entered? It is not stored — a set needs at least one of the two, per
  `docs/requirements.md` §3.3.
- How does the app handle a user undoing a deleted set after the 5-second
  undo window has passed? The deletion is permanent; there is no further
  recovery.
- What happens if the user deletes a set and backgrounds or closes the app
  before the 5-second undo window elapses? The deletion has already been
  applied — undo is a time-boxed reversal of an applied change, not a
  delayed commit — so closing the app does not cancel it; the set stays
  deleted.
- What happens if the user records a set for an exercise whose load type was
  changed after that set was recorded? Past sets keep the load value and
  type they were recorded with; only new sets pick up the new default.
- What happens when the user creates a second, distinct session on the same
  calendar day? It is allowed — a fully independent second session, per
  FR-021 (confirmed decision D6).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST resume an unfinished session automatically on
  open — including one whose creation date is not today's calendar date,
  because a session's date is fixed at creation and does not roll over at
  midnight — and MUST create a new one in a single tap when none is
  unfinished.
- **FR-002**: The system MUST let the user add an exercise via a catalogue
  search that surfaces the most-used and most-recently-used exercises first,
  and MUST let the user create a new exercise from that same search field.
- **FR-003**: The system MUST persist every change (set added, block
  created, exercise added, etc.) automatically, with no explicit save
  action exposed anywhere in the logging flow.
- **FR-004**: The system MUST make every destructive action on the logging
  screen (deleting a set, an exercise entry, or a block) undoable for at
  least 5 seconds from the same screen before the undo option disappears.
  The underlying change is applied immediately (not held pending) so that
  closing or backgrounding the app during the window does not cancel it.
- **FR-005**: The system MUST NOT lose any change already confirmed by the
  user if the app is closed, backgrounded, or killed at any point.
- **FR-006**: The system MUST let the user create, rename, reorder, and
  delete blocks within a session, and reorder exercises within a block and
  across blocks.
- **FR-007**: The system MUST display an unnamed block by its position
  (e.g. "Block 2"), never as "Untitled" or blank.
- **FR-008**: The system MUST pre-fill a new set for an exercise with the
  previous set's load and volume for that same exercise, so confirming an
  identical set is a single tap.
- **FR-009**: The system MUST let the user choose a load type per exercise
  (Weight, Band, Bodyweight, Free text, or None), remember it as that
  exercise's default, and allow overriding it per individual set.
- **FR-010**: The system MUST present a numeric keypad by default on numeric
  load/volume fields, with configurable quick-increment controls.
- **FR-011**: The system MUST let the user maintain their own reorderable
  list of band labels for Band loads.
- **FR-012**: The system MUST cap Free text loads at 40 characters and
  autocomplete from values previously used for that same exercise.
- **FR-013**: The system MUST let the user record a set's effort with a
  one-tap control, MUST make recording it optional on every set, and MUST
  always present the scale's meaning in words alongside any numeric value.
- **FR-014**: The system MUST offer an RIR input mode in settings that
  converts to RPE on entry, storing only RPE as the canonical value (per
  `docs/decisions/ADR-0003-effort-scale.md`).
- **FR-015**: The system MUST support fully custom exercise names with no
  closed list, and MUST honor per-exercise aliases in search.
- **FR-016**: Exercise search MUST be case- and accent-insensitive and
  tolerant of typos and partial matches.
- **FR-017**: The system MUST let the user merge two catalogue exercises,
  reassigning every set from both to the surviving exercise and retaining
  the merged name as an alias.
- **FR-018**: The system MUST require explicit confirmation before deleting
  a catalogue exercise that has recorded history, and MUST offer merging as
  an alternative in that confirmation.
- **FR-019**: A set with neither load nor volume recorded MUST NOT be
  stored; a set with either one present MUST be stored (per
  `docs/requirements.md` §3.3).
- **FR-020**: Renaming a catalogue exercise MUST NOT change what any past
  set refers to — references are by identifier, never by name.
- **FR-021**: The system MUST allow more than one session per calendar day,
  each fully independent (confirmed decision D6).

### Key Entities *(include if feature involves data)*

- **Session**: a training day's record — a date, an ordered list of blocks,
  free-form notes, and optional overall feeling and duration. More than one
  per calendar day is permitted (see FR-021 / Assumptions).
- **Block**: an ordered grouping within a session — optional name, a type
  (straight sets / superset / circuit), and an ordered list of exercise
  entries.
- **Exercise entry**: a reference to a catalogue exercise plus its order
  within the block, its notes, and its sets.
- **Set**: one performed unit of work — a Volume (reps, duration, or
  distance), a Load (Weight, Band, Bodyweight, Free text, or None), an
  optional Effort, a kind (warm-up / working / to failure), and a completed
  flag.
- **Exercise (catalogue)**: a canonical name with aliases, an optional
  movement pattern and muscle groups, a default load type, and a unilateral
  flag. User-owned: creatable, renameable, mergeable.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can record a complete working set — from tapping "add
  set" to having it appear as recorded — in 3 taps or fewer, when repeating
  the previous set's load and volume.
- **SC-002**: A user can go from opening the app to a recorded set for a
  brand-new exercise (never logged before) in under 30 seconds.
- **SC-003**: No data entered and confirmed by the user is ever lost across
  an app close, background, or kill, in 100% of tested interruption points.
- **SC-004**: A user can search the exercise catalogue by a partial or
  misspelled name and find the intended exercise within the first 3 results,
  for catalogues of up to 500 exercises.
- **SC-005**: Every destructive action taken on the logging screen remains
  reversible for at least 5 seconds, verified for sets, exercise entries,
  and blocks alike.
- **SC-006**: A user who has never used the app before can complete their
  first full session (at least one block, one exercise, three sets) without
  external help or documentation.

## Assumptions

- **Default unit (D4)**: confirmed — kilograms are the default unit; the
  unit is stored exactly as entered and converted only for display, never
  in storage (see Clarifications).
- **Multiple sessions per day (D6)**: confirmed — allowed; a user may start
  a second, fully independent session on the same calendar day (FR-021, see
  Clarifications).
- **e1RM formula (D5)** and **session templates (D7, FR-13)** do not affect
  this feature slice (FR-1 to FR-5) and are left open for the specs that do
  depend on them (progression, FR-8, and templates, FR-13, respectively).
- **Exercise discipline (D8)**: out of scope here. Every exercise in this
  spec is implicitly the Strength discipline (`docs/requirements.md` §1.4);
  no user-facing discipline selection, and no non-Strength exercise
  behavior, is part of FR-1 to FR-5.
- The exercise catalogue, storage port, and session state already exist as
  concepts to build against (this is the first feature spec in the project;
  no prior implementation exists yet) — this spec describes required
  behavior, not remaining gaps in an existing system.
- Platform and storage mechanics are not user-facing requirements of this
  spec — they are technical choices made and confirmed in a later
  `/speckit-plan`, not here.
