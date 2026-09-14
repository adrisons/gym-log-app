# Training Diary — Functional Requirements

**Status:** all decisions in §8 are closed. This document is the source of
truth for *what* the app does; the *how* lives in the stack document (once
`/speckit-plan` produces it) and in the decision records (ADRs).

**Project language:** English, for every artifact — code, identifiers, comments,
commit messages and documentation (ADR-0001).

---

## 1. Mission, invariants, non-goals

### 1.1 Mission

> A personal training diary: log what you did today in a few taps, and see —
> with evidence — how you are progressing.

### 1.2 Invariants

Three properties that override every other rule. A change that breaks one of
them is not a change to make; it is a decision to escalate.

1. **The user controls their data.** No mandatory account, local-first by
   default, everything exportable in an open, readable format. Nothing leaves
   the device without the user explicitly choosing to send it. This does not
   prejudge what a future connected mode looks like — only that whatever form
   it takes, it is opt-in, and a user who never activates it keeps today's
   guarantee unchanged: nothing sent anywhere, no account required.
2. **Logging is the critical path and always works.** Recording a set in the
   middle of the gym, offline, one-handed, must be immediate: no Save button, no
   waiting, no dialogs.
3. **Everything derived is recomputable.** Progressions, insights, search
   indexes and chart data are computed from the canonical records. They can be
   deleted wholesale and regenerated with no loss.

### 1.3 Non-goals

An explicit list of what the app is not, today. Anything landing here is
refused or turned into a recorded decision before it's built.

- Not a program prescriber, for the solo user. The app records what you did;
  it does not tell you what to do. A future opt-in mode where a human coach
  assigns workouts to consenting members would be a separate, undecided
  extension — not something this non-goal already permits, and not something
  it should be read as forever excluding either.
- Not a calorie counter or nutrition tracker.
- Not a generative-AI coach: insights are deterministic, explainable
  computations, not generated text (§5.6).
- Not a cloud service: no multi-device sync today. If sync is ever built, it
  is its own recorded decision, explicit in the UI, and off by default.
- Not a wearable companion: no heart-rate monitors or sensors in v1.
- Not a body-composition tracker: no weight, body-fat, or other body
  measurements at all, in any version. Scope is exercises and training
  metrics only. See Decision D10.

Social and coaching ideas — peer comparison, coach groups, coach-assigned
workouts — are not designed into anything above and are not scoped for any
version. §10 records why, and what each would need before it could be.

### 1.4 Extensibility beyond strength training

The app ships with strength training fully specified (v1). It is not a
strength-only app by design — the domain model (§3) and the computation
rules (§5) are deliberately generalized so that a second discipline (a
first candidate: swimming, e.g. tracking the best time achieved for a fixed
distance like 100 m freestyle) can be added later without a rework of the
canonical data. Concretely: a Set's `Volume` already distinguishes reps,
duration and distance, and its `Load` already has a `None` variant for work
where load doesn't apply. `Volume` is an exclusive choice among reps,
duration and distance, not a combination, so a fixed-distance swim result
(both the distance and the time it took) is not a single Set's `Volume` —
it is the *catalogue entry* that fixes the distance (e.g. "100 m
freestyle", the same way "back squat" and "front squat" are already
distinct entries rather than one entry with a variant field, per FR-5), and
the Set logged against it needs only `Volume: Duration` and `Load: None`.
No new value-object shape is needed for that split, but it is a real split
a future discipline's own spec has to state, not something today's model
already does automatically (see ADR-0006 for where this was first written
imprecisely as "distance", corrected there). The Exercise catalogue's new
`discipline` field (§3.1) is itself a schema change — a persisted fact
about a canonical entity, not a derived value — so per §6 it ships with a
version bump, an ADR, and a (trivial, default-to-Strength) migration when
implementation happens; being additive with a safe default does not exempt
it. What v1 does NOT ship is any
strength-specific computation (e1RM, tonnage, §5.2–5.3) applied to a
non-strength discipline, any UI for a non-strength discipline, or a second
discipline's own progression metric (e.g. "fastest time" as a tracked
trend), until D8 (§8) is implemented. D8 is now closed: swimming is the
first discipline added beyond Strength, targeted at v1.1 → ADR-0006. Which
disciplines beyond swimming (running included) are in scope, and when,
remains open and needs its own future decision.

---

## 2. User and scenarios

A single user profile: someone who trains on their own and wants a memory of
what they do.

| # | Scenario | Context | Success |
|---|----------|---------|---------|
| S1 | Log today's session | Standing, in the gym, between sets, one hand | Record a complete set in ≤ 3 taps from the session screen |
| S2 | Repeat the last session | Starting a session, wants to build on the previous one | Preload exercises and loads from the last equivalent session in 1 tap |
| S3 | Check what I lifted last time | Right before loading the bar | See the exercise's last record without leaving the logging screen |
| S4 | Review one exercise's progression | At home, unhurried | Search by name and see list + chart on one screen |
| S5 | Understand whether I'm improving | Monthly review | Insights showing the claim, the data behind it, and the period |
| S7 | Take my data with me | New phone, distrust, curiosity | Export everything to an open file and import it back |
| S8 | Skim what I've trained lately | Casual check, not reviewing one exercise | See recent sessions with their date and what kind of work each one was, without opening each one |

---

## 3. Domain model

