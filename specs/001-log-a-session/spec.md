# Feature Specification: Log a Session (FR-1 to FR-5)

**Feature Branch**: `001-log-a-session`

**Created**: 2026-09-08 (regenerated 2026-09-09)

**Status**: Reviewed — passed spec-reviewer + /speckit-clarify; no plan.md/tasks.md yet

**Input**: User description: "The logging critical path from docs/requirements.md: FR-1 (log a session), FR-2 (blocks), FR-3 (sets and load), FR-4 (effort), FR-5 (exercise catalogue). Smallest complete, independently valuable slice; first spec in the build order in docs/agent-brief.md. Regenerated to fold in owner decisions of 2026-09-09: sessions have no open/closed lifecycle, effort is a 1–5 integer scale, a seed exercise catalogue ships, plus the merge/rename/block-delete/validation rules resolved in review."

## Context *(mandatory)*

This is the first feature of the app and the one the whole product exists
for: recording a set in the gym, one-handed, offline, with no Save button
and no waiting (`docs/requirements.md` §1.1, invariant 2). It covers FR-1
through FR-5 of `docs/requirements.md` — creating a session, organizing it
into blocks, recording each set's load and volume, rating effort, and
finding exercises in a forgiving catalogue. It is the smallest slice that is
independently valuable: with only this built, a user has a working training
diary, just without history views, search, progression, or insights (FR-6
onward). Nothing is implemented yet; this spec describes required behavior
against the domain model in `docs/requirements.md` §3 and the decisions in
`docs/decisions/` (notably ADR-0003 for the effort scale and ADR-0005 for
the seed catalogue).

## Clarifications

### Session 2026-09-08

- Q: D4 — default unit for Weight loads? → A: kg by default. (The
  store-as-entered / convert-only-for-display rule is inert in this slice,
  which is kg-only with no unit choice; only the "kg default" half applies
  here. The rest matters once Settings adds kg/lb, FR-11.)
- Q: D6 — multiple sessions per calendar day? → A: Yes — fully independent
  second session on the same day (FR-021). D6 was later extended (see
  2026-09-09) to also cover the absence of a session lifecycle; both halves
  are the same decision ID in `docs/requirements.md` §8.

### Session 2026-09-09

All of the following were confirmed with the project owner in the session
that regenerated this spec, and are reflected in `docs/requirements.md`
§3.1/§3.2/§8 (D3, D6, D9), the revised ADR-0003, and the new ADR-0005.

- Q: Does a session have an open/closed lifecycle, and does it auto-resume?
  → A: No. A session has no "unfinished" state. It is a dated record; its
  date-time is set to the moment the logging form is opened (user-editable)
  and never rolls over at midnight. There is no auto-resume of a previous
  session — starting a session always creates a new, independent one.
- Q: What happens to input if the user opens the logging form and leaves
  without submitting? → A: It is kept as a single pending draft — a state
  of the logging screen, not a persisted Session. There is one way to open
  the logging form and it always restores the pending draft if one exists;
  to start from scratch the user first discards the draft from the form.
  Discarding the draft discards its data. The draft must survive an app
  close/background even though it is not a Session.
- Q: Effort scale? → A: An integer 1–5 level (ADR-0003, revised), one tap,
  optional, always shown with its meaning in words. No RIR input mode.
- Q: Is there a kg/lb unit picker in this slice? → A: No. Weight loads are
  kg only here; the kg/lb setting belongs to Settings (FR-11), out of scope
  for this spec.
- Q: Does `Load: None` count as "load present" for the "neither load nor
  volume ⇒ not stored" rule (FR-019)? → A: No. A set is valid on a Volume
  alone; `None` is not a stored load value for that test. A set with
  `Load: None` and no Volume is not stored.
- Q: How is the survivor chosen when merging two exercises, and is merge
  reversible? → A: The user picks which of the two names is canonical, and
  that exercise IS the survivor: its name and its own defaults (load type,
  movement pattern, unilateral flag) are kept, with no field-by-field
  prompt. The other exercise contributes only its name (kept as an alias of
  the survivor) and its sets. Every set from both is reassigned to the
  survivor. Merge is irreversible and requires explicit confirmation — it is
  not covered by the 5-second undo.
