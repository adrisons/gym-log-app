# Feature Specification: Insights

**Feature Branch**: `005-insights`

**Created**: 2026-09-12

**Status**: Planned

**Input**: User description: "Insights (Phase 5, v1). Covers
docs/requirements.md FR-9: deterministic, explainable global-conclusion
cards across the whole exercise set — never generative text (constitution
Principle VI, §5.6's fixed-template wording). Six card types, all
read-only application-layer derivations over the existing StoragePort
(listSessions, listExercises) — no new adapter, no new port method, no
persisted insight cache (constitution Principle I: derived data,
rebuildable, never a second source of truth): (1) Per-exercise progress —
for each e1RM-eligible exercise, the §5.4 trend over a trailing 90-day
window: median of the first three daily e1RM values vs median of the last
three, percentage change rounded to an integer, shown only when §5.7's
threshold is met. (2) Per-pattern/muscle-group progress — §5.5's
aggregate: the session-count-weighted mean of the per-exercise percentage
changes for exercises sharing a movement pattern or a muscle group, shown
only when ≥2 distinct exercises in that group clear card 1's own
threshold. (3) Recent records — exercises whose current all-time-best
value for a progression metric (reusing spec 004's exact personal-record
definition) was achieved within a trailing 30-day recency window. (4)
Detected plateau — per e1RM-eligible exercise, the same §5.4 trend
computation but over a fixed 8-week window, flagged when ≥6 sessions
occurred in those 8 weeks and the absolute percentage change is under 2%.
(5) Consistency — how regularly the user has trained, shown only with ≥4
weeks of history. (6) Push/pull balance — the distribution of working sets
between push and pull movement patterns, shown only with ≥20 classified
working sets in the trailing 90-day window; movement pattern is free-text
and optional with no fixed vocabulary anywhere in the codebase yet, so
classifying a set as push/pull needs an explicit, documented default.
Every card states its claim in plain words filled from a fixed template,
the number behind it, the time period(s) the number covers, and how many
sessions support it; links through to the underlying data; and is never
shown below its data-sufficiency threshold — when a card's threshold
isn't met, the Insights section explains what's missing rather than the
card silently disappearing. Thresholds are fixed defaults per §5.7, not
user-configurable. Builds on spec 001, spec 003, and spec 004 (the
e1RM/tonnage/best-working-set/personal-record computations in
src/application/progression/, directly reused here) — this spec adds one
new presentation-layer Insights screen/section and pure application-layer
aggregation logic across multiple exercises, never a single-exercise view.
Out of scope for v1: any card type or computation applied to a future
non-Strength discipline. Closes docs/agent-brief.md Phase 5."

## Context *(mandatory)*

Specs 001-004 built the whole "log it, then look at it" loop: recording a
session (spec 001), making it durable (spec 003), and reading it back —
diary, search, and one exercise's own progression (spec 004). None of
that yet answers `docs/requirements.md` scenario S5, "Understand whether
I'm improving," at the level a monthly review actually needs: a glance
across the *entire* training history, not one exercise at a time. FR-9
(Insights) closes that gap with six card types — deterministic
conclusions computed from the same canonical Session/Exercise records
everything else already reads, never a generated summary (constitution
Principle VI). This spec introduces no new domain entity, no new
`StoragePort` method, and no persisted cache: every card is recomputed
from `listSessions`/`listExercises` each time the screen is viewed
(`docs/requirements.md` §6), and every single-exercise computation this
spec needs — e1RM eligibility, the Epley formula, tonnage, and the
personal-record definition — already exists in `src/application/
progression/` from spec 004 and is reused, not re-derived. What is new
here is aggregation both *within* one exercise's own history at a finer
grain than spec 004 needed (spec 004's e1RM is a per-session maximum;
§5.4's trend needs a per-*day* maximum across however many sessions
happened that day) and *across* exercises (by pattern, by muscle group,
or across the whole catalogue), plus the data-sufficiency gating (§5.7)
that decides, for each card, whether there is enough evidence to say
anything at all.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See whether one exercise is improving (Priority: P1)

A person who has logged the same exercise regularly wants a plain-words
answer to "am I getting stronger at this?" — a percentage, the period it
covers, and how many sessions back it up — without having to open that
exercise's own progression chart and eyeball a trend line themselves.

**Why this priority**: This is `docs/requirements.md` scenario S5's core
case and FR-9's first-listed card type — the single most direct answer to
"am I improving," and the card most people will look for first.

**Independent Test**: Log the same exercise across at least 6 sessions
spanning at least 3 weeks with increasing load, open the Insights screen,
and confirm a per-exercise progress card appears for that exercise with a
correctly computed percentage change, the period it covers, and the
number of supporting sessions; confirm no such card appears for an
exercise logged only 2-3 times.

**Acceptance Scenarios**:

1. **Given** an exercise with e1RM-eligible working sets (per spec 004's
   e1RM eligibility) across 6 or more sessions spanning at least 21 days
   within the last 90 days, **When** the Insights screen is viewed,
   **Then** a per-exercise progress card for that exercise shows a
   percentage change computed per `docs/requirements.md` §5.4 (median of
   the first three daily e1RM values vs the median of the last three,
   rounded to an integer), the period it covers, and the number of
   sessions supporting it.
2. **Given** the same exercise's data, **When** the person taps the card,
   **Then** they are taken to that exercise's own progression screen
   (spec 004) showing the underlying sessions.
3. **Given** an exercise logged only 3 times, or across a span under 21
   days, **When** the Insights screen is viewed, **Then** no per-exercise
   progress card appears for it, and the screen explains what more is
   needed (e.g. "log this exercise a few more times to see its trend")
   rather than silently omitting it with no explanation.
4. **Given** an exercise logged only with `Band` or `FreeText` loads (no
   e1RM-eligible sets), **When** the Insights screen is viewed, **Then**
   no per-exercise progress card is computed for it — the same honest
   degradation spec 004 already applies to that exercise's own e1RM
   metric.

---

### User Story 2 - See recent personal records (Priority: P1)

A person wants to know, at a glance, whether anything they logged
recently was actually their best-ever performance on that exercise —
without checking every exercise's own progression screen for a "PR" mark.

**Why this priority**: FR-9's "recent records" card type; a fast,
motivating answer that reuses spec 004's personal-record definition
directly, at very low additional computation cost once that exists.

**Independent Test**: Log a session that sets a new all-time-best value
(by any of the four progression metrics) for an exercise, open the
Insights screen, and confirm a recent-record entry appears for it; log a
session that does not set a record, and confirm no entry appears.

**Acceptance Scenarios**:

1. **Given** a session logged within the last 30 days whose value for
   some progression metric (estimated 1RM, top load, tonnage, or reps at
   a fixed load) equals that exercise's all-time-best value for that
   metric (spec 004 FR-020's exact personal-record definition, ties
   included), **When** the Insights screen is viewed, **Then** a recent
   records entry names that exercise, the metric, the value, and the
   date.
2. **Given** the same entry, **When** the person taps it, **Then** they
   are taken to that exercise's progression screen with the record
   session visible and marked.
3. **Given** an exercise's all-time-best value was set more than 30 days
   ago, with nothing logged since that ties or beats it, **When** the
   Insights screen is viewed, **Then** no recent records entry appears
   for that exercise.
4. **Given** no session in the last 30 days set or tied any exercise's
   all-time-best value, **When** the Insights screen is viewed, **Then**
   the recent records section explains that nothing new has been set
   recently, rather than appearing empty with no explanation.

---

### User Story 3 - Detect a plateau (Priority: P2)

A person wants to know if an exercise they keep training has actually
stopped moving — flagged automatically, not something they have to notice
themselves by staring at a chart.

**Why this priority**: FR-9's "detected plateau" card type — valuable,
but secondary to knowing whether things are improving (User Story 1) or
what was just achieved (User Story 2); it reuses the same trend
computation as User Story 1 over a different, fixed window.

**Independent Test**: Log an exercise across 6+ sessions within an 8-week
span with an essentially flat load, open the Insights screen, and confirm
a plateau card appears; repeat with a clearly increasing load and confirm
no plateau card appears.

**Acceptance Scenarios**:

1. **Given** an e1RM-eligible exercise with 6 or more sessions within the
   trailing 8 weeks, **When** the `docs/requirements.md` §5.4 trend
   computed over that 8-week window has an absolute percentage change
   under 2%, **Then** a plateau card appears for that exercise, naming
   the exercise, the ~0% change, the 8-week period, and the supporting
   session count.
2. **Given** the same 8-week window, **When** the computed absolute
   percentage change is 2% or more (in either direction), **Then** no
   plateau card appears for that exercise.
3. **Given** an exercise with fewer than 6 sessions in the trailing 8
   weeks, **When** the Insights screen is viewed, **Then** no plateau
   card is computed for it (insufficient data — no explanation is owed
   for a card type that simply doesn't apply yet to a rarely-logged
   exercise, distinct from User Story 1's own explicit non-empty-section
   requirement for its own card type).

---

### User Story 4 - See progress across a movement pattern or muscle group (Priority: P2)

A person wants to know whether a broader area of their training — "leg
strength," "pulling movements" — is moving, not just one exercise at a
time.

**Why this priority**: FR-9's "per-pattern/muscle-group progress" card
type and `docs/requirements.md` §5.5's intended example ("leg strength
from squat and deadlift"); valuable but depends on at least two exercises
each individually clearing User Story 1's own threshold, making it
naturally a step beyond it.

**Independent Test**: Log two different exercises that share a movement
pattern or a muscle group, each individually qualifying for a
per-exercise progress card, and confirm an aggregate card appears for
that shared pattern/group with a correctly weighted percentage.

**Acceptance Scenarios**:

1. **Given** two or more exercises that share a movement pattern (or a
   muscle group) and each individually clear User Story 1's
   data-sufficiency threshold, **When** the Insights screen is viewed,
   **Then** an aggregate progress card for that pattern/group shows the
   session-count-weighted mean of those exercises' individual percentage
   changes (`docs/requirements.md` §5.5), the exercises and sessions
   behind it, and the period covered.
2. **Given** the same card, **When** the person taps it, **Then** they
   see which exercises contributed and can reach each one's own
   progression screen.
3. **Given** only one exercise in a given pattern/group clears User Story
   1's threshold, **When** the Insights screen is viewed, **Then** no
   aggregate card appears for that pattern/group (the §5.5 minimum of 2
   is not met).

---

### User Story 5 - See how consistently I've trained (Priority: P3)

A person wants a plain read on their own adherence — how many of the past
several weeks actually included a session — independent of whether any
particular exercise improved.

**Why this priority**: FR-9's "consistency" card type; valuable for
motivation and self-awareness but the least tied to the "am I getting
stronger" question the higher-priority cards answer directly.

**Independent Test**: Log sessions in some weeks and not others across at
least 4 weeks, open the Insights screen, and confirm the consistency card
reports the correct fraction of weeks trained.

**Acceptance Scenarios**:

1. **Given** at least 4 weeks of training history exists, **When** the
   Insights screen is viewed, **Then** a consistency card reports how
   many of the trailing 12 weeks (or fewer, if the person has trained for
   less than 12 weeks total) included at least one session, and the
   period it covers.
2. **Given** fewer than 4 weeks of history exist, **When** the Insights
   screen is viewed, **Then** no consistency card appears, and the screen
   explains that more history is needed.

---

### User Story 6 - See push/pull balance (Priority: P3)

A person wants to know whether their recent training has leaned heavily
toward pushing or pulling movements, as a rough check against a lopsided
routine.

**Why this priority**: FR-9's "push/pull balance" card type; the lowest
priority of the six because it depends on a movement-pattern
classification this codebase has no fixed vocabulary for yet (the
Exercise catalogue's `movementPattern` field is optional free text, and
no seed catalogue exists in code — `ADR-0005`) — the card degrades to "not
enough classified sets" whenever a person's own pattern naming doesn't
match the fixed keyword list this spec defines (see Assumptions), which
is an accepted, honest limitation rather than a blocker to shipping the
other five card types.

**Independent Test**: Log 20+ working sets across exercises whose
movement patterns are recognizable as push or pull (e.g. "push", "press",
"pull", "row"), open the Insights screen, and confirm the balance card
reports a push/pull percentage split matching the logged sets.

**Acceptance Scenarios**:

1. **Given** at least 20 working sets within the trailing 90 days whose
   exercise's `movementPattern` matches either a recognized "push" or
   "pull" keyword, **When** the Insights screen is viewed, **Then** a
   push/pull balance card shows the percentage split between the two,
   the period covered, and the number of classified sets.
2. **Given** fewer than 20 classified working sets in that window (whether
   because too few sets were logged, or because logged exercises'
   movement patterns don't match either keyword list), **When** the
   Insights screen is viewed, **Then** no push/pull balance card appears,
   and the screen explains that more classifiable training data is
   needed.
3. **Given** a working set whose exercise has no `movementPattern` set,
   or one matching neither list, **When** balance is computed, **Then**
   that set is excluded from both the numerator and the denominator — it
   is not counted as push, pull, or against the 20-set threshold.

### Edge Cases

- What happens when an exercise crosses a threshold between two views
  (e.g. a merge or a newly logged session changes whether it qualifies)?
  Every card is recomputed fresh from `listSessions`/`listExercises` on
  each view (`docs/requirements.md` §6) — nothing is cached, so a card
  appears or disappears immediately based on current data, never a stale
  snapshot.
- What happens when two exercises are merged (spec 001/002's
  `mergeExercises` cascade) mid-window, combining both exercises' set
  history under the survivor? The survivor's trend/plateau/record/balance
  computations naturally reflect the combined history on the next read —
  this spec adds no new merge-aware logic; it simply reads what
  `listSessions` already returns.
- What happens when a person has fewer days of history than a card's
  window (e.g. only 40 days of total training, against a 90-day window)?
  The window is clipped to whatever history exists; each card's own
  data-sufficiency threshold (§5.7) — not the window length — decides
  whether it shows.
- What happens when a session central to a computation is later edited
  (spec 004's session detail editing) after being viewed on an Insights
  card? The next view of the Insights screen recomputes from the edited
  data; there is no earlier "locked-in" version of an insight anywhere.
- What happens when the first-three/last-three daily e1RM comparison
  (§5.4) would need to reuse the same day twice because fewer than 6
  distinct days (not just sessions) have an eligible set — e.g. 6
  sessions land on only 4 distinct calendar days? Both the per-exercise
  progress card (FR-002) and the detected-plateau card (FR-008) require
  at least 6 *distinct qualifying days* within their own window, not
  merely 6 sessions, specifically so the first-three and last-three
  groups never overlap.
- What happens to the Recent records card when a session ties (rather
  than beats) an old all-time value, and an even older session already
  held that same tied value outside the 30-day window? Per spec 004's own
  rule, every session tied for the all-time maximum counts as a personal
  record — if the *recent* one falls inside the 30-day window, it is
  shown, regardless of whether an older tied session exists outside it.
  If more than one session inside the window ties it, FR-007's
  consolidation rule shows the most recent one.

## Non-Goals *(mandatory)*

- **A persisted insight cache or history** — every card is recomputed
  from canonical records on each view (`docs/requirements.md` §6,
  constitution Principle I); this spec stores nothing new.
- **User-configurable thresholds or windows** — the §5.7 minimums and
  this spec's window lengths (Assumptions) are fixed defaults;
  `docs/requirements.md` §5.7 itself states they are "changeable only
  through a recorded decision," not a settings toggle (FR-11 is
  unaffected by this spec).
- **A second discipline's own insight cards** — per `docs/requirements.md`
  §1.4, every computation here (e1RM-based trend, tonnage, push/pull
  classification) is Strength-specific; a future discipline's own insight
  types are a separate, later decision (D8).
- **Any change to spec 004's screens, computations, or `StoragePort`
  usage** — this spec is a read-only consumer of
  `src/application/progression/`'s existing e1RM/tonnage/best-working-set/
  personal-record functions and `listSessions`/`listExercises`; it adds
  no new domain entity, value object, or port method.
- **A real, curated movement-pattern taxonomy or seed exercise catalogue**
  — `ADR-0005`'s seed catalogue contents remain undecided/unimplemented;
  this spec's push/pull classification (User Story 6) is a fixed,
  best-effort keyword match against whatever free text a person's own
  exercises carry, not a redesign of the catalogue's `movementPattern`
  field.
- **Notifications, alerts, or any proactive surfacing of insights outside
  the Insights screen itself** — a person must open the screen to see any
  card; nothing pushes a conclusion at them.
- **New progression metrics beyond spec 004's four** (estimated 1RM, top
  load, tonnage, reps at a fixed load) — Recent records (User Story 2)
  reuses exactly those, introducing none of its own.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide an Insights screen that computes
  zero or more cards, of the six types below, entirely from
  `StoragePort.listSessions`/`listExercises` — no card's result is
  persisted to storage, and none is treated as a source of truth in place
  of the canonical Session/Exercise records it was computed from
  (`docs/requirements.md` §6). An in-memory-only, non-persisted
  incremental-recomputation technique (e.g. memoizing a card's result
  until a session it depends on changes) MAY be used to satisfy
  `docs/requirements.md` §7.1's "recomputed incrementally" performance
  goal — that is an implementation technique for `/speckit-plan` to
  choose, not a change to this requirement's data-ownership contract.
- **FR-002**: For each Exercise with at least one e1RM-eligible working
  set (per spec 004's `isE1rmEligible`) within a trailing 90-day window,
  the system MUST compute a per-exercise percentage change per
  `docs/requirements.md` §5.4: the median of the earliest three distinct
  calendar days' e1RM values (the maximum e1RM among that day's eligible
  sets) compared with the median of the latest three distinct calendar
  days' e1RM values within the window, rounded to the nearest integer.
  This computation MUST require at least 6 *distinct qualifying calendar
  days* (not merely 6 sessions) within the window, in addition to the
  ≥21-day span §5.7 already requires, so the earliest-three and
  latest-three groups never overlap.
- **FR-003**: A per-exercise progress card for an Exercise MUST be shown
  only when FR-002's computation has at least 6 distinct qualifying days
  and those days span at least 21 days within the 90-day window (§5.7);
  it MUST state the exercise's name, the computed percentage change, the
  date range it covers, and the number of supporting sessions, and MUST
  link to that exercise's spec-004 progression screen.
- **FR-004**: For each distinct `movementPattern` value and each distinct
  entry of `muscleGroups` present across the Exercise catalogue —
  compared case/accent-insensitively, so e.g. "Legs" and "legs" group
  together, matching FR-012's own treatment of the same kind of free-text
  field — the system MUST compute an aggregate percentage change per
  `docs/requirements.md` §5.5: the mean of FR-002's per-exercise
  percentage changes for every Exercise in that group that independently
  clears FR-003's threshold, weighted by each such exercise's count of
  sessions with an e1RM-eligible set within the 90-day window. An
  Exercise with more than one `muscleGroups` entry contributes to each of
  those groups' aggregates independently, in addition to its single
  `movementPattern` group.
- **FR-005**: An aggregate progress card for a pattern or muscle group
  MUST be shown only when at least 2 distinct exercises in that group
  clear FR-003's threshold (§5.7); it MUST state the pattern/group name,
  the computed weighted percentage change, the period covered, and MUST
  list (or link to) the contributing exercises.
- **FR-006**: For each Exercise and each progression metric available to
  it (per spec 004 FR-021/FR-022's honest degradation — e1RM only when
  eligible), the system MUST determine whether that exercise's current
  all-time-best value for that metric (spec 004 FR-020's exact
  personal-record definition, ties included) was achieved by a session
  dated within the trailing 30 days.
- **FR-007**: A recent records entry MUST be shown for every (Exercise,
  metric) pair FR-006 finds within the 30-day window, stating the
  exercise's name, the metric, its value, and the date achieved, and MUST
  link to that exercise's spec-004 progression screen with the record
  session identifiable. When more than one session within the 30-day
  window ties the same (Exercise, metric) pair's all-time-best value, the
  entry MUST show the most recent such date and link to that session,
  consolidating rather than producing a separate entry per tied session.
- **FR-008**: For each e1RM-eligible Exercise, the system MUST compute the
  same §5.4 trend as FR-002, but over a fixed trailing 8-week window
  instead of 90 days. Per §5.7's "Plateau" row, this MUST require at
  least 6 sessions with that exercise within those 8 weeks, and — for the
  same overlap-avoidance reason FR-002 states — at least 6 *distinct
  qualifying calendar days* within those 8 weeks (no separate ≥21-day
  span requirement; §5.7's Plateau row states none, unlike its Exercise
  trend row).
- **FR-009**: A detected-plateau card for an Exercise MUST be shown only
  when FR-008's computation yields an absolute percentage change under 2%
  (§5.7); it MUST state the exercise's name, the near-zero change, the
  8-week period, and the supporting session count, and MUST link to that
  exercise's progression screen.
- **FR-010**: The system MUST compute a consistency figure: the count of
  distinct calendar weeks, within the trailing 12 weeks (or the person's
  full training history if shorter), that contain at least one logged
  Session. Week boundaries default to the ISO convention (Monday-start)
  for this spec; `docs/requirements.md` FR-11 (Settings) later gives the
  user a "first day of the week" preference that FR-11's own spec should
  make this computation follow once it exists — this default is provisional
  pending that setting, not a permanent override of it (see Assumptions).
- **FR-011**: A consistency card MUST be shown only when the person's
  total training history spans at least 4 weeks (§5.7); it MUST state how
  many of the covered weeks included a session, out of how many weeks
  were covered.
- **FR-012**: The system MUST classify each working Set logged within the
  trailing 90 days as "push," "pull," or unclassified, based on whether
  its Exercise entry's referenced Exercise's `movementPattern` value has,
  case/accent-insensitively, any whitespace-delimited word that exactly
  equals an entry in a fixed "push" keyword list, a fixed "pull" keyword
  list, or neither (see Assumptions for the lists) — a whole-word match,
  not a raw substring match, so e.g. "press" matches a pattern of
  "close-grip bench press" but a hypothetical pattern like "compression"
  would not. A Set whose Exercise has no `movementPattern`, or one
  matching neither list, MUST be excluded from both categories and from
  the qualifying count below.
- **FR-013**: A push/pull balance card MUST be shown only when at least
  20 classified (push or pull) working sets exist within the 90-day
  window (§5.7); it MUST state the percentage split between push and
  pull, the period covered, and the number of classified sets
  contributing.
- **FR-014**: Every card's displayed text MUST be produced from a fixed
  wording template filled with the computed numbers (`docs/requirements.md`
  §5.6) — no generative or free-form text describing any card's
  conclusion.
- **FR-015**: For each of the six card types, when no instance of that
  card type currently meets its data-sufficiency threshold, the Insights
  screen MUST show an explanation of what is missing for that card type
  (e.g. how many more sessions or how much more history would be needed)
  rather than omitting the section with no explanation — distinct from an
  individual Exercise or group simply not (yet) qualifying while others
  of the same card type do. For the aggregate progress card type
  (FR-004/FR-005) specifically, when the reason no aggregate qualifies is
  that too few of the person's exercises carry a `movementPattern` or
  `muscleGroups` value at all (rather than simply not clearing FR-003's
  trend threshold), the explanation MUST say so — folding
  `docs/requirements.md` FR-5's "the app says so when they are missing"
  obligation into this card type's own missing-data messaging, rather
  than a separate, disconnected requirement.
- **FR-016**: None of this spec's thresholds (§5.7) or window lengths
  (Assumptions) are exposed as a user-facing setting — changing any of
  them requires its own recorded decision, consistent with
  `docs/requirements.md` §5.7's own rule.

### Key Entities *(include if feature involves data)*

This spec introduces no new domain entity, value object, or `StoragePort`
method. It reads the existing Session/Exercise/Set records (spec 001/002)
and reuses spec 004's derived e1RM/tonnage/best-working-set/
personal-record functions unchanged. It adds only in-memory, non-persisted
derived concepts:

- **Insight card**: a computed, ephemeral result of one card type applied
  to one subject (an Exercise, a movement-pattern/muscle-group name, or
  the whole catalogue for consistency) — carries the claim's numbers, the
  period covered, the supporting session count, and a link target. Never
  stored; recomputed on every view.
- **Push/pull classification**: a fixed, versioned mapping (an
  application-code constant, not a persisted field) from free-text
  `movementPattern` keywords to "push," "pull," or unclassified — see
  Assumptions.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A person who has logged one exercise across at least 6
  sessions spanning 3+ weeks can see, on one screen and without leaving
  it, a plain-words answer to whether that exercise is improving, backed
  by a specific number and session count.
- **SC-002**: 100% of insight cards shown can be traced, in one tap, to
  the sessions that produced them.
- **SC-003**: 0% of shown cards fall below their documented
  data-sufficiency threshold — every card that appears has at least the
  minimum data §5.7 requires for its type.
- **SC-004**: A person with under 4 weeks of training history sees an
  explicit explanation of what more is needed for each card type that
  isn't showing, rather than an empty, unexplained Insights screen.
- **SC-005**: A person can find out whether any of their last 30 days'
  sessions set a personal record without opening any individual
  exercise's own progression screen first.

## Assumptions

- **Consistency's week boundary vs. FR-11's future setting**: FR-010 uses
  the ISO (Monday-start) week convention as a fixed default, since
  `docs/requirements.md` FR-11's user-configurable "first day of the
  week" setting is a later phase (`docs/agent-brief.md` Phase 7) that
  does not exist yet. This is a provisional default this card should
  switch to reading from FR-11's setting once that phase ships, not a
  permanent, deliberate override of it — noted here so a future spec
  touching FR-11 knows to revisit this computation.
- **§7.1's "recomputed incrementally" performance goal**: this spec's
  "no card is persisted" contract (FR-001, constitution Principle I) is
  about *data ownership* — canonical Session/Exercise records are the
  only source of truth — not about forbidding an in-memory, non-persisted
  memoization strategy that satisfies §7.1's incremental-recomputation
  performance goal. Exactly how incremental recomputation is implemented
  (e.g. keyed by which sessions changed) is left to `/speckit-plan`.
- **Window lengths** (not specified numerically in `docs/requirements.md`
  beyond the Plateau card's own explicit "8 weeks"): per-exercise
  progress and aggregate progress use a trailing 90-day window; recent
  records uses a trailing 30-day recency window; consistency uses a
  trailing 12-week window; push/pull balance uses the same trailing
  90-day window as the progress cards. All are fixed defaults, changeable
  only via a recorded decision (FR-016), consistent with §5.7's own
  stated philosophy for its thresholds.
- **"The periods compared" (FR-9)** is read as "the time period the
  shown number covers" (e.g. "the last 90 days," "the last 8 weeks") for
  every card, not necessarily a two-period before/after comparison for
  every card type — Consistency and Push/pull balance are single-window
  figures, while Per-exercise progress, Aggregate progress, and Detected
  plateau inherently compare an earlier sub-period to a later one within
  their own window (§5.4).
- **Push/pull keyword classification** (FR-012): a fixed, versioned list
  of case/accent-insensitive keywords maintained in application code —
  illustrative examples: "push," "press," "horizontal push," "vertical
  push" classify as push; "pull," "row," "horizontal pull," "vertical
  pull" classify as pull. Patterns like "squat," "hinge," "lunge," or
  "carry" are deliberately classified as neither. The exact list is an
  implementation detail for `/speckit-plan`; this spec fixes only its
  behavior (case/accent-insensitive, whole-word keyword match — not a raw
  substring match — with an unmatched/absent pattern excluded from both
  categories) per FR-012/Edge Cases. Because
  `movementPattern` is free text with no seed catalogue yet (`ADR-0005`),
  this card will show "not enough data" for many real installs until a
  person's own naming happens to match — an accepted, honestly-degraded
  v1 limitation rather than a blocker (see User Story 6's own priority
  rationale).
- **Recent records consolidation**: one entry per (Exercise, metric) pair
  that hit a record in the window (FR-007), not one entry per record-
  setting Set — a session with a single record-setting best working set
  produces one entry per metric it set a record for, not a separate entry
  per Set.
- **Exact card wording** (the literal sentence template's copy) is a
  presentation-layer content decision, as spec 004's effort-scale word
  labels already were — this spec fixes only the *shape* FR-014/§5.6
  require (claim + number + period + session count, from a fixed
  template, never generated), not the literal English text.
- **"Daily" e1RM value** (§5.4): the maximum e1RM among all eligible
  working sets for that exercise logged on a given calendar day, across
  however many sessions occurred that day (`docs/requirements.md` §3.1
  allows more than one session per day) — mirrors spec 004's own
  "session's e1RM is the maximum across its qualifying working sets"
  rule, applied at the day level since FR-002/§5.4 speak of "daily"
  values rather than per-session ones.