One vocabulary, used identically in code, UI and documentation.

### 3.1 Entities

- **Exercise (catalogue).** Canonical name, aliases, movement pattern, muscle
  groups, a set-entry template (default load type, default volume kind,
  whether effort is tracked — ADR-0006), unilateral flag, discipline (§1.4
  — `Strength` in v1; the field exists so a future discipline is additive,
  not a reshape). The template only decides what a *new* set of this
  exercise defaults to and which controls are offered; changing it never
  touches an already-recorded `Set` (ADR-0006). The catalogue belongs to
  the user: they can create, rename and
  merge entries. A custom name is free text set by the user — e.g. "hip
  thrust con barra" and "hip thrust en máquina" are two distinct entries
  (or one entry with the other as an alias) at the user's choice, never
  forced into a fixed list (FR-5). The catalogue is not empty on a fresh
  install: the app ships a seed set of common strength exercises (D9,
  ADR-0005), which behave as ordinary entries thereafter — renameable,
  mergeable, deletable.
- **Session.** A training record: a date-time, an ordered list of blocks,
  free-form notes, optional overall feeling, optional duration. The date-time
  is set when the session is created (the moment the logging form is opened)
  and the user may edit it. A session has no open/closed lifecycle state — it
  is not "in progress" or "finished", it is just a dated record that the user
  keeps adding to or stops adding to. More than one session per day is
  allowed, and each is fully independent.