- Q: What happens when a rename collides with an existing exercise's name or
  alias? → A: It is not rejected outright — the app detects the duplicate
  and offers to merge the two exercises. If the user declines the merge, the
  rename is cancelled (the exercise keeps its previous name); two exercises
  are never left sharing a name or alias.
- Q: What happens to the sets inside a block when the block is deleted? → A:
  Cascade — the block, its exercise entries, and their sets are removed
  together; the 5-second undo restores the whole block with its sets. A
  session with zero blocks is a valid state.
- Q: Are zero or negative numeric values valid for load and volume? → A:
  Load ≥ 0 (0 kg is valid — empty bar, bodyweight with no added load);
  Volume > 0. Quick-increment controls never drive a value negative, except
  the assisted side of the Bodyweight added-load component, which is
  negative by definition.
- Q: How is the signed Bodyweight added/assisted component bounded, given
  bodyweight itself is not recorded in this slice? → A: The component is
  capped to a fixed range of −300 kg to +300 kg. A component of exactly 0
  is treated as "no component" — it is not a distinct meaningful value.
- Q: What if the user double-taps the confirm control? → A: A short
  debounce (~1 second) ignores an identical second confirm; after that
  window a second identical set is created normally.
- Q: Two tabs / instances editing the same session at once? → A: Out of
  scope for this spec — a single active logging context is assumed.
  Concurrent contexts are a persistence-layer concern (build phase 2).
- Q: If the user confirms a set that is invalid per FR-019 (no volume, and
  Load is None or empty), what does "confirm" do? → A: Nothing is stored —
  the confirm action is a silent no-op (or the confirm control is
  unavailable) until the set has at least a volume or a non-None load.
- Q: Two overlapping 5-second undo windows — a set was individually deleted
  and is still within its own undo window when its block is deleted. What
  does the block-undo restore? → A: The block-undo restores the block to
  exactly the state it was in at the moment of block deletion — so a set
  that was already (pending-)deleted comes back still deleted, with whatever
  is left of its own undo window. The two timers are independent.
- Q: The user merges or deletes a catalogue exercise that has an exercise
  entry in the current unsubmitted draft. → A: The draft's exercise entry
  is rewritten in place: on merge it now points at the survivor; on delete
  (of an exercise with history, cascade-confirmed) the draft entry and its
  in-progress sets are removed too. The draft is not exempt from catalogue
  operations just because it is not yet a Session.
- Q: Does the pre-fill (FR-008) carry effort forward from the previous set?
  → A: No — deliberately. Pre-fill carries load and volume only; effort is
  re-entered (or left blank) on each set.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Start a session and log a set (Priority: P1)

A user is standing in the gym, mid-workout, one hand free. They open the
app, open the logging form (which starts a new session, or restores the
pending draft they left earlier), add or pick an exercise, and record a
set — its load and how many reps (or how long, or how far) — in a few taps,
with no save step and no waiting.

**Why this priority**: this is the app's entire reason to exist (mission
statement, `docs/requirements.md` §1.1) and invariant 2 (logging always
works). Every other feature is secondary to this working perfectly.

**Independent Test**: with no other feature built, a user can open the app,
start a session, add an exercise, add a set with a load and a rep count, and
see it recorded instantly, surviving an app close/reopen. Delivers the app's
core value on its own.

**Acceptance Scenarios**:

1. **Given** the user has no pending draft, **When** they open the logging
   form, **Then** a new session is created with a date-time of that moment
   (which they can edit) and is ready to accept blocks and exercises — no
   picker, no "continue?" dialog.
2. **Given** the user opened the logging form earlier, entered some data,
   and left without submitting, **When** they open the logging form again,
   **Then** their earlier input is restored as the pending draft — no data
   was lost by leaving — and this is the only thing that opening the form
   does when a draft exists (it does not start a competing new session).
3. **Given** a pending draft exists, **When** the user discards it from the
   logging form, **Then** the draft and all its data are gone and are not
   recoverable, and the next time the form is opened a fresh session starts.
