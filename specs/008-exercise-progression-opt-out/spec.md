# Feature Specification: Exclude an Exercise from Progression/Insights

**Feature Branch**: `008-exercise-progression-opt-out`

**Created**: 2026-09-14

**Status**: Proposed — drafted from a design-refinement request, not yet
clarified, planned, or built.

**Input**: User description (translated from Spanish): "There are some
exercises I won't want to include in the Insights section, because they
won't have a progression and it doesn't make sense to measure their advance
over time — for example, warm-up exercises. Analyze whether it makes sense
to split this into a new spec or evolution, and if so, leave it documented."
Recorded as `docs/requirements.md` D19/FR-15: yes, this warrants its own
spec — it is an additive field on the canonical `Exercise` entity (§3.1),
so it needs the §6/Principle III schema-version-bump-and-migration
treatment; it changes eligibility filtering inside both FR-8 (exercise
progression) and every one of FR-9's six Insights card types; and it has
open design questions (below) that deserve their own Acceptance Scenarios
rather than being folded silently into either existing spec.

## Context *(mandatory)*

Spec 004 (FR-8) gives every Strength exercise with an eligible set its own
progression screen; spec 005 (FR-9) goes further and *surfaces* trends,
plateaus, and personal records across the whole catalogue without the user
asking, specifically so nothing improving (or stalling) goes unnoticed.
Both specs assume every logged exercise is a fair candidate for that
treatment. That assumption doesn't hold for warm-up sets, mobility work, or
any exercise logged only to have a record of "this happened" — a plateau
card for an unweighted band pull-apart, or a "no progress in 8 weeks"
nudge for an ankle-mobility drill, isn't a meaningful signal; it's noise
that could also crowd out the exercises whose progress genuinely matters.
This spec gives the user a way to say, once, per exercise: "don't measure
this one" — turning off progression/Insights computation for it while
changing nothing about logging, recall, or search.

