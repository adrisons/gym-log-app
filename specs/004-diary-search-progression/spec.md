# Feature Specification: Diary, Search and Progression

**Feature Branch**: `004-diary-search-progression`

**Created**: 2026-09-11

**Status**: Planned

**Input**: User description: "Diary, search and progression (Phase 4,
MVP-closing). Covers docs/requirements.md FR-6 (Diary/history: reverse-
chronological list of sessions grouped by month, one-line summary per
session — date, main exercises, set count, kind of work derived from the
exercises logged, never a separately-entered field — session detail view
editable after the fact, jump to a specific date), FR-7 (Exercise search:
search by name and alias, case- and accent-insensitive, tolerant of typos
and partial matches, results in under 100ms for catalogues of up to 500
exercises, the search index is derived and rebuildable per invariant 3 —
never a second source of truth), and FR-8 (Exercise progression: one screen
with a list representation — one row per session with date, best working
set, load, volume, effort, set count, reverse chronological — and a chart
representation — one metric over time selectable between estimated 1RM, top
load, session tonnage, and reps at a fixed load, selectable range 3/6/12
months/all, personal records marked visually in both — scoped to the
Strength discipline in v1, e1RM/tonnage defined in docs/requirements.md
§5.2/§5.3 for Weight loads and Bodyweight with numeric added load, sets of
1-12 reps only; for Band or free-text loads the app shows no estimated 1RM,
offers the metrics that do apply, and explains why in one sentence — honest
degradation per docs/requirements.md §1.4's discipline-neutral canonical
schema). Builds on spec 001 (Log a Session: the Session/Block/ExerciseEntry/
Set/Exercise domain and StoragePort) and spec 003 (Persistence: the two real
adapters) — this spec adds no new adapter, only new application-layer
read/derive/search/computation logic and two new presentation-layer screens
(a diary/history screen, a progression screen) consuming the existing
StoragePort read methods (listSessions, listExercises). Closes the MVP loop
per docs/agent-brief.md Phase 4."

## Context *(mandatory)*

`specs/001-log-a-session/` built the entire write path — logging a Session's
Blocks, ExerciseEntries and Sets — against `StoragePort`, now durable since
`specs/003-persistence/`. Nothing so far lets a person look *back* at what
they logged: there is no list of past sessions, no way to find an exercise
by name, and no view of how a lift has progressed. `docs/agent-brief.md`
names this gap explicitly as Phase 4, "the MVP loop" — without it, the app
can only ever write, never read back what it recorded, which is not a usable
training diary. This spec closes that loop: FR-6 (diary/history), FR-7
(exercise search) and FR-8 (progression), per `docs/requirements.md`. It
introduces no new domain entity, no new port method, and no new adapter —
`listSessions` and `listExercises` (already implemented and proven durable
by spec 003) are sufficient inputs for every screen and computation this
spec adds. Everything new is application-layer derivation (a search index,
the e1RM/tonnage computations already specified in `docs/requirements.md`
§5.2/§5.3, a per-session diary summary) and presentation-layer screens that
read that derived data — never a second source of truth for anything
`StoragePort` already stores (`docs/requirements.md` §6).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Skim what I've trained lately (Priority: P1)

A person opens the app to see, at a glance, what they have trained recently
— without opening each session individually. They see a reverse-
chronological list of their sessions, grouped by month, each summarised in
one line: date, main exercises, how many sets, and what kind of work it was.
Tapping a session opens its full detail, editable exactly as it was when
first logged.

**Why this priority**: This is `docs/requirements.md` scenario S8 and FR-6,
and the most basic form of "looking back" — without it the diary has no
diary, only a write-only logging form. It is also the foundation the other
two stories build on (search and progression both start from the same
underlying session data).

**Independent Test**: Log several sessions across different months (using
the existing spec-001 logging flow), open the diary screen, and confirm
sessions appear reverse-chronologically, grouped by month, each with an
accurate one-line summary; open one session's detail and confirm every
field is editable and edits persist.

**Acceptance Scenarios**:

1. **Given** sessions logged on several different dates across two or more
   months, **When** the diary screen opens, **Then** sessions are listed
   reverse-chronologically (most recent first) and grouped under a heading
   for their month.
2. **Given** a session with two blocks, three exercises and seven sets,
   **When** it appears in the diary list, **Then** its one-line summary
   shows its date, its main exercises, a set count of 7, and a kind-of-work
   label derived from the exercises logged (e.g. their movement patterns) —
   never a separately-entered field.
3. **Given** a session in the diary list, **When** the user taps it,
   **Then** its full detail view opens showing every block, exercise entry
   and set exactly as logged.