4. **Given** the user already submitted a session earlier today, **When**
   they open the logging form again (with no pending draft), **Then** a
   second, fully independent session is created — the earlier one is
   untouched.
5. **Given** the user is adding an exercise, **When** they open the exercise
   field, **Then** they see their most-used and most-recently-used exercises
   first (seeded common exercises included on a fresh install), and can
   create a brand-new exercise from the same field.
6. **Given** an exercise already has at least one set in the current
   session, **When** the user adds another set to it, **Then** the new set
   is pre-filled with the previous set's load and volume (not its effort),
   so confirming it is one tap.
7. **Given** the user just recorded a set, **When** the set is saved,
   **Then** there is no visible "Save" control anywhere on the screen — the
   set appears recorded the instant it is confirmed.
8. **Given** the user closes the app (backgrounds it, loses connectivity,
   the OS kills it) immediately after entering a set, **When** they reopen
   the app, **Then** that set is still there, unchanged.
9. **Given** the user taps the confirm control twice in quick succession on
   a pre-filled set, **When** the second tap lands within ~1 second, **Then**
   only one set is recorded; a deliberate second identical set after that
   window records normally.

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
4. **Given** a block the user no longer wants — including one that still has
   exercises and recorded sets — **When** they delete it, **Then** the
   block, its exercise entries, and their sets are removed together, and the
   whole block (with its sets) is restorable from the same screen for at
   least 5 seconds before becoming permanent.
5. **Given** the user deletes the only block in a session, **When** the undo
   window passes, **Then** the session with zero blocks is a valid state —
   the user can add a new block to it at any time.

---

### User Story 3 - Record load and effort per set (Priority: P1)

A user records not just "a set happened" but what it consisted of: a load
(a weight, a resistance band, a bodyweight variant with an optional added or
assisted load, or free text for a machine setting) with either reps, a
duration, or a distance, and optionally how hard the set felt on a 1–5
scale.

**Why this priority**: load and volume are what make a set meaningful data,
not just a tally — without them there is nothing to show progression on
later (FR-8) and nothing for insights (FR-9) to compute over. Tied with User
Story 1 as foundational; separated here only because it is testable as its
own slice once a set can be added at all.

**Independent Test**: with User Story 1 built, a user can set an exercise's
load type to each of Weight, Band, Bodyweight, Free text, and None in turn,
record a set for each, and read back the same load type and value —
independently verifiable per load type without needing blocks or effort.

**Acceptance Scenarios**:

1. **Given** an exercise with no load type chosen yet, **When** the user
   records its first set, **Then** they choose a load type (Weight, Band,
   Bodyweight, Free text, or None) and it is remembered as that exercise's
   default for future sets, overridable per set.
2. **Given** a numeric load or volume field, **When** the user taps it,
   **Then** a numeric keypad appears by default, with quick-increment
   controls (e.g. ± 2.5 kg), and the controls never take the value below 0
   (0 kg is a valid load).
3. **Given** a Band load, **When** the user picks one, **Then** it comes
   from their own reorderable list of band labels, not a fixed catalogue.
4. **Given** a Free text load, **When** the user types, **Then** entry is
   capped at 40 characters and autocompletes from values already used for
   that exercise.
5. **Given** a Bodyweight load, **When** the user records the set, **Then**
   they may optionally add a signed added/assisted component (e.g. `+10 kg`
   added, `−20 kg` assisted) with its unit; the assisted side is negative
   by design, the value is capped to −300..+300 kg, and a component of
   exactly 0 means "no component".
6. **Given** a set with `Load: None` and a recorded Volume (e.g. a
   distance), **When** the set is confirmed, **Then** it is stored and
   valid — `None` does not block storage the way an empty load/volume pair
   does.
7. **Given** a set with no effort recorded, **When** the session is viewed
   later, **Then** the set is valid and its load/volume are usable in every
   computation that does not require effort.
8. **Given** the user records effort, **When** they view the effort control,
   **Then** it is a one-tap 1–5 scale that always shows the level's meaning
   in words, never a bare number (ADR-0003).

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

