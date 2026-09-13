# ADR-0007: Recording a set has no confirm step

## Status

Accepted.

## Context

Since spec 001, adding a set required an explicit confirm tap:
`SetConfirmControl` ("Add set") sat under the load/volume/effort inputs,
disabled-with-reason until the pending set was valid (FR-019), and FR-025
debounced an identical double-tap within ~1 second. `contracts/logging-
screen-components.md` documented this control by name, and FR-008 relied
on it too: a new set pre-fills from the exercise's previous set specifically
"so confirming an identical set is a single tap".

A design-refinement pass (a Claude Design canvas explored and confirmed by
the project owner) revisited the logging screen's feel and found the
confirm tap itself was ceremony the "immediate" character (`docs/design.md`
§1) doesn't need for the common case: the user has already done the actual
work — typed a weight, dialed in reps — by the time they'd reach for a
separate button. A second explicit action to "confirm" numbers already
entered adds a step to the one screen the constitution (Principle II) says
must never gain one.

Removing the confirm control outright, naively, breaks FR-008: a set
pre-filled with the previous set's exact values would already be "valid"
on the very first render, so a purely auto-commit-on-render rule would
silently re-log the previous set the instant the row mounts — the opposite
of FR-005's "no change is confirmed by the user" guarantee, and a genuine
regression, not a simplification.

## Decision

A set commits the moment the user's own edit makes it valid per FR-019 (a
load, or a volume, or both) — not merely because the row renders in a
valid state. Concretely: entering or changing a value in the weight, reps,
or effort control is what triggers the write; a row that is pre-filled and
already valid but that the user has not touched does nothing on its own.

One implementation nuance worth recording, found by testing this in a
real browser rather than only unit tests: no single field's own change
commits on its own. Every edit — a typed digit, a wheel step (including
one driven by a single arrow-key press), a quick-increment tap, a band or
effort pick — instead (re)schedules one short, shared debounce for the
whole row, using that edit's value together with whatever the row's other
fields already hold. Two failure modes this avoids, both caught only by
manual browser testing:

- Committing per keystroke would record a distinct set for "6" and then
  another for "60" while typing a two-digit weight.
- Committing on every discrete step would do the same for a wheel: five
  arrow-key presses to reach 5 reps produced five separate 1-rep sets
  before this fix, and the same would happen driving a quick-increment
  button repeatedly.

There is deliberately no commit-on-blur either: tabbing from the weight
field into reps is the ordinary way to fill this row, and flushing on
that blur would record the weight alone before reps is ever touched — the
same fragmentation bug in a different guise. The debounce is the only
trigger, and it is not cancelled on unmount, so a value the user actually
entered still lands even if they navigate away within the window.

This keeps FR-008's actual promise — recording an identical repeat of the
previous set stays a single, deliberate action — but moves it off a
generic "confirm" button and onto a small, explicitly-labelled **Repeat
last set** control that appears only for a row that is both pre-filled and
still untouched. It disappears the moment the user changes anything,
because at that point the auto-commit rule above already covers them.

`SetConfirmControl` is retired. What replaces it:

- No control is ever labelled "confirm" or "Add set" for a freshly-entered
  value — there is nothing to tap. FR-003's "no explicit save action" now
  extends to sets too, not just blocks/exercises.
- FR-019's invalid-set rule is unchanged in substance: an invalid row
  simply never fires the commit, and the same inline status text ("Enter a
  load or a rep count to record this set") still tells the user why,
  shown as a plain status line rather than a disabled button's reason.
- FR-025's debounce is unchanged in mechanism (`logging-store.ts`'s
  `addSet`/`draft.ts`'s `addSet` already guard on identical input within
  ~1 second) and now also covers the case where a fast typist's onChange
  fires more than once for what is, in effect, one edit.
- The Repeat control is the one place a tap is still required, precisely
  because it is the one case (identical, untouched, pre-filled) where an
  automatic trigger would fire with no user action at all to anchor it to.

## Consequences

- `SetConfirmControl` and its test are removed; `SetRow` gains an
  edit-tracked commit path plus the `RepeatLastSetControl`.
- `docs/requirements.md` FR-3 and `specs/001-log-a-session/spec.md`
  (FR-003, FR-008, FR-019, FR-025, and the User Story 1 acceptance
  scenarios that named the confirm control) are annotated as superseded by
  this ADR, following the precedent ADR-0006 already set for FR-3.
- `contracts/logging-screen-components.md`'s `SetConfirmControl` row is
  annotated superseded rather than deleted, so the historical contract
  stays legible.
- No schema change: this is presentation/application-layer behavior only:
  `Set` shape, `LoggingDraft` shape, and the storage port are all
  unaffected.

## Addendum: a fresh Bodyweight row needs the same tap

A gap surfaced in review after the above shipped: a Bodyweight load is
"present" (FR-010's OR-rule) even with no added/assisted component
entered (`domain/load.ts`'s `createLoad`), so a brand-new set on a
Bodyweight exercise — no previous set to pre-fill from, nothing else
required — is already valid the instant the row mounts, same as a
pre-filled row. Unlike a pre-filled row, though, it has no prior value to
repeat, so `RepeatLastSetControl`'s original scope ("pre-filled and
untouched" only) left it with no way to ever commit: nothing the user
could edit, and no auto-commit-on-mount allowed (that's the exact
resurrection bug this ADR exists to prevent). `RepeatLastSetControl` now
covers this second case too, under the same "valid but untouched" gate,
labelled **Log this set** instead of "Repeat last set" so it never implies
a previous value that doesn't exist.

Also addressed: a pending debounced commit used to fire against a stale
`blockId` if the exercise entry moved to a different block
(`moveExerciseAcrossBlocks`) before the timer went off — `onConfirm` was a
closure over `blockId`/`entryId` built at the call site
(`logging-screen.tsx`). The first fix attempted here refreshed that
closure through a ref on every render; that turned out not to work, because
a cross-block move unmounts the old `SetRow` entirely and mounts a new one
under the new block — there is no surviving instance left to refresh a ref
*on*, so the stale closure the old timer already captured would still fire
unchanged. The real fix moves the resolution to where the commit actually
lands: `logging-store.ts`'s `addSet` now takes only the entry's own id
(globally unique — `newId()`) and looks up which block currently contains
it at the moment the commit fires (`draft.ts`'s `findBlockIdForEntry`),
never a `blockId` baked in when the edit happened. A commit whose entry no
longer resolves to any block (deleted in the meantime) is a no-op, the
same as before.

And `BlockCard`'s collapse toggle keeps its body mounted rather than
removing it from the tree — conditionally unmounting it would have
discarded a `SetRow`'s own pending-commit state on a mere visual collapse,
which is not the "navigated away" case this ADR's non-cancellation
guarantee is about. It animates the collapse with a CSS grid-rows
transition (`grid-template-rows: 1fr` ↔ `0fr`) rather than the `hidden`
attribute, which can't be animated (its `display: none` applies
instantly); `inert` takes over `hidden`'s other job of pulling the
collapsed content out of the tab order and accessibility tree while it
stays mounted and visually folded.