4. **Given** a session's detail view is open, **When** the user edits a set
   (load, effort, volume) or adds/removes a set, **Then** the change
   persists via the existing `StoragePort.saveSession` path and is reflected
   the next time the diary or detail view is opened.
5. **Given** the diary screen, **When** the user picks a specific date (jump
   to date), **Then** the list scrolls or navigates to the sessions around
   that date.
6. **Given** no sessions have ever been logged, **When** the diary screen
   opens, **Then** it shows an explicit empty state rather than an empty or
   blank list.

---

### User Story 2 - Find an exercise by name (Priority: P1)

A person wants to see one specific exercise's history — searching for it by
name (or a nickname/alias they use), even with a typo or a partial word,
and getting it back quickly.

**Why this priority**: `docs/requirements.md` scenario S4 depends on this —
progression review always starts with finding the exercise. Search is also
the entry point FR-8's progression screen is reached through in the common
case (the other being tapping an exercise from a session's detail view).

**Independent Test**: Seed a catalogue with a range of exercise names and
aliases (including accented characters), search with an exact name, a
partial name, a name with a typo, and an alias, and confirm each returns the
expected exercise(s) in well under the 100ms budget.

**Acceptance Scenarios**:

1. **Given** an exercise named "Sentadilla", **When** the user searches
   "sentadilla" (any case) or "sentadila" (a typo) or "senta" (a partial
   match), **Then** the exercise appears in the results.
2. **Given** an exercise named "Peso muerto" with alias "deadlift",
   **When** the user searches "deadlift", **Then** the same exercise
   appears.
3. **Given** a catalogue of up to 500 exercises, **When** a search is run,
   **Then** results are returned in under 100ms.
4. **Given** a search query that matches nothing, **When** the search runs,
   **Then** the result is an explicit empty result, not an error.
5. **Given** the catalogue changes (an exercise is renamed, merged, or a new
   one is created) via the existing spec-001 catalogue flows, **When** a
   search runs afterward, **Then** results reflect the change — the search
   index is rebuilt/kept in sync automatically, never requiring a manual
   refresh, and is never a second source of truth for the catalogue itself
   (`docs/requirements.md` invariant 3 / §6).

---

### User Story 3 - Review one exercise's progression (Priority: P1)

Having found an exercise, a person wants to see how it has progressed: a
list of past sessions where they did that exercise (date, best working set,
load, volume, effort, set count), and a chart of one metric over time, with
personal records marked.

**Why this priority**: `docs/requirements.md` scenario S4 and FR-8 directly;
this is the other half of "closing the MVP loop" alongside the diary — the
value of a training log is seeing progress, not just a record of the past.

**Independent Test**: Log the same exercise across several sessions with
increasing weight, open its progression screen, and confirm the list shows
one row per session (reverse chronological) with the correct best working
set/load/volume/effort/set count, the chart plots the selected metric
correctly across the selected range, and the heaviest/best sessions are
marked as personal records.

**Acceptance Scenarios**:

1. **Given** an exercise logged across five sessions, **When** its
   progression screen opens, **Then** the list shows one row per session,
   reverse chronological, each with that session's date, best working set
   for that exercise (load, volume, effort) and the number of sets logged
   for that exercise in that session.
2. **Given** the same exercise's history, **When** the user selects the
   estimated-1RM metric, **Then** the chart plots, for each session with at
   least one valid working set (per `docs/requirements.md` §5.2: `Weight` or
   `Bodyweight`-with-numeric-added-load, 1-12 reps), that session's maximum
   e1RM across its valid working sets, computed with the Epley formula.
3. **Given** the same exercise's history, **When** the user selects top
   load, session tonnage, or reps at a fixed load, **Then** the chart plots
   that metric instead, computed per `docs/requirements.md` §5.3 for
   tonnage.
4. **Given** the chart is showing a metric over time, **When** the user
   selects a different range (3 months, 6 months, 1 year, all), **Then**
   the chart and (where reasonable) the list are filtered to that range.
5. **Given** an exercise's history includes a session with its best-ever
   working set by the currently selected metric, **When** the list and
   chart render, **Then** that session is visually marked as a personal
   record in both representations.
6. **Given** an exercise logged only with `Band` or `FreeText` loads,
   **When** its progression screen opens, **Then** no estimated-1RM metric
   is offered or computed; the metrics that do apply (e.g. tonnage counted
   as total reps per §5.3, reps at a fixed load where the load matches
   exactly) are offered instead, and the screen states in one sentence why
   estimated 1RM is unavailable for this exercise.
7. **Given** an exercise with fewer than 2 sessions of data, **When** its
   progression screen opens, **Then** the list and chart still render with
   whatever data exists (no artificial minimum blocks the screen itself —
   data-sufficiency thresholds from §5.7 govern the separate Insights
   feature, not this one), with the chart showing a single point or an
   explicit "not enough data yet for a trend" state as appropriate.

### Edge Cases

- What happens when a session has zero sets for a given exercise entry (an
  entry was added but nothing confirmed, then the session was left as-is)?
  It contributes no working set to that exercise's progression list/chart
  for that session, and does not appear as a progression row with empty
  values.
- What happens when the same exercise appears more than once in the same
  session (e.g. two separate blocks)? Its progression list/chart treats the
  session as one row/point, aggregating across every set of that exercise
  in that session (best working set across all of them; tonnage/reps summed
  across all of them).
- What happens when a session's date-time is edited (per FR-6's "editable
  after the fact") to move it into a different month, or to a date before
  another session? The diary's month grouping and reverse-chronological
  order, and the progression list/chart's ordering, reflect the edited
  date-time the next time each screen reads from storage — there is no
  separate "logged order" retained anywhere.
- What happens when an exercise referenced by history is renamed or merged
  (spec 001/002's existing `mergeExercises` cascade)? The diary's kind-of-
  work labels and the progression screen (reached by the survivor's
  identity) reflect the merged/renamed state on next read — this spec adds
  no new merge/rename behavior, only reads through the identifier-based
  references those flows already maintain.
- What happens when the exercise catalogue or session data changes while a
  search or progression screen is open (e.g. edited in another tab)? Per
  spec 003's Non-Goals, this spec does not add cross-tab coordination; a
  screen reflects whatever it last read and updates on its own next
  read/refresh, consistent with the existing single-user, single-device
  assumption (`docs/requirements.md` §1.2).
- What happens to the search index and any progression aggregate cache
  across an app restart, or if it is missing/stale at launch? Both are
  derived data (`docs/requirements.md` §6): rebuilt from the canonical
  Session/Exercise records on launch if missing or stale, never read as a
  source of truth in place of `listSessions`/`listExercises`.

## Non-Goals *(mandatory)*

- **Insights (FR-9)** — trend cards, aggregate progress by movement pattern
  or muscle group, plateau/consistency detection, and their data-sufficiency
  thresholds (§5.7) are a separate, later spec (`docs/agent-brief.md` Phase
  5); this spec's progression screen shows one exercise's own list/chart,
  not cross-exercise conclusions.
- **A second discipline's own progression metric** — per
  `docs/requirements.md` §1.4, this spec's chart metrics (e1RM, top load,
  tonnage, reps at a fixed load) apply to the Strength discipline only; a
  future discipline's metric (e.g. fastest time) is D8, out of scope here.
- **Any new domain entity, value object, or `StoragePort` method** — this
  spec is read-only against the existing `listSessions`/`listExercises`
  surface; session editing from the detail view reuses the existing
  `saveSession` path spec 001 already built, unchanged.
- **A persisted, on-disk search index or progression cache with its own
  schema/versioning** — the search index and any progression aggregate are
  in-memory derived data, rebuilt from canonical records each time they are
  needed (`docs/requirements.md` §6); this spec does not add a new storage
  adapter concern or a schema version bump.
- **Body composition (FR-10), settings (FR-11), export/import (FR-12)** —
  unrelated later phases.
- **Cross-tab or cross-device synchronization of the diary/search/
  progression views** — consistent with spec 003's Non-Goals and
  `docs/requirements.md` §1.2's single-device assumption.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a diary/history screen listing every
  stored Session (queried via `StoragePort.listSessions` with a `DateRange`
  wide enough to cover every stored session — see Assumptions), ordered
  reverse-chronologically by `dateTime`, grouped under headings by calendar
  month.
- **FR-002**: Each Session in the diary list MUST be summarized in one
  line showing: its date, its main exercises (the catalogue exercises
  referenced by its ExerciseEntries), its total Set count, and a kind-of-
  work label derived from the exercises logged (e.g. their movement
  patterns) — never a field entered separately when logging.
- **FR-003**: The diary screen MUST let the user jump to a specific date,
  navigating the list to the session at that date, or, if none exists, the
  nearest session dated after it; if no session exists on or after that
  date, the nearest session before it; if the diary has no sessions at all,
  FR-006's empty state applies and jump-to-date has nothing to navigate to.
- **FR-004**: Selecting a Session from the diary list MUST open a session
  detail view showing every Block, ExerciseEntry and Set as logged.
- **FR-005**: The session detail view MUST be editable after the fact — any
  field editable during logging (spec 001) MUST remain editable here, with
  edits persisted through the existing `StoragePort.saveSession`.
- **FR-006**: The diary screen MUST show an explicit empty state when no
  Session has ever been logged, rather than an empty list with no
  explanation.
- **FR-007**: The system MUST provide exercise search over the catalogue
  returned by `StoragePort.listExercises`, matching each Exercise's
  `canonicalName` and every entry in its `aliases`.
- **FR-008**: Search MUST be case-insensitive and accent-insensitive (e.g.
  "sentadilla" matches "Sentadilla"; a query without diacritics matches a
  name that has them, and vice versa).
- **FR-009**: Search MUST tolerate typos and partial matches: a query that
  is a substring or prefix of a name or alias (case/accent-insensitive per
  FR-008) MUST match, and a query within one single-character edit
  (insertion, deletion, or substitution) of a name, an alias, or any one
  whitespace-delimited word within a name or alias, MUST also match (so a
  typo in one word of a multi-word name, e.g. "squta" against "Barbell
  squat", still matches). Plan-phase research.md §1 records why this
  whole-string-or-whole-word scope (not arbitrary substrings) is the
  precise, testable boundary intended here.
- **FR-010**: Search MUST return results in under 100ms for a catalogue of
  up to 500 exercises.
- **FR-011**: The search index MUST be derived from `listExercises` and
  rebuildable at any time from that source — it MUST never be treated as
  authoritative over, or allowed to drift out of sync with, the catalogue
  itself (`docs/requirements.md` invariant 3 / §6); after any catalogue
  change made through the existing create/rename/merge flows, a subsequent
  search MUST reflect that change.
- **FR-012**: A search with no matches MUST return an explicit empty
  result, not an error or an undefined state.
- **FR-013**: The system MUST provide a progression screen for a single
  Exercise, reachable from search results and from an exercise referenced
  in a session detail view.
- **FR-014**: The progression screen's list representation MUST show one
  row per Session that has at least one Set for that Exercise, reverse
  chronological, each row showing that session's date, the best working
  Set for that exercise in that session (its load and volume), that best
  set's effort if recorded, and the count of Sets logged for that exercise
  in that session.
- **FR-015**: "Best working set" (FR-014's list row, and the per-set case of
  personal-record marking in FR-020) MUST be computed only over working
  sets (`setKind: 'working'` or `'toFailure'`, per `docs/requirements.md`
  §5.1's working-set definition — excluding `warmUp`) for that exercise in
  that session, using this fixed ranking, independent of the chart's
  currently-selected metric (FR-016): (1) the working set with the highest
  estimated 1RM among those eligible per FR-017; if none are eligible, (2)
  the working set with the highest numeric load value (`Weight` value, or
  `Bodyweight`'s numeric added-load component); if no set has a numeric
  load, (3) the working set with the highest rep count. This ranking is
  used identically whichever chart metric is currently selected.
- **FR-016**: The progression screen's chart representation MUST plot one
  metric over time, selectable among: estimated 1RM, top load, session
  tonnage, and reps at a fixed load.
- **FR-017**: Estimated 1RM MUST be computed per `docs/requirements.md`
  §5.2 — Epley formula (`load × (1 + reps / 30)`), only for `Weight` loads
  and `Bodyweight` loads with a numeric added load, only for working sets
  of 1 to 12 reps, with a session's e1RM being the maximum across its
  qualifying working sets for that exercise.
- **FR-018**: Session tonnage for the chart MUST be computed per
  `docs/requirements.md` §5.3 (`sum(load × reps)` across that session's
  working sets for the exercise with numeric load); for sets with
  non-numeric load, the tonnage metric MUST instead count total reps and be
  labelled accordingly when shown.
- **FR-019**: The chart MUST support a selectable range of 3 months, 6
  months, 12 months, and all time, filtering which sessions' data points
  are plotted; "all time" MUST include every stored session for that
  exercise, with no earliest-date cutoff.
- **FR-020**: Personal records MUST be marked visually in both the list and
  chart representations. A session is marked as a personal record for the
  currently-selected metric when its value for that metric (its e1RM per
  FR-017, its FR-015 best-working-set's load for top load, its tonnage per
  FR-018, or its reps at the selected fixed load) equals the single highest
  value for that metric across the exercise's **entire** history (all
  sessions, regardless of the chart's currently selected range) — the
  all-time maximum, not a running/progressive record; every session tied
  for that maximum is marked.
- **FR-021**: For an Exercise whose logged history contains zero working
  sets eligible for estimated 1RM under FR-017 (i.e. every set is `Band`,
  `FreeText`, or `Bodyweight` with no numeric added load, or falls outside
  the 1-12 rep range), the progression screen MUST NOT offer or compute an
  estimated-1RM metric; it MUST instead offer the metrics that do apply
  (tonnage-as-total-reps per FR-018, reps at a fixed load where the load
  value matches exactly) and MUST show a one-sentence explanation of why
  estimated 1RM is unavailable for this exercise.
- **FR-022**: When an Exercise's logged history includes both metric-
  eligible sets (Weight/Bodyweight-with-numeric-load) and ineligible ones
  (Band/FreeText) across different sessions, the estimated-1RM metric MUST
  be offered and MUST plot only the eligible sessions, without treating the
  ineligible sessions as zero or as missing data points requiring
  explanation beyond FR-021's sentence when that metric is selected.
- **FR-023**: All derived data this spec introduces (search index,
  progression computations) MUST be regenerated from `listSessions`/
  `listExercises` rather than persisted as a separate source of truth,
  consistent with `docs/requirements.md` §6.

### Key Entities *(include if feature involves data)*

This spec introduces no new domain entity or value object. It reads the
existing entities finalized by spec 001/002 (`docs/requirements.md` §3):
Session, Block, Exercise entry, Set, Exercise (catalogue), and the Load
value object's five variants — and adds two purely derived, in-memory
concepts with no persisted shape of their own:

- **Search index**: a derived, rebuildable mapping from search terms
  (normalized names/aliases) to Exercise identifiers, used only to answer
  FR-7 queries; never read or written by any other feature.
- **Progression series**: for a given Exercise, the derived per-session
  list of best-working-set/tonnage/reps figures used by FR-8's list and
  chart; recomputed from `listSessions` on demand, never stored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person can see what they trained in the last 30 days, and
  open any one session's full detail, without leaving the diary screen more
  than one tap deep (list → detail).
- **SC-002**: Searching for any exercise already in a catalogue of up to 500
  exercises, by its exact name, a partial name, an alias, or a name with one
  typo, returns that exercise in under 100ms.
- **SC-003**: For an exercise logged with numeric Weight/Bodyweight loads
  across multiple sessions, its progression chart's e1RM values match a
  hand-computed Epley-formula result exactly, for every valid working set.
- **SC-004**: An exercise with no e1RM-eligible working set anywhere in its
  history (FR-021) never shows a numeric estimated-1RM value anywhere, and
  always shows the one-sentence explanation instead.
- **SC-005**: 100% of personal records (the all-time-highest value for the
  selected metric across an exercise's full history, per FR-020) are
  visually marked in both the progression list and chart.

## Assumptions

- `StoragePort.listSessions` (`src/application/ports/storage-port.ts`)
  takes a mandatory `DateRange`; there is no unbounded "list all" overload.
  Every "every Session" (FR-001) or "all time" (FR-019) requirement in this
  spec is satisfied by the application layer passing a `DateRange` wide
  enough to cover all stored data (e.g. from the epoch, or from the
  earliest plausible session date, through the current date) — an
  implementation technique, not a new port method or a change to
  `listSessions`'s existing signature.
- "Main exercises" in a diary summary (FR-6) means every distinct catalogue
  Exercise referenced by the session's ExerciseEntries — for a session with
  many exercises, the presentation layer may truncate the displayed list
  (e.g. "Squat, Bench +2 more") without that being a data limitation; the
  underlying summary data itself is complete.
- "Kind of work" (FR-6, FR-002) derives from the movement patterns of the
  exercises logged in a session when that optional field is present on the
  referenced Exercise entries; a session whose exercises have no movement
  pattern set shows a neutral/unlabelled kind-of-work rather than a
  fabricated one, consistent with FR-5's "optional... required for
  aggregate insights" already establishing that this field may be absent.
- "Reps at a fixed load" (FR-8's fourth chart metric) means: for a load
  value the user has actually logged for that exercise (selected from the
  loads present in its history, defaulting to the most recent or most
  frequent), the chart plots the reps achieved at that same load value
  across sessions — this spec does not add arbitrary load interpolation.
- The search algorithm's specific technique (e.g. normalized-string
  Levenshtein distance, trigram matching) is an implementation detail left
  to `/speckit-plan`; this spec only fixes its observable behavior (FR-7/
  FR-008/FR-009/FR-010).
- Reused terminology and computation rules (working set, e1RM, tonnage) are
  exactly as already defined in `docs/requirements.md` §5.1/§5.2/§5.3; this
  spec does not redefine them, only consumes them.