**Independent Test**: with User Story 1 built, a user can create an
exercise, give it an alias, search using only the alias, and get it as a top
result — independently verifiable without blocks, load types, or effort.

**Acceptance Scenarios**:

1. **Given** an exercise catalogue, **When** the user searches by name or
   alias, **Then** matching is case- and accent-insensitive and tolerant of
   typos and partial matches.
2. **Given** an exercise the user wants to rename, **When** they rename it
   to a name not used elsewhere, **Then** every past set referencing it
   still refers to the same exercise (renaming never breaks history, per
   `docs/requirements.md` §3.3).
3. **Given** the user renames an exercise to a name or alias already used by
   a different exercise, **When** the collision is detected, **Then** the
   app does not silently reject or create a duplicate — it offers to merge
   the two exercises.
3a. **Given** the app offered a merge after a rename collision, **When** the
    user declines it, **Then** the rename is cancelled and the exercise
    keeps its previous name — two exercises are never left sharing a name.
4. **Given** two catalogue entries that turn out to be duplicates, **When**
   the user merges them, **Then** the user chooses which of the two names is
   canonical, and that exercise is the survivor: its name and its own
   defaults are kept, the other name becomes an alias of it, and every set
   from both (the other exercise's included) is reassigned to it.
5. **Given** the user initiates a merge, **When** they confirm it, **Then**
   the merge is applied immediately and is not undoable — the confirmation
   is explicit and says so; there is no 5-second window.
6. **Given** a catalogue exercise that has recorded history, **When** the
   user tries to delete it, **Then** the app asks for explicit confirmation
   and offers merging as an alternative; if the user confirms the delete
   anyway, the exercise and all its historical exercise entries and sets are
   removed (cascade).
7. **Given** a fresh install with no logging history, **When** the user
   opens the exercise field, **Then** it is not empty — a seed set of
   common strength exercises is available to pick or rename, alongside the
   "create exercise" action (ADR-0005).

### Edge Cases

- The user opens the logging form, enters data, backgrounds the app, and
  returns much later: the pending draft is restored intact. (Forward-looking
  note, not testable in this slice: once a history view exists in a later
  spec, an un-submitted draft must not appear in it — it is not a Session.)
- Two pending drafts cannot exist: there is a single draft slot. Opening the
  logging form while a draft exists always restores that draft; there is no
  separate "start fresh" action that competes with it. To begin a new,
  empty session the user discards the draft first — the app never silently
  drops draft data.
- Confirming a set that is still invalid per FR-019 (no volume, and Load is
  None or unset) stores nothing: the confirm action is a silent no-op, or
  the confirm control is unavailable, until the set has a volume or a
  non-None load.
- Two overlapping 5-second undo windows: a set is individually deleted, and
  before its own undo window elapses the containing block is deleted too.
  Block-undo restores the block to exactly its state at the moment of block
  deletion — the already-deleted set stays deleted, keeping whatever is left
  of its own independent undo window.
- The user merges or deletes (with cascade) a catalogue exercise that is
  referenced by an exercise entry in the current unsubmitted draft: the
  draft entry is rewritten in place — repointed to the survivor on merge,
  or removed with its in-progress sets on cascade delete.
- A set with neither load nor volume entered is not stored — a set needs at
  least one of the two, and `Load: None` does not satisfy "load present"
  (FR-019, `docs/requirements.md` §3.3).
- Undoing a deleted set/block after the 5-second window has passed is not
  possible; the deletion is permanent.
- Deleting a set/block and backgrounding or closing the app before the
  5-second window elapses: the deletion has already been applied (it is a
  time-boxed reversal of an applied change, not a delayed commit), so
  closing the app does not cancel it.
- Recording a set for an exercise whose load type was changed after that set
  was recorded: past sets keep the load value and type they were recorded
  with; only new sets pick up the new default.
- Merging exercises that have conflicting defaults (different load type,
  movement pattern, or unilateral flag): the survivor's defaults are kept
  as-is; the app does not prompt field by field.
- Volume entered as 0 (or negative): rejected — volume must be greater than
  0. Load entered as 0: accepted for Weight and for the Bodyweight added
  component; the only negative numeric value anywhere is the assisted
  (negative) side of the Bodyweight component.
- The user creates a second, distinct session on the same calendar day: it
  is allowed — a fully independent second session (FR-021).

## Non-Goals *(mandatory)*

- **Session lifecycle / "finish a session".** There is no explicit
  end-of-session step, no "in progress" vs "finished" state, and no
  auto-resume. A session is a dated record the user stops adding to.
- **kg/lb unit selection.** Weight loads are kg only in this slice. The
  kg/lb default lives in Settings (FR-11), out of scope here.
- **Effort as RIR.** Only the 1–5 integer effort level exists; no RIR input
  mode, no RIR↔level conversion (ADR-0003).
- **History, search, progression, insights** (FR-6 to FR-9), **body
  composition** (FR-10), **settings/export/import** (FR-11, FR-12), **session
  templates** (FR-13). None are part of this slice.
- **Non-Strength disciplines.** Every exercise here is implicitly Strength
  (`docs/requirements.md` §1.4, D8); no discipline picker, no non-Strength
  behavior.
- **Concurrent logging contexts.** Two tabs/instances writing the same
  session is not handled here — a single active context is assumed;
  concurrency belongs to the persistence phase.
- **e1RM, tonnage, trend maths** (`docs/requirements.md` §5). This slice
  records the data those computations later run on; it computes none of
  them.
- **The contents of the seed catalogue.** That the catalogue ships seeded is
  in scope (ADR-0005); which exact exercises, aliases, and muscle groups
  the seed contains is application-bundle data, not specified here.
- **Platform and storage mechanics.** PWA framework, storage adapters, and
  persistence format are `/speckit-plan` decisions, not requirements of
  this spec.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: There is a single "open the logging form" action. When no
  pending draft exists it MUST create a new session with a date-time of that
  moment; when a pending draft exists it MUST restore that draft (FR-024)
  and MUST NOT also start a competing session. The user MUST be able to edit
  the session's date-time. There is no open/closed session state and no
  auto-resume of a previously submitted session.
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
  Merging exercises (FR-017) is explicitly excluded — it is irreversible.
- **FR-005**: The system MUST NOT lose any change already confirmed by the
  user if the app is closed, backgrounded, or killed at any point. This
  includes the pending logging draft (FR-024), which MUST survive an app
  close even though it is not a stored Session.
- **FR-006**: The system MUST let the user create, rename, reorder, and
  delete blocks within a session, and reorder exercises within a block and
  across blocks.
- **FR-007**: The system MUST display an unnamed block by its position
  (e.g. "Block 2"), never as "Untitled" or blank.
- **FR-008**: The system MUST pre-fill a new set for an exercise with the
  previous set's load and volume for that same exercise, so confirming an
  identical set is a single tap. Effort is deliberately NOT carried forward
  — it is re-entered or left blank on each set.
- **FR-009**: The system MUST let the user choose a load type per exercise
  (Weight, Band, Bodyweight, Free text, or None), remember it as that
  exercise's default, and allow overriding it per individual set.
- **FR-010**: The system MUST present a numeric keypad by default on numeric
  load/volume fields, with configurable quick-increment controls. Quick
  increments MUST NOT take a value below 0.
- **FR-011**: The system MUST let the user maintain their own reorderable
  list of band labels for Band loads.
- **FR-012**: The system MUST cap Free text loads at 40 characters and
  autocomplete from values previously used for that same exercise.
- **FR-013**: The system MUST let the user record a set's effort with a
  one-tap control on an integer 1–5 scale, MUST make recording it optional
  on every set, and MUST always present the level's meaning in words
  alongside the number (ADR-0003).
- **FR-014**: The system MUST support an optional signed added/assisted load
  component on a Bodyweight load (e.g. `+10 kg` added, `−20 kg` assisted),
  with its unit; the assisted component is negative by design
  (`docs/requirements.md` §3.2). The signed value MUST be capped to the
  range −300 kg to +300 kg, and a value of exactly 0 MUST be treated as "no
  component" rather than a distinct stored value.
- **FR-015**: The system MUST support fully custom exercise names with no
  closed list, and MUST honor per-exercise aliases in search.
- **FR-016**: Exercise search MUST be case- and accent-insensitive and
  tolerant of typos and partial matches.
- **FR-017**: The system MUST let the user merge two catalogue exercises.
  The user chooses which of the two names is canonical; that exercise is the
  survivor — its name and its own defaults (load type, movement pattern,
  unilateral flag) are kept, with no field-by-field prompt. The other
  exercise contributes its name as an alias of the survivor and its sets;
  every set from both is reassigned to the survivor. The merge requires
  explicit confirmation and is not undoable.
- **FR-018**: The system MUST require explicit confirmation before deleting
  a catalogue exercise that has recorded history, and MUST offer merging as
  an alternative in that confirmation. If the user confirms the deletion,
  the exercise and every historical exercise entry and set that references
  it MUST be removed (cascade).
- **FR-019**: A set with neither load nor volume recorded MUST NOT be
  stored; a set with either one present MUST be stored. `Load: None` does
  NOT count as "load present" for this rule — a set with `Load: None` and no
  volume MUST NOT be stored (per `docs/requirements.md` §3.3). Confirming
  such a set MUST store nothing: the confirm action is a silent no-op, or
  the confirm control is unavailable, until the set is valid.
- **FR-020**: Renaming a catalogue exercise MUST NOT change what any past
  set refers to — references are by identifier, never by name.
- **FR-021**: The system MUST allow more than one session per calendar day,
  each fully independent (confirmed decision D6). Starting a session always
  creates a new one; it never resumes an earlier session.
- **FR-022**: When the user renames an exercise to a name or alias already
  used by a different exercise, the system MUST detect the collision and
  offer to merge the two exercises, rather than rejecting the rename
  silently or creating two exercises with the same name. If the user
  declines the merge, the rename MUST be cancelled and the exercise MUST
  keep its previous name.
- **FR-023**: Deleting a block MUST cascade to its exercise entries and
  their sets; the 5-second undo (FR-004) MUST restore the block together
  with those sets, in the state they were in at deletion time. A session
  with zero blocks MUST be a valid state. Where a set inside the block was
  already within its own pending-delete undo window, block-undo MUST NOT
  resurrect that set — the two undo timers are independent.
- **FR-024**: If the user opens the logging form and leaves without
  submitting, the system MUST retain their input as a single pending draft
  — a state of the logging screen, not a stored Session, but still held in
  durable on-device storage so it survives an app close, background, or
  kill. Opening the logging form MUST restore that draft. Discarding the
  draft MUST remove it and its data. At most one pending draft exists at a
  time. A catalogue merge or cascade-delete (FR-017, FR-018) that affects
  an exercise referenced by the draft MUST rewrite the draft in place
  (repoint on merge; remove the entry and its in-progress sets on delete).
- **FR-025**: When the user confirms a set, the system MUST ignore an
  identical confirmation repeated within a short debounce window (~1
  second); a subsequent identical set confirmed after that window MUST be
  recorded as a new set.
- **FR-026**: A numeric Volume value MUST be greater than 0. A numeric Load
  value (Weight, or the added side of a Bodyweight component) MUST be
  greater than or equal to 0.

### Key Entities *(include if feature involves data)*

- **Session**: a dated training record — a date-time fixed at creation
  (user-editable), an ordered list of blocks, free-form notes, and optional
  overall feeling and duration. No open/closed lifecycle state. More than
  one per calendar day is permitted (FR-021).
- **Logging draft**: the not-yet-submitted state of the logging screen —
  the in-progress session content a user left behind without submitting.
  There is at most one. It is UI/session-state, **not** a persisted Session
  entity — it does not appear where a Session would and it is not a
  canonical record. It becomes a Session only on submit; discarding it from
  the logging form removes it. "Not a Session" does not mean "not stored":
  because it MUST
  survive an app close, background, or OS kill (FR-024, FR-005), it needs a
  durable on-device representation. That representation's shape (an
  in-progress date-time, partial blocks/entries/sets, load-type selections)
  is not part of the schema version and evolves independently of it —
  losing a draft to a format change is a UX regression, not history loss.
