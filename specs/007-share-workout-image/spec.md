# Feature Specification: Share as Image

**Feature Branch**: `007-share-workout-image`

**Created**: 2026-09-13

**Status**: Reviewed

**Input**: User description: "Share as image (FR-14, "Later" phase per
docs/requirements.md §9, D12). Generate a shareable image summarising
training content for use outside the app (e.g. posting to Instagram), the
same way Strava produces a shareable workout card. A one-way, on-device
export, explicitly not a social feature (D12): no account, no in-app
sharing, no third-party posting API, no peer visibility — the same shape as
FR-12's export, with a visual artifact instead of a data file. Two entry
points: (a) an optional prompt shown right after logging a session (from
spec 001's logging flow), with a "don't show again" preference the user can
permanently set, persisted as a new Settings field (extending spec 006's
Settings screen and its StoragePort-backed settings persistence — a new
persisted field, so per docs/requirements.md §6 / constitution Principle III
this needs its own schema version bump and migration even though additive);
(b) on demand, at any time, from the session detail view's menu (spec 004's
diary/session detail screen). Before generating the image, the user picks
exactly one of three content types, each pulling only from computations that
already exist elsewhere in the app (constitution Principle VI — no new
metric is invented for this feature): (1) Session summary — the exercises
performed in that session and headline numbers (e.g. tonnage per §5.3, set
count) — this option must not be offered at all when the session has too
many exercises for the text to stay legible in a square image, so the spec
needs to define a concrete legibility threshold (a maximum count) rather
than leave it to implementation; (2) A single highlight — one exercise or
personal record called out prominently (e.g. "130kg in Hip Thrust!"), reusing
spec 004's personal-record definition — the spec must define how the
highlighted PR/exercise is chosen by default (e.g. the session's most
notable PR, if any) and whether/how the user can pick a different one; (3) A
stat — either a training-consistency calendar (a summary of which days were
trained, over a window the spec must define) or an exercise's progression
chart over the last 6 months or the last year, reusing spec 004/FR-8's chart
and its data-sufficiency rules (§5.7) — when a stat option's
data-sufficiency threshold isn't met for a given exercise/window, the spec
must define whether that option is hidden (consistent with how FR-9 insight
cards behave below their thresholds) rather than shown degraded. The image's
visual style must follow the app's existing design tokens (constitution
Principle V) and be easily recognisable as coming from the app; the app's
name appears small along the bottom edge. Ships with exactly one aspect
ratio for now (1:1 square); a 9:16 story-style ratio and any other export
surface (direct posting APIs, other social platforms' SDKs) are explicitly
out of scope for this spec, left for a later extension. Generation happens
entirely on-device (no network call); the only hand-off to the user is the
platform's native share sheet or saving the image as a file — never a direct
authenticated call to a third-party platform, keeping this behind existing
invariants rather than a new external dependency (constitution Principle IV,
Invariant 1). Respect accessibility requirements already established for the
app (§7.4) for the share prompt/menu entry itself (the generated image's own
internal accessibility does not apply, since it is a static exported
artifact, not an in-app screen). Builds on spec 001 (Session/Block/
ExerciseEntry/Set domain), spec 004 (diary/session detail, progression
chart, personal-record definition), spec 005 (insights' data-sufficiency
pattern for hiding a card/option below threshold), and spec 006 (Settings
screen and its persisted-settings mechanism) — this spec adds one new
presentation-layer flow (content-type picker + on-device image renderer)
and, for the "don't show again" preference, one new persisted Settings field
with its schema migration; it adds no new adapter and no new port beyond
what settings persistence already has."

> **Note on the Input above**: it is kept verbatim as the original
> `/speckit-specify` invocation. Three of its framing choices were corrected
> during `spec-reviewer`/`schema-guardian` review before this spec's first
> `Reviewed` pass, and the body below reflects the corrections, not the
> Input text: (1) there is no discrete "session is logged/saved" event to
> hook the post-logging prompt to (spec 001 has none); (2) FR-8's own chart
> carries no data-sufficiency threshold — this feature borrows FR-9/§5.7's
> per-exercise-progress threshold instead; (3) the new Settings field does
> **not** require a schema version bump, ADR, or migration (D14) — Settings
> is not a canonical entity under §3.1/Principle III, matching the
> precedent already set in spec 006. Decision numbering was also shifted
> (D12→D13, the old D13→D14) when merging with `main`, which had already
> taken D12 for an unrelated decision (ADR-0007, no set confirm step) —
> the Input above still shows the original D12/D13 numbering used before
> that merge.

## Clarifications

### Session 2026-09-13

- Q: Should the post-logging share prompt (FR-001) appear after every session with at least one confirmed set, or only when that session contains a new personal record? → A: Every session with at least one confirmed set — matches Strava's "offer to share any activity" pattern; "don't show this again" (FR-003) already covers prompt fatigue. FR-001 keeps its current unconditional trigger.
- Q: When the user overrides "single highlight"'s default exercise, which of the session's exercises should the picker offer? → A: Only exercise entries with at least one working set (§5.1) — consistent with FR-015 already excluding warm-up-only sessions from this content type entirely.

## Context *(mandatory)*

Every prior spec builds evidence the user can see inside the app: a diary
(spec 004), a progression chart (spec 004), and insight cards (spec 005).
None of that evidence can leave the device except as a data file (spec
006's export). `docs/requirements.md` FR-14 (D13) closes that gap for one
specific case — a single, shareable image summarising a slice of training
data, meant to be posted outside the app (e.g. Instagram), the same way
Strava produces its workout cards. This is explicitly not the "social
network" non-goal the constitution refuses (profiles, followers, in-app
peer visibility): the image is rendered on-device and handed to the
platform's own native share sheet or saved as a file, never posted through
an authenticated API this app holds. D13 records that reading. The feature
targets the "Later" phase (§9) — it is specified now so the decision and
its shape are recorded, not because it is scheduled ahead of v1/v1.1. It
reuses computations and definitions that already exist (personal records
and the progression chart from spec 004, the data-sufficiency pattern from
spec 005, tonnage from §5.3) rather than introducing new ones, per
constitution Principle VI.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Share a single highlight right after logging (Priority: P1)

A user has just confirmed a set that sets a personal record. As they leave
the logging screen, a prompt offers to turn that into a shareable image.

**Why this priority**: This is the moment Strava-style sharing exists for —
pride in a fresh result, while it is still top of mind. It is also the
entry point most likely to be used, so it has to work end to end first.

**Independent Test**: Log a session containing a set that sets a personal
record, leave the logging screen, accept the resulting share prompt, choose
the "single highlight" content type, and confirm a 1:1 image is produced
showing that record, the app's own visual style, and the app's name along
the bottom edge.

**Acceptance Scenarios**:

1. **Given** a session contains a new personal record, **When** the user
   leaves the logging screen having confirmed at least one set that session,
   **Then** a share prompt appears offering to create a shareable image.
2. **Given** the share prompt is showing, **When** the user chooses "single
   highlight", **Then** the personal record just achieved is selected by
   default and an image is generated showing it, the exercise name, and the
   value achieved.
3. **Given** the generated image is showing, **When** the user dismisses it
   without using the platform share sheet, **Then** nothing is sent
   anywhere and no record of the attempt is kept (Invariant 1).
4. **Given** the share prompt is showing, **When** the user checks "don't
   show this again" and dismisses it, **Then** no share prompt appears when
   leaving the logging screen for a later session, until the user
   re-enables it from Settings.

---

### User Story 2 - Share a past session's summary from the diary (Priority: P2)

A user is reviewing an old session in the diary and wants to post a recap
of everything they did that day.

**Why this priority**: The on-demand entry point is what makes this a
general-purpose feature rather than a one-shot post-logging popup — it has
to work for any session, not only the one just recorded.

**Independent Test**: Open any past session's detail view, use its menu to
start a share, choose "session summary", and confirm the image lists that
session's exercises and headline numbers.

**Acceptance Scenarios**:

1. **Given** a past session with a small number of exercises, **When** the
   user opens its detail view menu and chooses to share, **Then** all three
   content types are offered, including "session summary".
2. **Given** a past session whose number of distinct exercises exceeds the
   legibility threshold (FR-006), **When** the user opens the share menu for
   it, **Then** "session summary" is not offered as a content type, and the
   other two content types are offered normally.
3. **Given** the user picks "session summary", **When** the image is
   generated, **Then** it shows the session's exercises, its total tonnage
   (§5.3), and its total set count, styled with the app's design tokens.

---

### User Story 3 - Share a stat: consistency calendar or progression chart (Priority: P3)

A user wants to show off a trend rather than a single session — how
consistently they have trained recently, or how one exercise has improved
over the last several months.

**Why this priority**: Valuable, but the least essential of the three
content types for a first release of the feature — the other two already
prove the sharing mechanism end to end.

**Independent Test**: From the share menu (either entry point), choose "a
stat", pick the consistency calendar or an eligible exercise's progression
chart, and confirm the resulting image matches what the app already shows
elsewhere for that same data.

**Acceptance Scenarios**:

1. **Given** the user picks "a stat" and then the consistency calendar,
   **When** the image is generated, **Then** it shows which days were
   trained in the trailing window (FR-010) styled as a compact calendar.
2. **Given** the user picks "a stat" and then an exercise's progression
   chart, and that exercise meets the data-sufficiency threshold FR-011
   borrows from FR-9/§5.7 for the selected range, **When** the image is
   generated, **Then** it shows the same trend the in-app progression chart
   would show for that exercise and range.
3. **Given** the user picks an exercise that does not meet that threshold
   for either available range (6 months, 1 year), **When** they reach the
   stat picker, **Then** that exercise's progression chart is not offered as
   a choice, consistent with how under-threshold insight cards are hidden
   (spec 005).

---

### Edge Cases

- A session has zero recorded sets (e.g. reached through the on-demand entry
  point on a session the user never finished logging): no content type has
  anything to show, so the share entry explains there is nothing to share
  instead of offering the picker (FR-014).
- A session has recorded sets but none is a working set (§5.1 — e.g. every
  set is marked warm-up): "single highlight" is not offered for that
  session (FR-015), while "session summary" and any qualifying "stat"
  remain available on their own terms.
- The session that triggers the post-logging prompt contains no personal
  record: "single highlight" still defaults per FR-008's tie-break rule
  (the session's highest e1RM among its e1RM-eligible working sets, or its
  first exercise entry if none qualify), just without a "personal record"
  label attached.
- The highlighted set's load is a Band, Bodyweight-without-numeric-load,
  Free text, or None (§3.2): the highlight shows the value in its own terms
  (e.g. the band label, or reps alone) rather than a numeric estimate,
  mirroring FR-8's honest-degradation rule — never fabricating a number for
  a load type that has none.
- A brand-new user with very little history opens the on-demand share entry:
  the consistency calendar and every exercise's progression chart are all
  below threshold, so "a stat" itself is not offered, and the picker
  explains why (consistent with FR-9's "explain what's missing" pattern),
  rather than presenting an empty state.
- A session mixes Strength exercises with a later-added non-Strength
  discipline's exercises (§1.4): every content type excludes the
  non-Strength entries from its numbers and shows a one-line note that some
  exercises were left out (FR-022), rather than mixing disciplines into one
  figure or refusing to share the session at all.
- The user re-opens Settings after previously checking "don't show this
  again": the setting is visible and can be turned back on (FR-004).
- The device's platform share sheet is dismissed or cancelled by the user
  after the image is generated: this is treated exactly like User Story 1's
  Acceptance Scenario 3 — nothing was sent, nothing is recorded.

## Non-Goals *(mandatory)*

- Posting directly to Instagram or any other platform through its API or
  SDK. The app never authenticates with, or sends data to, a third-party
  platform on the user's behalf — the only hand-off is the operating
  system's native share sheet or saving a file (Invariant 1, Principle IV).
- Any in-app social feature: no followers, likes, comments, profiles, or
  visibility of one user's shared content to another. D13 records that this
  export is not the constitution's "social network" non-goal precisely
  because none of that exists here.
- Aspect ratios other than 1:1 (e.g. a 9:16 story format). A later
  extension, not part of this spec.
- User customisation of the image's layout, colours, or branding. The
  template is fixed and authored from the app's own design tokens; a user
  who wants a different look edits the image after export, outside the app.
- Combining more than one content type into a single image, or exporting
  more than one image per share action.
- Any record of what was shared, when, or whether the platform share sheet
  completed — consistent with Invariant 1 and §7.3 (no content analytics),
  the app keeps no history of share actions.
- Any new computation or metric invented for this feature. Every number
  shown must already exist as a defined computation elsewhere in the app
  (§5, FR-8, FR-9).
- A second discipline's own metrics or chart types (§1.4): a mixed-discipline
  session is handled by exclusion (FR-022), not by adding any
  non-Strength computation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer to generate a shareable, on-device
  image, via a dismissible prompt, when the user leaves the logging screen
  having confirmed at least one set in that session — spec 001's session
  model has no discrete "save" step to hook this prompt to instead.
- **FR-002**: The system MUST offer to generate a shareable image on demand,
  at any time, from any session's detail view, regardless of when that
  session was logged.
- **FR-003**: The post-logging prompt (FR-001) MUST offer a "don't show
  this again" choice; accepting it MUST permanently suppress the prompt for
  every future session until the user re-enables it.
- **FR-004**: The system MUST expose the post-logging prompt's suppressed/
  enabled state in Settings, so the user can turn the prompt back on after
  having dismissed it permanently.
- **FR-005**: The system MUST let the user choose exactly one content type
  before generating an image: session summary, single highlight, or a stat.
- **FR-006**: The system MUST NOT offer "session summary" as a content type
  for a session with more than 6 distinct exercises, since its exercise
  list and headline numbers would not stay legible in a 1:1 image at that
  count.
- **FR-007**: When offered, "session summary" MUST show the session's
  distinct exercises, its total tonnage (§5.3, working sets only per that
  computation's own definition), and its total set count (all recorded
  sets, the same convention spec 004 uses for a session's per-exercise set
  count).
- **FR-008**: "Single highlight" MUST default to one exercise entry's best
  working set, chosen in this order: (1) if any working set in the session
  set a personal record (spec 004's definition), the one with the largest
  e1RM among those; (2) otherwise, the session's highest e1RM among its
  e1RM-eligible working sets (§5.2 — Weight loads, or Bodyweight with a
  numeric added load, 1–12 reps); (3) if no working set in the session is
  e1RM-eligible, the first exercise entry in the session's own order. The
  user MUST be able to choose a different exercise entry instead of the
  default, from among the session's exercise entries that have at least one
  working set (§5.1) — an exercise entry with only warm-up sets is not
  offered here, consistent with FR-015.
- **FR-009**: When the highlighted set's load type has no numeric value
  (Band, Bodyweight without a numeric added load, Free text, or None —
  §3.2), the highlight MUST show that load in its own terms and MUST NOT
  present a fabricated numeric estimate, mirroring FR-8's degradation rule.
- **FR-010**: "A stat" MUST offer a training-consistency calendar showing
  which days were trained in the trailing 12 weeks (84 days), available
  only when the user has at least 4 weeks of training history — the same
  threshold FR-9/§5.7 uses for its own Consistency card.
- **FR-011**: "A stat" MUST offer an eligible exercise's progression chart,
  rendered the same way as spec 004/FR-8's own in-app chart, over a 6-month
  or a 1-year range chosen by the user (narrower than FR-8's own four
  ranges: 3 months and "all" are excluded here — too short to show a trend
  worth sharing, or too long to stay legible in a fixed-size image). Unlike
  the in-app chart, which spec 004 explicitly leaves without a data
  minimum, this content type gates each exercise/range pair by the
  per-exercise-progress threshold FR-9/§5.7 already defines for Insights
  (≥6 sessions with that exercise and ≥21 days of span within the window),
  so a shared image never claims a trend the app would consider too thin to
  surface as an insight.
- **FR-012**: An exercise's progression-chart stat MUST NOT be offered for
  a range where that exercise does not meet the threshold FR-011 borrows,
  within that range.
- **FR-013**: When neither the consistency calendar nor any exercise's
  progression chart has enough data to show, "a stat" MUST NOT be offered
  as a content type, and the picker MUST explain what is missing rather
  than showing an empty option.
- **FR-014**: When a session has no recorded sets at all, the system MUST
  explain that there is nothing to share instead of presenting the
  content-type picker.
- **FR-015**: When a session has recorded sets but none is a working set
  (§5.1), "single highlight" MUST NOT be offered for that session;
  "session summary" and any qualifying "stat" remain offered on their own
  terms.
- **FR-016**: Every number or chart shown on a generated image MUST come
  from a computation already defined elsewhere in the app (§5, FR-8, FR-9);
  this feature MUST NOT introduce a new metric.
- **FR-017**: The generated image MUST use the app's existing design tokens
  and MUST show the app's name, small, along its bottom edge, so it is
  recognisable as coming from the app wherever it is posted.
- **FR-018**: The generated image MUST be produced in a 1:1 (square) aspect
  ratio.
- **FR-019**: Generating and rendering the image MUST happen entirely
  on-device, with no network call; the only way the image leaves the app
  MUST be the platform's native share sheet or saving it as a file.
- **FR-020**: The system MUST NOT retain any record of a share action (what
  was shared, when, or whether it completed).
- **FR-021**: The share prompt (FR-001) and the on-demand share entry point
  and its content-type picker (FR-002, FR-005) MUST meet the app's existing
  accessibility requirements (§7.4): visible focus, reachable without a
  pointer, state never carried by colour alone, and usable at a narrow
  width.
- **FR-022**: Every content type's computations (session summary's exercise
  list, tonnage and set count; single highlight; both stat types) MUST
  consider Strength-discipline (§1.4) exercise entries only. A session that
  also contains a non-Strength exercise entry MUST exclude those entries
  from every number shown and MUST show a one-line note that some exercises
  were left out, rather than mixing disciplines into one figure or
  refusing to share the session.

### Key Entities

- No new domain entity or value object is introduced. This feature reads
  existing entities (Session, Block, Exercise entry, Set, and the
  progression/personal-record and insight computations already defined for
  them) and adds one new field to the existing Settings data: a boolean
  preference recording whether the post-logging share prompt (FR-001) is
  suppressed. Settings is not a canonical entity under §3.1, so per D14
  this addition does not require a schema version bump, an ADR, or a
  migration — a missing field simply defaults to "prompt enabled", the same
  way spec 006's own Settings fields already do.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From an accepted share prompt or an opened on-demand share
  entry, a user reaches a finished, ready-to-share image in at most 3 taps
  for "session summary" or "single highlight" (choose content type →
  confirm, with at most one further sub-choice), and in at most 5 taps for
  "a stat" (choose content type → calendar-or-chart → exercise → range →
  confirm).
- **SC-002**: Every number and chart that appears on a generated image is
  traceable, without exception, to a computation already defined and
  tested elsewhere in the app (verifiable by spec/code review, not a
  runtime check).
- **SC-003**: Once "don't show this again" is set, 100% of subsequent
  session logs produce no share prompt, until the user re-enables it in
  Settings.
- **SC-004**: The on-demand share entry succeeds (produces an image or a
  clear explanation of why it cannot) for any session, regardless of its
  age or how much data exists elsewhere in the app.
- **SC-005**: No share action, successful or abandoned, leaves any
  observable trace in the app's data (no new record, log, or counter).

## Assumptions

- The session-summary legibility threshold (FR-006) is set at 6 distinct
  exercises — a concrete default chosen so the requirement is testable now;
  it may be revisited once real image layouts exist in `/speckit-plan`, but
  any change to the number itself is a spec update, not an implementation
  detail.
- The consistency-calendar window (FR-010) defaults to a trailing 12 weeks
  (84 days), long enough to show a pattern without needing its own
  configurable range, gated by the same 4-week history minimum FR-9 already
  uses for Consistency.
- FR-008's cross-exercise tie-break prefers the largest e1RM (in kg) as the
  most legible "biggest number" for a highlight image; this only orders
  existing e1RM values already computed elsewhere (§5.2) and never computes
  a new one.
- "Single highlight" defaulting to a working set (rather than requiring an
  actual personal record to exist) keeps that content type available for
  any session with at least one working set, while still calling out a
  personal record by name when the default happens to be one.
- The new Settings field for the post-logging prompt's suppressed state
  defaults to "prompt enabled" for both existing installs and fresh
  installs — the field is simply absent until set, per D14, with no
  migration involved.
- "Distinct exercises" for FR-006 counts catalogue exercises referenced by
  the session's exercise entries, not the number of sets.
- FR-022's exclusion note is a simple, fixed one-line disclosure; its exact
  wording is left to `/speckit-plan`, not this spec.