- **Block.** An ordered grouping inside a session: optional name ("Superset A",
  "Legs"), type (straight sets / superset / circuit), and an ordered list of
  exercise entries. No target-rounds field (ADR-0008 added one, ADR-0013
  removed it again as redundant with each exercise entry's own set count).
- **Exercise entry.** A reference to a catalogue exercise, its order within the
  block, notes, and its sets.
- **Set.** One performed set: volume, load, effort, kind (warm-up / working / to
  failure), completed flag.
- **Body measurement.** Date, body weight, optional fat percentage, optional
  muscle percentage or mass, notes.

### 3.2 Value objects

- **Load** — a sum type; exactly one variant per set:
  - `Weight` — numeric value + unit (kg/lb).
  - `Band` — band label (colour or name) + optional estimated resistance.
  - `Bodyweight` — with optional added or assisted load (`+10 kg`, `−20 kg`).
  - `FreeText` — short string ("machine level 4", "stack 3").
  - `None` — for work where load does not apply.
- **Volume** — a sum type: `Reps` | `Duration` (seconds) | `Distance` (metres).
  A 45-second plank and an 8-rep press are both valid sets.
- **Effort** — an integer level from 1 to 5, stored as the single canonical
  value (ADR-0003). The scale's meaning is always shown in words, never the
  bare number (§7.4). Optional: a set with no effort recorded is valid and
  does not invalidate its load computations.

### 3.3 Domain rules

- A set with neither volume nor load is not stored; with either one, it is.
- Renaming an exercise never breaks history: references are by identifier, never
  by name.
- Merging two exercises reassigns every set to the survivor and keeps the merged
  name as an alias.
- Deleting a catalogue exercise that has history requires explicit confirmation
  and offers merging instead.
- Logging is selective: a session records only the exercises the user chose
  to track, not an exhaustive log of everything physically performed. An
  exercise done but not logged has no representation and is not implied by
  its absence.
- Units are stored exactly as entered; conversion is a presentation concern,
  never a storage one.

---

## 4. Functional requirements

Each requirement carries verifiable acceptance criteria. `[v1]` ships in the
first version; `[v1.1]` and `[later]` are subsequent scope (§9).

### FR-1 — Log a session `[v1]`

Create a session and add blocks, exercises and sets.

- Starting a new session creates it with a date-time of the moment the
  logging form is opened; the user can edit that date-time. There is no
  open/closed session state and no auto-resume of a prior session — each new
  session is independent (D6).
- If the user opens the logging form and leaves without registering the
  workout, and has added at least one exercise, their in-progress input is
  kept as a single pending draft (a state of the logging screen, not a
  stored Session) — so locking the phone mid-entry and coming back later
  loses nothing. A visit where nothing was added stores nothing. Reopening
  the form offers, but does not silently apply, recovery of that draft: a
  banner at the top of the screen lets the user recover it (filling the
  form with its data) or discard it; adding a block, exercise, or set is
  unavailable until one of the two is chosen, so an unresolved draft is
  never silently overwritten (D16, ADR-0009). Discarding removes the
  draft and its data. _(Amended by ADR-0011: the form opens with one block
  already present, so "at least one block" stopped being a useful
  threshold — every exercise now belongs to a block by construction, and
  the gate is the exercise itself.)_
- Adding an exercise opens the catalogue search with most-used and recent
  entries first; a new exercise can be created from the same field.
- Every change persists automatically. There is no Save button.
- Every destructive action (delete set, exercise, block) is undoable from the
  same screen for at least 5 seconds.
- Closing the app at any moment loses nothing that was entered.
- The logging form is reached from a single prominent action on the diary
  (a floating action, not a persistent navigation destination) — logging is
  still the app's primary purpose (§1.1), so it stays one tap from the
  screen the user opens the app to, without occupying a permanent slot in
  the primary navigation that would otherwise sit idle between sessions.
  An explicit "Log workout" action is the only way a draft becomes a
  listed Session (D16, ADR-0009); registering it returns to the diary with
  a brief, self-dismissing acknowledgement that the workout was saved
  (`docs/design.md` §1.1's bounded exception). Leaving the form without
  registering — even after recording several sets — shows no such
  acknowledgement: the sets are safe (kept in the pending draft above),
  but nothing has yet joined the diary, and the app never implies
  otherwise.
- Logging is selective by design (§3.3): the user adds only the exercises
  they want a record of. Nothing in the flow requires accounting for every
  exercise physically performed in the session.

### FR-2 — Blocks `[v1]`

- Create, rename, reorder and delete blocks within a session — reordering
  a block is Move up/Move down on its own menu (ADR-0013), mirroring how
  an exercise entry already reorders within/across blocks below, not
  drag-and-drop.
- Reorder exercises within a block and across blocks.
- An unnamed block is shown by its position, not as "Untitled".
- Every exercise entry belongs to a block; there is no blockless exercise.
  The logging form opens with one empty block already present, each block
  carries its own "add exercise" control, and an "Add block" control below
  the last block adds further ones (ADR-0011).
- A block can be collapsed to hide its exercises and sets while keeping its
  name, position label, and exercise count visible, and expanded again.
  Purely a display state: never persisted as part of the Session record,
  and never affects what FR-004's undo restores. _(Amended by ADR-0011:
  the visible summary count is exercises only, not sets.)_
- **(ADR-0013, supersedes ADR-0008's target-round-count requirement)** A
  block's target round count is removed — redundant with each exercise
  entry's own set count, which already says how many times it was
  actually done. A block has no round-related field of any kind any more.

### FR-3 — Sets and load `[v1]`

- Adding a set defaults to the previous set's values for that exercise (same
  load, same reps), so confirming is one tap.
- Load type and volume kind are chosen once per exercise, as that exercise's
  set-entry template (ADR-0006), not re-offered as a picker on every set: the
  set-entry form shows exactly the load input and volume control the
  template says, and nothing else, by default — for a fresh exercise, that's
  Weight + Reps. Changing the template (including switching to Band/
  Bodyweight/Free text/None, or to Duration/Distance, or turning effort
  tracking on) happens through the exercise's own menu, with a warning that
  it changes what a *new* set defaults to going forward; it never touches an
  already-recorded set (ADR-0006 — supersedes this FR's earlier per-set
  override wording).
- Weight uses the numeric keypad by default (`inputMode="decimal"`) with no
  dedicated quick-increment buttons — entering a value directly is the whole
  interaction. Reps are chosen with a scrollable wheel (1 to 100, plus an
  unset position for a load-only set); the wheel itself is the quick-increment
  mechanism, so it carries no separate ± buttons either. Duration and distance
  keep a numeric field with quick increments (configurable defaults).
- A set has no confirm step: it is recorded the moment the user's own edit
  to the load, volume, or effort control makes it valid (§3.3's "either load
  or volume present" rule) — there is nothing to tap for a freshly-entered
  value (ADR-0007, supersedes this FR's earlier "confirming is one tap"
  wording below). A row that is merely pre-filled and still untouched does
  nothing on its own — see the next bullet for how an identical repeat
  still works in one tap.
- Bands are picked from a user-owned, reorderable list with free labels.
- Free text accepts up to 40 characters and autocompletes from what has already
  been used for that exercise.
- An exercise entry holds any number of sets in the same session (e.g. three
  working sets at increasing load). There is no single "the load and reps"
  field for an exercise — each set is its own record, and the heaviest one,
  the best one, or a session total is a computation over that entry's sets
  (§5), never a fact entered separately.
- **(ADR-0007, superseded in turn by ADR-0010 below)** Adding a set defaults
  to the previous set's values (unchanged), but "confirming is one tap" no
  longer names a general confirm control — there is none. Recording an
  *identical* repeat of the previous set (the pre-filled row, untouched) is
  still one tap, on a control explicitly labelled for that ("Repeat last
  set"), never a generic "confirm"/"Add set" action offered on every set.
- **(ADR-0010, supersedes both bullets above)** Adding a set has an explicit
  Confirm ("Add set") button again — no field edit, alone, records anything.
  The button stays disabled, with a status line naming exactly what is
  still missing, until every field the exercise's *current* template
  actually tracks is filled (not merely "a load or a volume" — the loosest
  case a `Set` can legally hold, per §3.3, which is no longer enough to
  enable Confirm when the template tracks both a load and a volume kind).
  "Repeat last set"/"Log this set" are retired: a pre-filled row is simply
  already valid, so Confirm is enabled immediately and one tap still
  suffices for an identical repeat, matching this FR's original "one tap"
  intent without a separately-labelled control. Editing an already-recorded
  set in place (new — spec 001 never had this) uses the same form and the
  domain-minimum rule (a load or a volume present) rather than the fuller
  per-field requirement, since it starts from an already-valid set.
- **(ADR-0012)** The Confirm button gets a Cancel button alongside it in
  every mode, not only when editing an already-recorded set: opening the
  add-set form (whether from "+ Add set" or an entry's own default-open
  state) no longer commits the user to entering a value — Cancel closes it
  back to the "+ Add set" button without saving, even for an exercise
  entry that has no sets logged yet.
- **(ADR-0012)** A set's summary shows only the data actually entered for
  it: an exercise whose template's load type is None has no load field to
  begin with, so its sets' summaries show no load placeholder at all
  (previously a "—" dash, read as if a value were missing rather than
  simply not applicable).
- **(ADR-0013, restyles the bullet above)** A set's summary is one compact
  line — volume and load combined (e.g. "8 x 70kg"), with the effort word
  appended when recorded (e.g. "8 x 70kg - Light") — instead of separate
  load/volume/effort fields, to fit more sets on screen at once. The row's
  own left edge is painted in the same success/warning/danger tone as the
  effort control already uses for its own graduated 1–5 scale
  (`docs/design.md` §1.2's refinement note) when a set has an effort
  recorded, and left plain when it doesn't.

### FR-4 — Effort `[v1]`

- Record a set's effort with a compact scrollable control on a 1–5 scale
  (ADR-0003) — one gesture to reach an adjacent level, an explicit "not
  recorded" position rather than a level always pre-selected.
- The effort control only appears for an exercise whose template tracks
  effort (`trackEffort`, ADR-0006) — off by default for every exercise, on
  a per-exercise basis, via the same template editor FR-3 describes.
- Recording it is optional on every set.
- The scale always shows its meaning in words, never the number alone (§7.4).

### FR-5 — Exercise catalogue `[v1]`

- Fully custom names; no closed list is imposed.
- Per-exercise aliases ("hip thrust" = "glute bridge") honoured by search.
- Each exercise may carry a movement pattern and muscle groups; both optional,
  but required for aggregate insights (§5.5) — the app says so when they are
  missing.
- Every exercise has a discipline (§1.4); in v1 every exercise is Strength,
  and there is no user-facing discipline picker — the field exists in the
  data so a future discipline (D8) is additive, not a rework.
- Merge duplicates from the catalogue screen.
- **(ADR-0010)** The catalogue screen (`/exercises`) also creates a brand-new
  exercise directly — name plus its set-entry template (load type, volume
  kind, whether effort is tracked — ADR-0006) together, the same controls
  the template editor itself uses — and edits an existing exercise's
  template from its own management panel, not only from a per-entry menu
  on the logging/session-detail screens (which keep that shortcut too).

### FR-6 — Diary / history `[v1]`

- Reverse-chronological list of sessions, grouped by month.
- Each session summarised in one line: date, main exercises, and what kind
  of work it was (derived from the exercises logged — e.g. their movement
  patterns or, once a second discipline exists per §1.4, their discipline —
  never a separately-entered field). **(ADR-0011)** Set count is dropped
  from this line, and from a block's own summary line in the logging/
  session-detail screens (FR-2) — a flatter, less numbers-heavy summary was
  preferred; the actual sets themselves are still shown in full, just
  never counted in a header line above them.
- Session detail view, editable after the fact.
- Search by exercise name (substring and typo-tolerant, the same matching
  FR-7 uses) to filter the list to sessions that logged that exercise
  (ADR-0009 — supersedes the original "jump to a specific date").
- Sessions can be selected in bulk — entered by a sustained press on a
  session row, or by tapping a row's own leading icon (which both enters
  selection mode and selects that row, Gmail's tap-the-avatar pattern,
  ADR-0009 — supersedes the original explicit "Select sessions" control) —
  which marks a row selected and replaces the primary logging action with
  a floating bar offering Cancel and Delete for the current selection. A
  normal tap (or, once selection mode is active, Enter/Space on a focused
  row) toggles that row into or out of the selection instead of opening
  it; deselecting the last selected row exits selection mode
  automatically. Deleting a selection removes those sessions and is
  undoable for at least 5 seconds (the same guarantee FR-004 makes for a
  set, exercise, or block), restoring every deleted session exactly as it
  was — including when a session's own delete failed to reach storage (the
  deletion never actually happened; the row simply reappears once that's
  known) and independently of any other delete/undo in progress at the
  same time.

### FR-7 — Exercise search `[v1]`

- Search by name and alias, case- and accent-insensitive, tolerant of typos and
  partial matches.
- Results in under 100 ms for catalogues of up to 500 exercises.
- The search index is derived and rebuildable (invariant 3).

### FR-8 — Exercise progression `[v1]`

One screen, two representations of the same thing. Scoped to the Strength
discipline (§1.4) in v1 — its metrics (e1RM, tonnage) are defined in §5 for
`Weight` loads specifically. A future discipline's own progression metric
(e.g. best time over a fixed swim distance) is a separate, later decision
(D8), not an extension bolted onto these metrics.

- **List:** one row per session with date, best working set, load, volume,
  effort and set count. Reverse chronological, linking to the full session.
- **Chart:** one metric over time, selectable between estimated 1RM, top load,
  session tonnage, and reps at a fixed load.
- Selectable range: 3 months, 6 months, 1 year, all.
- Personal records are marked visually in both representations.
- For band or free-text loads the app shows no estimated 1RM: it offers the
  metrics that do apply and explains in one sentence why (degrade honestly).

### FR-9 — Insights `[v1]`

Cards with global conclusions across the whole set of exercises.

- Each card carries: the claim in plain words, the number behind it, the periods
  compared, and how many sessions support it.
- Each card links through to the raw data that produced it.
- No card is shown unless the data-sufficiency thresholds in §5.7 are met.
- When nothing has enough data, the section explains what is missing ("log this
  exercise 3 more times to see its trend") rather than appearing empty.
- Card types in v1: per-exercise progress, per-pattern/group progress, recent
  records, detected plateau, consistency, push/pull balance.

### FR-10 — *(removed)*

Body composition tracking was scoped for v1 and then removed: this
application covers exercises and training metrics only, never body
measurements. See Decision D10. The ID is retained, unassigned, so existing
cross-references elsewhere in the codebase are not renumbered.

### FR-11 — Settings `[v1]`

- Default unit (kg/lb), quick increments, theme (light / dark / system),
  first day of the week.
- Band catalogue management.
- Data section: export, import, delete everything (double confirmation).

### FR-12 — Export and import `[v1]`

- Export all data to an open, self-describing file carrying a schema version.
- Additional tabular export for spreadsheets.
- Import a previously exported file, with a preview of what will be added or
  replaced before anything is applied.
- A file whose schema version is newer than the app understands is rejected with
  a clear message; it is never read partially.

### FR-13 — Session templates `[v1.1]`

Save a session as a template and start from it. The only planned concession
towards planning, and still prescribes nothing.

### FR-14 — Share as image `[later]`

Generate a shareable image summarising training content, for use outside the
app (e.g. posting to Instagram). A one-way, on-device export — not a social
feature (D13): no account, no in-app sharing, no third-party posting API, no
peer visibility. The same shape as FR-12's export, with a visual artifact
instead of a data file.

- Offered from two entry points: (a) an optional prompt shown when the user
  leaves the logging screen having confirmed at least one set that session —
  a session has no discrete "save" step to hook this to (FR-1) — with a
  "don't show again" preference the user can set permanently (§11 settings);
  (b) on demand, at any time, from the session detail view's menu.
- Before the image is generated, the user picks one of three content types:
  - **Session summary** — the exercises performed and headline numbers (e.g.
    tonnage, set count). Not offered when the session has too many exercises
    for the text to stay legible in the image.
  - **A single highlight** — one exercise or personal record called out
    prominently (e.g. "130kg in Hip Thrust!").
  - **A stat** — either a training-consistency calendar (a summary of which
    days were trained) or an exercise's progression chart over the last 6
    months or the last year, reusing FR-8's own chart but gated by the
    per-exercise-progress data-sufficiency threshold FR-9/§5.7 already
    defines for Insights — FR-8's own chart carries no such threshold.
  - Every content type considers Strength-discipline (§1.4) exercise
    entries only; a session that also contains a later-added non-Strength
    entry excludes it from every number shown and says so, rather than
    mixing disciplines into one figure.
- Every number shown on the image comes from an existing computation (§5,
  FR-8, FR-9); this feature introduces no new metric (Principle VI).
- The image's visual style follows the app's design tokens and is easily
  recognisable as coming from the app; the app's name appears small along the
  bottom edge.
- Ships with one aspect ratio (1:1, square); other ratios (e.g. a 9:16 story
  format) are a later extension, not this feature.
- Generation is entirely on-device; the only hand-off is the platform's
  native share sheet or a saved file — never a direct API call to a
  third-party platform (Principle IV, Invariant 1).

### FR-15 — Exclude an exercise from progression/Insights `[later]`

Let the user mark an Exercise (e.g. a warm-up or mobility movement) as one
whose progress is never worth measuring, so FR-8 and FR-9 stop computing
and offering a trend for it. Drafted, not yet built or scheduled —
`specs/008-exercise-progression-opt-out/spec.md` (D19).

- A new field on the catalogue `Exercise` (§3.1) marks it excluded from
  progression tracking — additive, defaulting to "included" for every
  existing exercise, so nothing already logged changes behavior on
  upgrade. A schema change under §6/Principle III, not a display-only
  toggle.
- An excluded exercise is skipped by every FR-9 card computation (all six
  types) and by FR-8's own personal-record marking; it can still be
  logged normally (FR-1/FR-3) and still appears in the diary (FR-6) and
  exercise search (FR-7) — exclusion only turns off progress *measurement*,
  never recording.
- Toggled from the exercise catalogue screen (FR-5), alongside its other
  per-exercise management actions.

---

## 5. Computation rules

Every number shown to the user is defined here, is deterministic, and is
testable. An insight that cannot be written as an explicit rule is not built.

### 5.1 Working set

A set not marked as warm-up and with recorded volume. Progression computations
use working sets only.

### 5.2 Estimated 1RM (e1RM)

- Epley: `load × (1 + reps / 30)`.
- Only for `Weight` loads, and for `Bodyweight` with a numeric added load.
- Only for sets of 1 to 12 reps; outside that range the value is not used.
- An exercise's e1RM for a day is the maximum across its valid working sets.
- The chosen formula is recorded in an ADR and surfaced in the app when the
  metric is tapped.

### 5.3 Tonnage

`sum(load × reps)` across working sets with numeric load. For non-numeric loads,
volume is counted as total reps and labelled as such.

### 5.4 Exercise trend over a window

1. Take the daily e1RM values inside the window.
2. Compare the median of the first three with the median of the last three.
3. Percentage change = `(final − initial) / initial × 100`, rounded to an
   integer.

Medians rather than single values, so one bad day cannot drive the conclusion.

### 5.5 Aggregate trend by pattern or muscle group

- The mean of the percentage changes of the exercises in that pattern that clear
  the data minimum, weighted by each exercise's session count.
- Requires at least 2 distinct exercises with sufficient data.
- Intended example: "leg strength" from squat and deadlift.

### 5.6 Insight wording

Each card's text is a fixed template filled with the computed numbers. No
generative model is involved: the right primitive for "compare two medians" is a
subtraction, and generated prose could not guarantee that the number shown and
the underlying data agree.

### 5.7 Data sufficiency

Default thresholds, changeable only through a recorded decision:

| Insight | Minimum |
|---------|---------|
| Exercise trend | ≥ 6 sessions with that exercise and ≥ 21 days of span within the window |
| Aggregate trend | ≥ 2 exercises meeting the above |
| Plateau | ≥ 6 sessions in 8 weeks and absolute change < 2 % |
| Consistency | ≥ 4 weeks of history |
| Push/pull balance | ≥ 20 classified working sets in the window |

Below the threshold there is no "approximate" version: there is nothing.

---

## 6. Data and schema

- **Source of truth:** the canonical records (sessions, catalogue, measurements)
  in local storage. Search index, progression aggregates, insights and chart
  caches are derived, and are rebuilt on launch if missing or stale.
- **Schema version:** stored alongside the data. On open:
  - older version → migrate automatically and record the migration;
  - same version → open;
  - newer version → write nothing and explain that the app is out of date.
- **Format changes:** any change to the persisted schema bumps the version and
  ships with its ADR and a tested migration.
- **Scope of "persisted schema":** the version-bump rule above, and
  constitution Principle III, protect the canonical entities in §3.1 (and
  the Load/Volume/Effort value objects that shape them) — the data a schema
  version and migration exist to keep readable across app updates. Settings
  and other per-device preference state (§11) are stored but are not part
  of this canonical schema: adding, renaming, or removing a Settings field
  needs no version bump, ADR, or migration — a missing field simply
  defaults (D14).
- **Recoverable writes:** after an interruption, launch reconciles from the
  source of truth; derived data is discarded and regenerated.
- **Interchange format:** documented, versioned, and free of opaque internal
  identifiers wherever a readable form exists.

---

## 7. Non-functional requirements

### 7.1 Performance

- Launch to interactive under 1.5 s on a mid-range device.
- Every logging interaction responds immediately: the UI updates first, the
  write is confirmed after.
- Search and insight recomputation never block the interaction path.
- Insights are recomputed incrementally: only what the changed session affects.

### 7.2 Offline

Every v1 feature works with no network. The app shows no connection states and
degrades nothing when offline.

### 7.3 Privacy

No training or body-composition data leaves the device. No content analytics.
Any future outbound call requires a recorded decision, is explicit in the UI,
and can be turned off.

### 7.4 Accessibility

Part of "done", not a final pass:

- Visible focus on everything interactive; the whole app reachable without a
  pointer.
- State is never encoded in colour alone: effort, records and errors carry an
  icon or a word.
- Standard minimum contrast, including secondary text.
- Generous hit targets: the logging screen is usable one-handed and with sweaty
  hands.
- Nothing essential is revealed by hover only.
- Reduced-motion preference honoured without losing information.
- Reviewed in light and dark themes and at a narrow width.

### 7.5 Design and platform

- Both a narrow, one-handed phone layout and a wider layout are first-class
  targets; every screen is reviewed at both widths (`docs/design.md` §6).
- Design tokens are the only source of visual values, with both themes from day
  one.
- Colours named by role, never by hue.
- Hierarchy of primitives → compositions → root; screens consume view models and
  never import persistence types.
- Platform-gated capabilities (file pickers, storage permissions) are requested
  inside a user gesture; background code checks permission and never prompts.
- Copy in second person, present tense, short sentences. Errors state the fact
  then the fix, never blame the user, and carry no error codes.

---

## 8. Decisions

Closed decisions become ADRs at scaffolding time; open ones must be closed
before code.

| ID | Decision | Status |
|----|----------|--------|
| D1 | Single project language for all artifacts | **Closed:** English everywhere. → ADR-0001 |
| D2 | Target platform and storage architecture | **Closed:** Progressive Web App, one web codebase; storage is one port with two adapters (File System Access API, IndexedDB) chosen at runtime via feature detection. → ADR-0002 |
| D3 | Effort scale | **Closed:** store a single integer effort level 1–5 as the canonical value, shown with its meaning in words. Chosen over RPE 1–10 / RIR because effort feeds no computation in v1 (§5 runs on e1RM, not effort) and a coarser, one-tap scale is more likely to actually get used. → ADR-0003 |
| D4 | Default unit, and whether mixed units are allowed in history | **Closed** for FR-1 to FR-5: kg by default; store the unit as entered, convert only for display. → `specs/001-log-a-session/spec.md` Clarifications |
| D5 | e1RM formula | **Closed:** Epley, for simplicity and explainability; its weakness at high reps is why the rule caps use at 12 reps (§5.2). → ADR-0004 |
| D6 | Multiple sessions per day, and session lifecycle | **Closed** for FR-1 to FR-5: multiple sessions per day are allowed and each is fully independent. A session has no open/closed state — its date-time is fixed at creation (when the logging form opens, user-editable) and there is no auto-resume; an unsubmitted form is kept as a single UI draft, not a Session. → `specs/001-log-a-session/spec.md` Clarifications |
| D7 | Whether FR-13 (templates) is v1 or v1.1 | **Closed:** v1.1, to keep the logging critical path clean. |
| D8 | Which exercise disciplines beyond Strength (§1.4) are in scope, and when | **Closed:** MVP and v1 ship Strength only. Swimming (distance + time, no load) is the first discipline added beyond Strength, targeted at v1.1 → ADR-0006. Running, and any discipline beyond swimming, remains open and needs its own future decision — swimming's shipped implementation does not pre-approve it. |
| D9 | Whether the app ships a seed exercise catalogue | **Closed:** yes — a seed set of common strength exercises is present from first launch so there is no empty state on the logging critical path; seed entries are ordinary editable catalogue entries and the list is app-bundle data, not persisted schema. → ADR-0005 |
| D10 | Whether the app tracks body composition (weight, body fat, etc.) | **Closed:** no — removed from scope entirely, in any version. This application is exercises and training metrics only; it never records body measurements. FR-10 (previously "Body composition") is retired; its ID is left unassigned rather than renumbering the FRs after it. |
| D11 | What happens to a Set's history when an exercise's set-entry template changes | **Closed:** nothing — the template (default load type, default volume kind, whether effort is tracked) only decides what a *new* set defaults to; every already-recorded Set keeps exactly what it was given, no reconciliation or deprecation. Schema v2. → ADR-0006 |
| D12 | Whether recording a set requires an explicit confirm step | **Superseded by D17 below.** Originally closed as no — see ADR-0007's own text for that reasoning, no longer current. → ADR-0007, superseded by ADR-0010 |
| D13 | Whether generating a shareable image for external platforms (e.g. Instagram) falls under the constitution's "social network" non-goal | **Closed:** no — it is a one-way, on-device export (render an image locally, hand off via the platform's native share sheet or a saved file), not a multi-user or in-app social feature. No account, no backend, no peer visibility, no third-party posting API; consistent with Invariant 1 (nothing leaves the device without the user explicitly choosing to send it). Targeted at the "Later" phase (§9), not MVP/v1/v1.1. → FR-14 |
| D14 | Whether adding a field to Settings (per-device preference state, not a canonical entity) requires the §6/Principle III schema-version-bump-and-migration treatment | **Closed:** no — that treatment applies only to the canonical entities in §3.1 (Session, Block, Exercise entry, Set, Exercise catalogue). A Settings field defaults silently when absent: no version bump, no ADR, no migration. Matches the precedent already set in `specs/006-settings-data/spec.md`; §6 amended below with this scope note so future specs don't re-litigate it. |
| D15 | Whether a Block can carry a target round count, and what it means | **Superseded by D20 below.** Originally closed as yes — see ADR-0008's own text for that reasoning, no longer current: the field is removed. → ADR-0008, superseded by ADR-0013 |
| D16 | Whether a workout (the logging draft) becomes a Session automatically, or only when the user explicitly says so | **Closed:** explicitly — an explicit "Log workout" action is the only way a draft becomes a Session; the previous automatic day-rollover promotion is removed. Recording a *set* is unaffected — this decision is scoped to the session-level "commit to the diary" step only. A draft with no exercise at all is never persisted; a draft with at least one exercise persists and, if left unregistered, is offered (never auto-loaded) as a recovery banner the next time the logging form opens. No schema change: `LoggingDraft`'s shape and the storage port are unaffected. "One draft per training type" is not built by this decision — it collapses to the single existing draft, since only the Strength discipline is implemented today (D8). _(Threshold amended by ADR-0011 from "at least one block" to "at least one exercise": the form now always seeds one block, so a bare block is no longer a signal of intent.)_ → ADR-0009, ADR-0011 |
| D17 | Whether recording a set requires an explicit confirm step (reopens D12); whether an already-recorded set can be edited in place; whether the per-exercise progression view (FR-013) stays reachable from a session detail view; whether the `/exercises` screen can create a new catalogue Exercise and edit an existing one's set-entry template | **Closed, all together (one design-refinement pass):** (1) Confirm is explicit again — a set commits only on an explicit "Add set"/"Save changes" tap, enabled only once every field the exercise's current template tracks is filled; the auto-commit-on-edit behavior and its "Repeat last set"/"Log this set" controls (D12/ADR-0007) are retired. (2) A `Set` can now be edited in place (load/volume/effort), not only added or deleted — new capability, still no schema change (`Set`'s shape is unaffected; only *how* one is produced changes). (3) A session detail view's per-exercise entries no longer link to the progression screen — for now, that stays reachable only from search results (spec 004 FR-013) and Insights (spec 005); FR-013 is amended accordingly, not removed (the progression screen itself, and its other two entry points, are unaffected). (4) The `/exercises` screen (spec 004 FR-5) gains "New exercise" (name + set-entry template together) alongside its existing rename/merge/delete, and its management panel gains "Edit tracked fields…" (ADR-0006) for an existing exercise — previously only reachable per-entry from the logging/session-detail screens. No schema change for (3) or (4) either — purely which screens link where, and use-cases (`createExercise`, `updateExerciseTemplate`) both already existed. → ADR-0010 |
| D18 | Whether an exercise entry can exist without belonging to any block (the "loose" block) | **Closed:** no — every exercise entry always belongs to a real block; the draft-only "loose" flag that used to render a blockless exercise without block chrome is removed. It caused a real bug: the flag was never part of the persisted `Block` shape, so a blockless exercise silently gained block chrome the moment the session was saved and reopened. The logging form now opens with one empty block already present, and each block (including that first one) carries its own "add exercise" control; "Add block" below the last block still adds more. No schema change — `Block` never had a "loose" concept to begin with. → ADR-0011 |
| D19 | Whether excluding an exercise (e.g. a warm-up) from FR-8/FR-9's progression and Insights computations warrants its own spec, rather than a quick change inside spec 004/005 | **Closed:** yes, its own spec — this is a new, additive field on the canonical `Exercise` entity (§3.1), so it needs the §6/Principle III schema-version-bump-and-migration treatment spec 004/005 themselves didn't need to reopen; it also changes eligibility filtering inside both FR-8 (personal records) and every one of FR-9's six card types, and has its own open questions (e.g. whether an excluded exercise's progression screen stays manually reachable) that deserve their own Acceptance Scenarios rather than being folded silently into either existing spec. Targeted at the "Later" phase (§9), pending its own scheduling decision — drafted, not yet built. → FR-15, `specs/008-exercise-progression-opt-out/spec.md` |
| D20 | Whether a Block should still carry a target round count (reopens D15) | **Closed:** no — removed entirely. Redundant with each exercise entry's own set count, which already says how many times it was actually done; a separate block-level "planned rounds" number added nothing FR-2's exercise-level data didn't already show, and one less field to edit is one less thing to keep in sync with what was actually logged. No replacement field, no migration for the field's removal (an old stored `rounds` value, if any, is simply never read again — the same reasoning ADR-0008's own no-op v2→v3 migration already established for its *absence*). → ADR-0013 |

---

## 9. Scope by phase

- **MVP** — the smallest slice that closes the mission loop end to end: log a
  set fast (FR-1 to FR-5) and see it again as evidence of progress (FR-6 to
  FR-8). Concretely: FR-1 (log a session), FR-2 (blocks), FR-3 (sets and
  load), FR-4 (effort), FR-5 (exercise catalogue), FR-6 (diary/history),
  FR-7 (exercise search), FR-8 (exercise progression, Strength only). This
  is deliberately smaller than v1 below — it excludes insights and
  settings/export, both of which are useful but not required to prove the
  core loop works. FR-1 to FR-5 are already specified
  in `specs/001-log-a-session/spec.md`; FR-6 to FR-8 are the next spec to
  write (see the tracking issue for this decision).
- **v1** — MVP + FR-9 (insights), FR-11 (settings), FR-12 (export/import). A
  complete, useful application on its own, still Strength-only (§1.4). Body
  composition (formerly planned as FR-10) is not part of this or any
  version — see Decision D10.
- **v1.1** — FR-13 templates; extra progression metrics; a quick-log widget
  or shortcut; swimming as the first non-Strength discipline (§1.4, D8 →
  ADR-0006) — its own feature spec, computation rule and schema migration,
  not yet written. Running, or any discipline beyond swimming, is still an
  open question (§8) pending its own future decision.
- **Later, only with a recorded decision** — multi-device sync, import from
  other apps, report export, further exercise disciplines beyond the first
  one added under v1.1, sharing training content as an image for external
  platforms (FR-14, D13), and excluding an exercise from progression/
  Insights tracking (FR-15, D19).

---

## 10. Future directions (not committed)

Ideas raised for possible consideration well past v1.1. They are captured
here so they aren't lost, not because they are scoped, planned, or ready to
build. They are **not** requirements and **not** MVP/v1/v1.1 scope (§9).
Nothing below is designed into the domain model, the FRs, or any spec — each
would need its own scoping decision, its own domain model work, and its own
review against the invariants in §1.2 before a single FR gets written for it.

- **Peer comparison.** Seeing a friend's activity and comparing progress
  across exercises. Needs shared identity and a way for one user's data to
  reach another's device — today's local-first-by-default model has no place
  for that yet. The most demanding of the three on the connected-mode
  invariant (§1.2): it inherently exposes one user's data to another, so it
  would need the clearest opt-in and consent story of the three.
- **Coach / gym-owner private groups.** A trainer creates a private group;
  members join it (potentially under a visible username distinct from their
  real name, for privacy); the trainer defines exercises for the group so
  members see them recommended; the trainer can see members' training data.
  Probably the most plausible privacy shape of the three — opt-in, scoped to
  a group, a coach seeing only what a member logs under that group's context
  — but still fundamentally multi-user: it needs accounts, a backend, and a
  consent/visibility model (what exactly a coach can see, whether a member
  can leave and revoke access, whether access is retroactive or only
  forward-looking) that doesn't exist today.
- **Coach-assigned workouts.** A trainer defines a workout that appears
  directly to assigned users, who then log reps/weight against the trainer's
  defined exercises. For the solo user the app remains a recorder, not a
  prescriber (§1.3) — this only becomes coherent as a distinct, opt-in coach
  mode layered alongside that, not a change to how the app behaves for
  someone training on their own.

If any of these is ever pursued, it needs, in order: its own recorded
decision confirming it's in scope, scoped as an opt-in mode that coexists
with — rather than replaces — the current single-user, local-first-by-default
guarantees for anyone who doesn't opt in; its own domain model work (group
membership, roles, visibility and consent rules) before any FR is written for
it; and its own review against every invariant in §1.2. None of that work is
started by this section — it exists only to record that the idea was raised
and roughly what it would take.