- **Block**: an ordered grouping within a session — optional name, a type
  (straight sets / superset / circuit), and an ordered list of exercise
  entries. The type is a label in this slice; it imposes no cardinality
  rule (a superset block with one exercise is valid). Deleting a block
  cascades to its contents (FR-023).
- **Exercise entry**: a reference to a catalogue exercise plus its order
  within the block, its notes, and its sets.
- **Set**: one performed unit of work — a Volume (reps, duration, or
  distance), a Load (Weight, Band, Bodyweight with an optional signed
  added/assisted component, Free text, or None), an optional Effort, a kind
  (warm-up / working / to failure), and a completed flag.
- **Effort**: an integer level from 1 to 5 (ADR-0003), stored as the single
  canonical value; its meaning is always shown in words. Optional per set.
- **Exercise (catalogue)**: a canonical name with aliases, an optional
  movement pattern and muscle groups, a default load type, a unilateral
  flag, and a discipline field that is `Strength` for every exercise in
  this slice (D8 — no user-facing discipline selection here). User-owned:
  creatable, renameable, mergeable. The catalogue is seeded with common
  strength exercises on a fresh install (ADR-0005); seed entries behave as
  ordinary entries thereafter.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can record a complete working set — from tapping "add
  set" to having it appear as recorded — in 3 taps or fewer, when repeating
  the previous set's load and volume.