This is deliberately scoped narrower than a general exercise "category" or
"tag" system (§10's future-directions territory) — one boolean, one
well-defined effect (skip progression/Insights computation), reusing the
exercise catalogue screen spec 004/ADR-0010 already built rather than
introducing new catalogue UI shape.

## Clarifications

None yet — this spec has not been through `/speckit-clarify`. The
Assumptions section below states provisional defaults for the two open
design questions (whether an excluded exercise's own progression screen
stays reachable; whether exclusion is retroactive to already-shown
Insights cards) that a clarification pass should confirm or overturn
before `/speckit-plan`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stop measuring a warm-up exercise's progress (Priority: P1)

A person who logs a warm-up or mobility exercise purely for the record —
never to track whether it's getting heavier or faster — marks it as
excluded from progression tracking, once, from the exercise catalogue
screen. From then on, Insights never generates a card about it (no
plateau nudge, no trend, no personal-record callout, no contribution to a
movement-pattern/muscle-group aggregate), and it stops interrupting the
signal for the exercises the person does want tracked.

**Why this priority**: this is the entire request — without it, nothing
else in this spec has a reason to exist.

**Independent Test**: mark an exercise with a long logged history as
excluded, open Insights, and confirm no card of any of the six types
mentions it and no aggregate (pattern/muscle-group) card's number includes
its sessions; log a new all-time-best set for it and confirm no "recent
record" entry appears.

**Acceptance Scenarios**:

1. **Given** an exercise with enough logged history to otherwise qualify
   for a per-exercise progress card (spec 005 FR-002/FR-003), **When** the
   user marks it excluded from the exercise catalogue screen, **Then** no
   per-exercise progress card appears for it on the next Insights view.
2. **Given** the same excluded exercise, **When** it individually would
   have cleared the aggregate progress card's per-exercise threshold
   (spec 005 FR-004/FR-005), **Then** it is not counted toward its
   movement-pattern or muscle-group aggregate at all — neither its
   percentage change nor its session count contributes to the weighted
   mean.
3. **Given** the same excluded exercise, **When** a newly logged set would
   otherwise set an all-time-best value for it (spec 005 FR-006/FR-007),
   **Then** no recent-record entry is generated for it.
4. **Given** the same excluded exercise, **When** it would otherwise
   qualify for the detected-plateau card (spec 005 FR-008/FR-009) or
   contribute a classified set to the push/pull balance card (spec 005
   FR-012/FR-013), **Then** neither happens.
5. **Given** an excluded exercise, **When** the user marks it included
   again, **Then** it becomes eligible for every card type on the next
   Insights view exactly as if it had never been excluded — exclusion
   carries no history of its own and leaves every already-logged Set
   unchanged.

---

### User Story 2 - Exclusion never affects logging, recall, or search (Priority: P1)

The same person keeps logging, reviewing, and searching for their excluded
warm-up exercise exactly as before — exclusion is scoped to progression
*measurement* only, never to whether the exercise can be used at all.

**Why this priority**: without this guarantee, exclusion reads as
"archiving" or "hiding" the exercise, which is not what was asked for and
would make the feature actively harmful if misread that way by an
implementation.

**Independent Test**: mark an exercise excluded, then log a new set for it,
find it in exercise search, and open a past session that references it —
confirm all three work identically to an included exercise.

**Acceptance Scenarios**:

1. **Given** an excluded exercise, **When** the user logs a session that
   includes it, **Then** the set-entry flow (FR-1/FR-3) behaves exactly as
   for any other exercise — exclusion adds no extra step or warning to
   logging.
2. **Given** an excluded exercise with logged history, **When** the user
   views the diary (FR-6) or a past session it appears in, **Then** it is
   shown exactly as any other exercise entry, including in the session's
   one-line "kind of work" summary.
3. **Given** an excluded exercise, **When** the user searches the
   catalogue (FR-7) or opens it from the exercise catalogue screen (FR-5),
   **Then** it appears in results exactly as any other exercise, with only
   its exclusion state itself visibly different (see FR-004 below).

### Edge Cases

- What happens to an exercise excluded partway through accumulating
  history that already produced a shown Insights card on an earlier visit?
  Nothing is cached (spec 005 FR-001, constitution Principle I) — the very
  next Insights view recomputes from scratch and the card is simply gone,
  the same way any other threshold-crossing already works today.
- What happens when an excluded exercise is merged with an included one
  (FR-017, `mergeExercises`)? The survivor's own exclusion field
  wins — merging does not change the survivor's exclusion state based on
  the loser's, since the loser's identity (and its own state) ceases to
  exist; this matches how every other survivor-keeps-its-own-defaults rule
  in this codebase already works (`docs/requirements.md` D-table, ADR-0010
  §1).
- What happens to an excluded exercise's own progression screen (FR-8) if
  the user navigates to it directly (e.g. from a session detail entry, not
  from Insights)? See Assumptions — provisional default: it stays
  reachable and still shows the raw list/chart (a person may still want to
  eyeball a warm-up's numbers occasionally), it simply never *surfaces*
  itself via Insights and drops its personal-record marks; a clarification
  pass should confirm this against dropping FR-8 access entirely.
- What happens for a brand-new exercise, before the user has ever touched
  the exclusion control? It defaults to included (not excluded) — the
  feature only ever *removes* something from Insights when explicitly
  asked, matching every other additive-field default in this codebase
  (D11, D15).

## Non-Goals *(mandatory)*

- **A general exercise tagging/category system.** This spec is one
  boolean with one fixed effect (skip progression/Insights computation),
  not a reusable label system for filtering, grouping, or any other future
  purpose (§10's "future directions," not this spec).
- **Excluding a single *session* or a single logged *set*'s contribution**
  while still tracking the exercise overall (e.g. "don't count this one
  warm-up set, but do track the exercise"). This spec's exclusion is
  per-Exercise, matching how the request was framed ("some exercises");
  finer-grained exclusion is a separate, later idea if ever needed.
- **Hiding, archiving, or soft-deleting the exercise** from logging,
  search, diary, or the catalogue screen — User Story 2 explicitly rules
  this out; FR-017/FR-018's existing merge/delete flow is the only way to
  remove an exercise, unchanged by this spec.
- **A per-exercise setting for which of the six Insights card types
  apply** (e.g. "exclude from plateau detection but keep personal
  records"). One on/off switch per exercise, not six.
- **Any change to FR-8/FR-9's actual computations, thresholds, or
  windows** for an *included* exercise — this spec only adds a filter
  applied before those existing computations run; nothing about how they
  compute for an included exercise changes.
- **A discipline-level default** (e.g. "warm-up" becoming a recognized
  `movementPattern` keyword that auto-excludes). Exclusion is an explicit,
  per-exercise user action, never inferred from naming or pattern text.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST let the user mark a catalogue `Exercise`
  (§3.1) as excluded from progression tracking, and reverse that at any
  time, from the exercise catalogue screen (FR-5). This is a new field on
  `Exercise` — additive, optional/defaulting to "included" (`false`) for
  every existing exercise, so nothing already logged or already shown
  changes behavior at the moment this ships (§6/Principle III schema
  version bump and migration required; no default value backfilled beyond
  the field's own absent-means-included default).
- **FR-002**: When an `Exercise` is excluded, the system MUST NOT compute
  or show any spec-005 Insights card that would otherwise concern it: no
  per-exercise progress card (FR-002/FR-003), no contribution to a
  movement-pattern or muscle-group aggregate card's weighted mean or
  session count (FR-004/FR-005), no recent-records entry (FR-006/FR-007),
  no detected-plateau card (FR-008/FR-009), and no contribution to the
  push/pull balance card's classified-set count (FR-012/FR-013).
- **FR-003**: When an `Exercise` is excluded, the system MUST NOT mark any
  of its sessions as a personal record (spec 004 FR-020) on its own
  progression screen or list. See Assumptions for whether the progression
  screen itself stays reachable.
- **FR-004**: The exercise catalogue screen (FR-5) MUST show each
  exercise's current exclusion state and let the user toggle it, with the
  change taking effect immediately (no confirm step, matching FR-1's "no
  Save button" convention already used for every other in-place edit on
  this screen).
- **FR-005**: Excluding or re-including an `Exercise` MUST NOT alter any
  already-logged `Set`, `ExerciseEntry`, `Block`, or `Session` — it is a
  property of the catalogue entry only, read fresh (never cached) by FR-8/
  FR-9's computations each time they run, exactly as spec 005 FR-001
  already requires for every other input.
- **FR-006**: Merging two exercises (FR-017) MUST keep the
  survivor's own exclusion state unchanged, regardless of the loser's —
  consistent with every other survivor-keeps-its-own-defaults rule this
  codebase already applies to a merge (ADR-0010 §1).
- **FR-007**: Excluding an exercise MUST NOT affect logging (FR-1/FR-3),
  the diary (FR-6), or exercise search (FR-7) in any way — it appears,
  can be logged, and can be found exactly as an included exercise, with
  only its exclusion state itself visibly different on the catalogue
  screen (FR-004).

### Key Entities *(include if feature involves data)*

- **`Exercise.excludeFromProgression`** *(proposed field name, not final)*:
  a new optional boolean on the canonical `Exercise` entity (§3.1),
  defaulting to `false`/absent (included) when not set. The only schema
  change this spec introduces — no new entity, no new `StoragePort`
  method; existing `listExercises`/`saveExercise` already carry whatever
  fields `Exercise` has.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user with a warm-up exercise logged across many sessions
  can turn off every Insights card type for it in one action, from one
  screen, with no card of any type referencing it on the very next
  Insights view.
- **SC-002**: 0% of Insights cards shown reference an excluded exercise,
  whether directly (its own card) or indirectly (an aggregate card's
  number or session count).
- **SC-003**: Excluding or re-including an exercise never changes the
  content of any already-logged session, set, or diary entry.

## Assumptions

- **Whether an excluded exercise's own progression screen (FR-8) stays
  reachable**: provisional default is yes — navigating to it directly
  (e.g. from a session detail entry) still shows the raw list/chart, just
  with no personal-record marks (FR-003). Exclusion is framed here as
  "stop Insights from proactively surfacing a conclusion about this," not
  "stop letting the user look at its numbers if they specifically ask" —
  but this is exactly the kind of judgment call a `/speckit-clarify` pass
  should confirm against the alternative (FR-8 access removed entirely
  for an excluded exercise) before `/speckit-plan`.
- **Field name and shape**: `excludeFromProgression: boolean` is a
  working proposal only, chosen to read unambiguously at the call site
  (`if (exercise.excludeFromProgression) continue;`) — `/speckit-plan` may
  land on a different name once it reconciles this with how spec 005's
  existing computation code structures its per-exercise filtering.
- **Schema version**: this spec's field is additive and optional, the same
  shape D11/D15's own schema changes already took — no specific version
  number is committed here; `/speckit-plan` assigns the next one at
  implementation time (schema v3 is current, per
  `src/infrastructure/schema-version.ts`).
- **No settings-level default**: unlike a Settings-screen preference
  (D14), this is per-exercise catalogue data, not a device preference —
  it lives on `Exercise`, not in spec 006's Settings entity, since two
  people sharing no device-level concept still each want their own
  exercises' own exclusion state remembered per exercise, not globally.
