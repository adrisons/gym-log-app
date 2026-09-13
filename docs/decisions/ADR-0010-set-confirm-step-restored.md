# ADR-0010: Recording a set gets an explicit confirm step back, plus editing a set in place, a tighter template-driven validation rule, and two related screen refinements

## Status

Accepted.

## Context

ADR-0007 removed the confirm step from set entry: any edit that made the
pending set valid (FR-019's domain-minimum "a load, a volume, or both")
committed it immediately, debounced only to coalesce rapid keystrokes/wheel
steps into one write. In practice this produced a real, reported problem:
an exercise tracked by both Weight and Reps only needs *one* of the two to
satisfy FR-019's minimum, so filling in reps alone — reaching for the
weight field next — already committed a set with `load: { kind: 'none' }`,
silently discarding the load the user was about to enter. There was no way
to fill in a multi-field set without racing the auto-commit.

Four smaller, related refinements shipped in the same pass, gathered here
rather than as separate ADRs since they came out of one design-refinement
session:

1. The set summary row showed only load and volume, even though
   `toSetSummaryViewModel` already computed an `effortLabel` — effort went
   unseen once recorded.
2. A logged set's only action was a bare "Delete set" button/menu item —
   there was no way to fix a typo in an already-recorded set without
   deleting it and re-entering it as a new one (losing its original
   position in the list).
3. `LoadTypePicker` and the Volume-kind radiogroup (`ExerciseTemplatePanel`)
   both set `aria-checked` correctly on their `role="radio"` options, but
   no stylesheet rule ever painted a visual difference for the checked
   state — the picker looked unselected no matter what was actually chosen.
4. `SessionDetailScreen` linked each exercise entry to the progression
   screen; with spec 005 (Insights) now the intended home for progression-
   class stats, that additional entry point was no longer wanted.

## Decision

### 1. `SetConfirmControl` is back, with a template-driven requirement

Every exercise's set-entry form (`SetRow`) gets an explicit "Add set"
button again, `disabled` (with a status line naming what's missing) until
the row holds a value for **every field the exercise's current template
actually tracks** — not merely FR-019's domain minimum. Concretely: a load
is required whenever the template's load kind is anything but `bodyweight`
or `none` (Bodyweight is "present" with no component typed, by design —
`domain/load.ts`; None has no field to fill), and a volume is always
required (every template names a volume kind — reps, duration, or
distance — there is no "untracked" option). Editing an already-recorded
set (below) is the one exception: it uses FR-019's plain domain-minimum
rule instead, since it starts from an already-valid set and the template
it was recorded under may have moved on since (ADR-0006).

No field edit commits anything on its own any more, and there is no
per-field debounce in `SetRow` — the Confirm tap is the only trigger.
`draft.ts`'s existing ~1-second identical-input dedupe (FR-025) is kept at
the store layer, now mostly guarding a double-tap on the button rather than
a flurry of keystrokes.

`RepeatLastSetControl` is retired: a row pre-filled from the previous set
(FR-008) is simply already valid, so Confirm is enabled immediately and one
tap still suffices — there is no need for a separately-labelled control to
carry that meaning. The status line for an unconfirmable row now names
exactly what's missing (e.g. "Enter a weight to record this set." when
reps is already filled) instead of the old, permanently-inaccurate "Enter a
load or a rep count to record this set." (which reads as either field being
enough, even for a template that requires both).

### 2. A set can be edited in place

New capability — spec 001 never had this (`session-editing.ts`'s own doc
comment used to say so explicitly). Each logged set's row gains an
overflow menu (mirroring the exercise/block header menus) with **Edit** and
**Delete set**, replacing the old bare delete button/menu-item. Edit opens
the same `SetRow` form, pre-filled with that set's own load, volume, *and*
effort (add-mode prefill deliberately never carries effort forward —
FR-008 — but this is a real value already recorded on this exact set, not
a forwarded guess), using **that set's own load/volume kind**, never the
exercise's current template — an already-recorded `Set` keeps exactly what
it was given (ADR-0006), so editing lets the user correct its values
without silently re-kinding it to whatever the template has since become.
If the template no longer tracks effort, the field is hidden but the
set's existing effort value is preserved on save rather than silently
dropped (ADR-0006 cuts both ways: a template change must not reconcile or
erase history, including via an edit that happens to touch other fields).

