# Training Diary — Functional Requirements

**Status:** draft for review. The decisions in §8 marked *open* must be closed
before any code is written. This document is the source of truth for *what* the
app does; the *how* lives in the stack document and in the decision records
(ADRs).

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

1. **The data belongs to the user and lives on their device.** No mandatory
   account, no backend in v1, no user content sent to third parties. Everything
   is exportable in an open, readable format.
2. **Logging is the critical path and always works.** Recording a set in the
   middle of the gym, offline, one-handed, must be immediate: no Save button, no
   waiting, no dialogs.
3. **Everything derived is recomputable.** Progressions, insights, search
   indexes and chart data are computed from the canonical records. They can be
   deleted wholesale and regenerated with no loss.

### 1.3 Non-goals

An explicit list of what the app is not. Anything landing here is refused or
turned into a recorded decision.

- Not a social network: no profiles, followers, likes or sharing.
- Not a program prescriber: it records what you did, it does not tell you what
  to do.
- Not a calorie counter or nutrition tracker.
- Not a generative-AI coach: insights are deterministic, explainable
  computations, not generated text (§5.6).
- Not a cloud service: no multi-device sync in v1.
- Not a wearable companion: no heart-rate monitors or sensors in v1.

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
| S6 | Track body composition | After weighing in | Record weight/fat/muscle in ≤ 15 s and see the trend |
| S7 | Take my data with me | New phone, distrust, curiosity | Export everything to an open file and import it back |

---

## 3. Domain model

One vocabulary, used identically in code, UI and documentation.

### 3.1 Entities

- **Exercise (catalogue).** Canonical name, aliases, movement pattern, muscle
  groups, default load type, unilateral flag. The catalogue belongs to the user:
  they can create, rename and merge entries.
- **Session.** A training day: date, ordered list of blocks, free-form notes,
  optional overall feeling, optional duration. More than one session per day is
  allowed.
- **Block.** An ordered grouping inside a session: optional name ("Superset A",
  "Legs"), type (straight sets / superset / circuit), and an ordered list of
  exercise entries.
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
- **Effort** — RPE on a 1–10 scale in half-point steps, stored as the single
  canonical value (ADR-0003). Optional: a set with no effort recorded is valid
  and does not invalidate its load computations.

### 3.3 Domain rules

- A set with neither volume nor load is not stored; with either one, it is.
- Renaming an exercise never breaks history: references are by identifier, never
  by name.
- Merging two exercises reassigns every set to the survivor and keeps the merged
  name as an alias.
- Deleting a catalogue exercise that has history requires explicit confirmation
  and offers merging instead.
- Units are stored exactly as entered; conversion is a presentation concern,
  never a storage one.

---

## 4. Functional requirements

Each requirement carries verifiable acceptance criteria. `[v1]` ships in the
first version; `[v1.1]` and `[later]` are subsequent scope (§9).

### FR-1 — Log a session `[v1]`

Create today's session and add blocks, exercises and sets.

- On open, an unfinished session from today is resumed; otherwise a new one
  starts in a single tap.
- Adding an exercise opens the catalogue search with most-used and recent
  entries first; a new exercise can be created from the same field.
- Every change persists automatically. There is no Save button.
- Every destructive action (delete set, exercise, block) is undoable from the
  same screen for at least 5 seconds.
- Closing the app at any moment loses nothing that was entered.

### FR-2 — Blocks `[v1]`

- Create, rename, reorder and delete blocks within a session.
- Reorder exercises within a block and across blocks.
- An unnamed block is shown by its position, not as "Untitled".

### FR-3 — Sets and load `[v1]`

- Adding a set defaults to the previous set's values for that exercise (same
  load, same reps), so confirming is one tap.
- Load type is chosen per exercise and remembered; it can be overridden per set.
- The numeric keypad appears by default on numeric fields, with quick increments
  (± 2.5 kg, configurable).
- Bands are picked from a user-owned, reorderable list with free labels.
- Free text accepts up to 40 characters and autocompletes from what has already
  been used for that exercise.

### FR-4 — Effort `[v1]`

- Record a set's effort with a one-tap control.
- Recording it is optional on every set.
- The scale always shows its meaning in words, never the number alone (§7.4).
- Settings offer entering effort as RIR; it is converted on entry and stored as
  RPE, keeping one source of truth.

### FR-5 — Exercise catalogue `[v1]`

- Fully custom names; no closed list is imposed.
- Per-exercise aliases ("hip thrust" = "glute bridge") honoured by search.
- Each exercise may carry a movement pattern and muscle groups; both optional,
  but required for aggregate insights (§5.5) — the app says so when they are
  missing.
- Merge duplicates from the catalogue screen.

### FR-6 — Diary / history `[v1]`

- Reverse-chronological list of sessions, grouped by month.
- Each session summarised in one line: main exercises and set count.
- Session detail view, editable after the fact.
- Jump to a specific date.

### FR-7 — Exercise search `[v1]`

- Search by name and alias, case- and accent-insensitive, tolerant of typos and
  partial matches.
- Results in under 100 ms for catalogues of up to 500 exercises.
- The search index is derived and rebuildable (invariant 3).

### FR-8 — Exercise progression `[v1]`

One screen, two representations of the same thing.

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

### FR-10 — Body composition `[v1]`

- One screen to record: weight, fat %, muscle %, date, notes.
- Every field except weight and date is optional.
- Charts for weight, fat and muscle with a range selector, including a 7-day
  moving average for weight.
- Derive and show fat mass and lean mass in kg when a percentage is present.
- No targets, no judgements, no alarm colours on these figures.

### FR-11 — Settings `[v1]`

- Default unit (kg/lb), effort input mode (RPE/RIR), quick increments, theme
  (light / dark / system), first day of the week.
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

- Both platforms are first-class targets; every screen is reviewed on both.
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
| D2 | Target platforms | **Closed:** cross-platform, iOS and Android from a shared codebase. The concrete framework and the rest of the stack remain open → ADR-0002 |
| D3 | Effort scale | **Closed:** store RPE 1–10 in half-point steps as the canonical value; RIR is an input mode converted on entry. Chosen over a 3-level scale because trend detection needs resolution, and over storing both because one fact gets one source of truth. → ADR-0003 |
| D4 | Default unit, and whether mixed units are allowed in history | Open. Recommendation: kg by default; store the unit as entered, convert only for display |
| D5 | e1RM formula | Open. Recommendation: Epley, for simplicity and explainability; record its weakness at high reps |
| D6 | Multiple sessions per day | Open. Recommendation: allow them; simpler model, matches reality |
| D7 | Whether FR-13 (templates) is v1 or v1.1 | Open. Recommendation: v1.1, to keep the logging critical path clean |

---

## 9. Scope by phase

- **v1** — FR-1 to FR-12. A complete, useful application on its own.
- **v1.1** — FR-13 templates; extra progression metrics; a quick-log widget or
  shortcut.
- **Later, only with a recorded decision** — multi-device sync, additional body
  measurements (girths, photos), import from other apps, report export.