- **SC-002**: A user can go from opening the app to a recorded set for a
  brand-new exercise (never logged before) in under 30 seconds.
- **SC-003**: No data entered and confirmed by the user is ever lost across
  an app close, background, or kill, in 100% of tested interruption points —
  including an un-submitted logging draft.
- **SC-004**: A user can search the exercise catalogue by a partial or
  misspelled name and find the intended exercise within the first 3
  results, for catalogues of up to 500 exercises.
- **SC-005**: Every destructive action taken on the logging screen (set,
  exercise entry, block — including a block with recorded sets) remains
  reversible for at least 5 seconds; merging exercises is the one catalogue
  action that is deliberately irreversible and is confirmed as such.
- **SC-006**: In a first-use test with at least 8 participants who have
  never seen the app, at least 8 of 10 (≥ 80%) complete a full first
  session (at least one block, one exercise, three sets) with no external
  help or documentation, starting from the seeded catalogue.
- **SC-007**: A user who opens the logging form, enters at least one full
  set's data, closes the app, and reopens it later finds their in-progress
  draft intact in 100% of tested cases.

## Assumptions

- **Default unit (D4)**: kilograms are the default and only unit for Weight
  loads in this slice; the unit is stored exactly as entered and converted
  only for display, never in storage. A kg/lb picker is out of scope
  (Settings, FR-11).
- **Multiple sessions per day (D6)**: allowed; each is fully independent,
  and starting a session never resumes an earlier one (FR-021).
- **Effort scale (ADR-0003)**: an integer 1–5 level, no RIR mode. The word
  labels for the five levels are an application/presentation concern, not
  specified here.
- **Seed catalogue (D9, ADR-0005)**: the app ships a seed set of common
  strength exercises so there is no true empty state. This spec assumes the
  seed exists; its contents are not specified here.
- **e1RM formula (D5)** and **session templates (D7, FR-13)** do not affect
  this slice and are left to the specs that depend on them.
- **Exercise discipline (D8)**: out of scope. Every exercise here is
  implicitly Strength; no discipline selection and no non-Strength behavior.
- The exercise catalogue, storage port, and session state already exist as
  concepts to build against (this is the first feature spec; no prior
  implementation exists) — this spec describes required behavior, not gaps
  in an existing system.
- **Single active logging context**: only one tab/instance edits a session
  at a time. Concurrent contexts are out of scope (persistence phase).
- Platform and storage mechanics are not user-facing requirements of this
  spec — they are technical choices made and confirmed in a later
  `/speckit-plan`, not here.