`application/logging/draft.ts` gains `updateSet` (mirrors `addSet`'s
validation via domain `createSet`, replacing one set by id instead of
appending); `logging-store.ts` gains a matching `updateSet` action, with no
debounce of its own (an edit's confirm is always one explicit action).
`SessionDetailScreen`, which edits an `EditableSession` locally, gets the
equivalent inline.

### 3. Save space: the form collapses to "+ Add set" once there's something to show

Within one exercise entry, the add-set form now opens by default only
while the entry has no sets yet (there's nothing to show instead); once a
set is confirmed — or on mount, for an entry that already has sets — the
form collapses to a compact "+ Add set" button. Tapping it, or a set's
"Edit" menu item, reopens the same form slot. Deleting an entry's last
remaining set reopens the add form automatically (the entry is back to
"nothing entered"). This — the summary row's added effort span, the
edit/delete menu, and the add/edit toggle — is factored into one new
shared component, `ExerciseSetList`, used by both `LoggingScreen` and
`SessionDetailScreen` (previously near-duplicated inline in each).

### 4. Radio-style pickers now show their selection

`.logging-button[aria-checked='true']` gets an accent background/border in
`logging.css` — a pure CSS fix; `LoadTypePicker` and the Volume-kind
radiogroup were already setting `aria-checked` correctly, nothing about
their markup or logic changed.

### 5. `SessionDetailScreen` no longer links to the progression screen

The per-exercise "View … progression" link is removed from session detail
entries. Progression-class stats are, for now, reachable only from search
results (spec 004) and Insights (spec 005) — the progression screen itself
and its other entry points are unchanged; only this one link is gone
(`specs/004-diary-search-progression/spec.md` FR-013 amended accordingly).

### 6. The `/exercises` catalogue screen creates and edits templates too

`ExerciseCatalogueScreen` gains a "New exercise" control (name plus its
set-entry template together, via a new `CreateExercisePanel`) and its
management panel (`ExerciseCataloguePanel`) gains "Edit tracked fields…",
opening the existing `ExerciseTemplatePanel`. Previously the only way to
set a new exercise's template, or change an existing one's, was per-entry
from the logging or session-detail screens; both use-cases this calls
(`createExercise`, `updateExerciseTemplate`) already existed. The load-
type/volume-kind/track-effort controls themselves are factored out of
`ExerciseTemplatePanel` into a shared `ExerciseTemplateFields` component so
the "create" and "edit" forms can never drift apart on what a template
consists of.

## Consequences

- `RepeatLastSetControl` (component and test) is deleted.
- `docs/requirements.md` FR-3 (D12), FR-5 (D17), `specs/001-log-a-session/
  spec.md` (FR-003, FR-008, FR-019, FR-025 amended; FR-029 added for
  editing a set in place), `specs/001-log-a-session/contracts/logging-
  screen-components.md` (`SetConfirmControl` restored, `RepeatLastSetControl`
  retired), and `specs/004-diary-search-progression/spec.md` (FR-013
  amended) are all annotated as superseded/amended by this ADR, following
  the precedent ADR-0006/ADR-0007/ADR-0009 already set for amending FR text
  in place rather than rewriting history.
- No schema change: `Set`'s shape, `LoggingDraft`'s shape, and the storage
  port are all unaffected — this is presentation/application-layer
  behavior only, the same scope ADR-0007 itself had. `createExercise`/
  `updateExerciseTemplate` (application layer) already existed; only new UI
  reaches them.
