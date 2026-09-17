# ADR-0017: SessionDetailScreen moves from auto-save to explicit Save/Discard

## Status

Accepted.

## Context

`SessionDetailScreen` (spec 004 FR-005, "the session detail view MUST be
editable after the fact... with edits persisted through the existing
`StoragePort.saveSession`") persisted every edit automatically: a debounced
effect called `saveSession` on every change to the screen's local `editable`
state, with no user-visible commit step. This was a deliberate choice
(ADR-0012's own context for its "Log workout" fix cites it explicitly:
"`SessionDetailScreen` has none by design ... every change persists
automatically, there is no Save button"), but that framing borrowed FR-1's
wording, which is scoped to spec 001's *logging* screen (recording a fresh
session, one-handed, mid-set, where a discrete Save step would be actively
harmful) — spec 004 FR-005 itself only requires that edits eventually reach
`saveSession`, not that each one do so unprompted.

Design-review feedback (product request) asked for the opposite here:
after-the-fact editing is a deliberate, unhurried action (reviewing a past
session, not recording one live), and every other editable surface in this
app already commits explicitly — `SetRow`'s own Confirm/Cancel (ADR-0010),
and `LoggingScreen`'s "Log workout" (ADR-0012 §1) for the session as a
whole. Auto-saving here was the outlier, not the norm.

## Decision

`SessionDetailScreen` no longer persists on every edit. Every add/rename/
delete/reorder/set-edit action only updates this screen's local `editable`
state (`session-detail-screen.tsx`'s `persist` helper, unchanged in shape).
Two explicit actions replace the old debounced effect:

- **"Save session"** calls `StoragePort.saveSession` once with the current
  `editable` snapshot, then returns to the diary. Disabled while a save is
  in flight or while an exercise is still being created
  (`pendingCreates` — see Consequences).
- **"Discard changes"** returns to the diary without saving, after
  confirming if `editable` has actually diverged from the loaded session
  (`dirtyRef`) — the same confirmation guards the navbar's own back arrow
  (`ADR-0014`'s `backTo`, now paired with a `backGuard` — see
  `presentation/nav/screen-title.tsx`), which is reachable from anywhere on
  the screen and easy to tap by reflex, unlike a button the user chose to
  scroll to.

An exercise **template** edit (`ExerciseTemplatePanel`'s own "Save changes",
reached from an entry's own menu) is unaffected by either of the above — it
still persists immediately, the same as it does from `LoggingScreen`.
ADR-0006 already treats a template as catalogue-level, independent of any
one session's own edit history; "Discard changes" here only ever covers
this screen's own block/exercise-entry/set edits.

## Consequences

- `docs/requirements.md` FR-1's "every change persists automatically" line
  is confirmed as scoped to spec 001's logging screen only — it never
  applied to spec 004 FR-005, and ADR-0012's own citation of it for
  `SessionDetailScreen` is superseded by this ADR.
- A creation still in flight (`createExerciseInSession`, awaited inside
  `onCreateExercise`) must not let "Save session" serialize a stale
  `editable` snapshot ahead of that creation's own `addExerciseToBlock`
  call landing — `pendingCreates` (incremented before the async call,
  decremented in a `finally`) gates the Save button shut for that window.
- A failed save leaves `editable` untouched and reports itself
  (`session-detail-screen__save-error`, `role="alert"`) rather than only
  logging to the console — the prior auto-save behavior already had this
  gap (a silently-failed background save), but an explicit action failing
  silently is a worse user experience than a background one doing so.
- `presentation/nav/screen-title.tsx`'s `useSetScreenTitle` gains an
  optional third `backGuard` parameter; every other caller passes none and
  is unaffected.
- No schema change: this is presentation/application-layer behavior only —
  `editableToSession`/`sessionToEditable` (`application/diary/
  session-editing.ts`) and `StoragePort.saveSession`'s own contract are
  unchanged.
