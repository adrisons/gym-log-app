# Feature Specification: Share as Image

**Feature Branch**: `007-share-workout-image`

**Created**: 2026-09-13

**Status**: Draft

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

## Context *(mandatory)*

Every prior spec builds evidence the user can see inside the app: a diary
(spec 004), a progression chart (spec 004), and insight cards (spec 005).
None of that evidence can leave the device except as a data file (spec
006's export). `docs/requirements.md` FR-14 (D12) closes that gap for one
specific case — a single, shareable image summarising a slice of training
data, meant to be posted outside the app (e.g. Instagram), the same way
Strava produces its workout cards. This is explicitly not the "social
network" non-goal the constitution refuses (profiles, followers, in-app
peer visibility): the image is rendered on-device and handed to the
platform's own native share sheet or saved as a file, never posted through
an authenticated API this app holds. D12 records that reading. The feature
targets the "Later" phase (§9) — it is specified now so the decision and
its shape are recorded, not because it is scheduled ahead of v1/v1.1. It
reuses computations and definitions that already exist (personal records
and the progression chart from spec 004, the data-sufficiency pattern from
spec 005, tonnage from §5.3) rather than introducing new ones, per
constitution Principle VI.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Share a single highlight right after logging (Priority: P1)

A user just finished logging today's session and hit a personal record on
one exercise. A prompt offers to turn that into a shareable image before
they leave the logging screen.

**Why this priority**: This is the moment Strava-style sharing exists for —
pride in a fresh result, while it is still top of mind. It is also the
entry point most likely to be used, so it has to work end to end first.

**Independent Test**: Log a session containing a set that sets a personal
record, accept the post-logging share prompt, choose the "single highlight"
content type, and confirm a 1:1 image is produced showing that record, the
app's own visual style, and the app's name along the bottom edge.

**Acceptance Scenarios**:

1. **Given** a session was just logged and it contains a new personal
   record, **When** the session is saved, **Then** a share prompt appears
   offering to create a shareable image.
2. **Given** the share prompt is showing, **When** the user chooses "single
   highlight", **Then** the personal record just achieved is selected by
   default and an image is generated showing it, the exercise name, and the
   value achieved.
3. **Given** the generated image is showing, **When** the user dismisses it
   without using the platform share sheet, **Then** nothing is sent
   anywhere and no record of the attempt is kept (Invariant 1).
4. **Given** the share prompt is showing, **When** the user checks "don't
   show this again" and dismisses it, **Then** no share prompt appears
   after logging a session again, until the user re-enables it from
   Settings.

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
   legibility threshold (FR-005), **When** the user opens the share menu for
   it, **Then** "session summary" is not offered as a content type, and the
   other two content types are offered normally.
3. **Given** the user picks "session summary", **When** the image is
   generated, **Then** it shows the session's exercises, its total tonnage
   (§5.3), and its set count, styled with the app's design tokens.

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
   chart, and that exercise meets FR-8's data-sufficiency rule (§5.7) for
   the selected range, **When** the image is generated, **Then** it shows
   the same trend the in-app progression chart would show for that exercise
   and range.
3. **Given** the user picks an exercise that does not meet the
   data-sufficiency threshold for either available range (6 months, 1
   year), **When** they reach the stat picker, **Then** that exercise's
   progression chart is not offered as a choice, consistent with how
   under-threshold insight cards are hidden (spec 005).

---

### Edge Cases

- A session has zero recorded sets (e.g. reached through the on-demand entry
  point on a session the user never finished logging): no content type has
  anything to show, so the share entry explains there is nothing to share
  instead of offering the picker.
- The session that triggers the post-logging prompt contains no personal
  record: "single highlight" still defaults to that session's best working
  set (by the same definition spec 004 already uses to rank sets), just
  without a "personal record" label attached.
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
  visibility of one user's shared content to another. D12 records that this
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
- A second discipline's content (§1.4): this spec's content types are
  defined for the Strength discipline's existing computations only.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST offer to generate a shareable, on-device
  image after a session is logged, via a dismissible prompt.
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
  distinct exercises, its total tonnage (§5.3), and its total set count.
- **FR-008**: "Single highlight" MUST default to the session's best working
  set by the existing best-working-set ranking (spec 004), labelled as a
  personal record when it is one (spec 004's personal-record definition),
  and MUST let the user choose a different exercise logged in that same
  session instead.
- **FR-009**: When the highlighted set's load type has no numeric value
  (Band, Bodyweight without a numeric added load, Free text, or None —
  §3.2), the highlight MUST show that load in its own terms and MUST NOT
  present a fabricated numeric estimate, mirroring FR-8's degradation rule.
- **FR-010**: "A stat" MUST offer a training-consistency calendar showing
  which days were trained in the trailing 12 weeks (84 days).
- **FR-011**: "A stat" MUST offer an eligible exercise's progression chart
  (spec 004/FR-8) over a 6-month or a 1-year range, chosen by the user.
- **FR-012**: An exercise's progression-chart stat MUST NOT be offered for
  a range where that exercise does not meet FR-8's data-sufficiency rule
  (§5.7) for that range.
- **FR-013**: When neither the consistency calendar nor any exercise's
  progression chart has enough data to show, "a stat" MUST NOT be offered
  as a content type, and the picker MUST explain what is missing rather
  than showing an empty option.
- **FR-014**: When a session has no data any content type could show (e.g.
  zero recorded sets), the system MUST explain that there is nothing to
  share instead of presenting the content-type picker.
- **FR-015**: Every number or chart shown on a generated image MUST come
  from a computation already defined elsewhere in the app (§5, FR-8, FR-9);
  this feature MUST NOT introduce a new metric.
- **FR-016**: The generated image MUST use the app's existing design tokens
  and MUST show the app's name, small, along its bottom edge, so it is
  recognisable as coming from the app wherever it is posted.
- **FR-017**: The generated image MUST be produced in a 1:1 (square) aspect
  ratio.
- **FR-018**: Generating and rendering the image MUST happen entirely
  on-device, with no network call; the only way the image leaves the app
  MUST be the platform's native share sheet or saving it as a file.
- **FR-019**: The system MUST NOT retain any record of a share action (what
  was shared, when, or whether it completed).
- **FR-020**: The share prompt (FR-001) and the on-demand share entry point
  and its content-type picker (FR-002, FR-005) MUST meet the app's existing
  accessibility requirements (§7.4): visible focus, reachable without a
  pointer, state never carried by colour alone, and usable at a narrow
  width.

### Key Entities

- No new domain entity or value object is introduced. This feature reads
  existing entities (Session, Block, Exercise entry, Set, and the
  progression/personal-record and insight computations already defined for
  them) and adds one new field to the existing Settings data: a boolean
  preference recording whether the post-logging share prompt (FR-001) is
  suppressed. That field is a schema addition per §6 and constitution
  Principle III, and ships with its own version bump and migration
  (default: prompt enabled) when this feature is implemented.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: From an accepted share prompt or an opened on-demand share
  entry, a user reaches a finished, ready-to-share image in at most 3 taps
  (choose content type → confirm, with any needed sub-choice such as which
  exercise or range counted as one of the 3).
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
  configurable range.
- "Single highlight" defaulting to the session's best working set (rather
  than requiring an actual personal record to exist) keeps that content
  type always available for a session with at least one working set, while
  still calling out a personal record by name when the default happens to
  be one.
- The new Settings field for the post-logging prompt's suppressed state
  defaults to "prompt enabled" for both existing installs (via migration)
  and fresh installs.
- "Distinct exercises" for FR-006 counts catalogue exercises referenced by
  the session's exercise entries, not the number of sets.
