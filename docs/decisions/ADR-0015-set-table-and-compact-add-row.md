# ADR-0015: Sets rendered as a Reps/Load table; a compact single-line add-set row for the common Weight+Reps case

## Status

Accepted.

## Context

A design-review pass (a Claude Design canvas exploration, confirmed by the
project owner) asked for the logging screen's sets display and add-set
form to read more like a table — column headers, aligned values, a single
trailing action per row — closer to the project's stated Notion-inspired,
low-chrome visual identity (`docs/design.md` §1.2's refinement note) than
the previous compact "x"-joined line (ADR-0013) and reps wheel-picker
(FR-3) gave it.

Two existing, explicitly-bound pieces of behavior are affected:

- `docs/requirements.md` FR-3 states "Reps are chosen with a scrollable
  wheel (1 to 100, plus an unset position for a load-only set); the wheel
  itself is the quick-increment mechanism, so it carries no separate ±
  buttons either."
- `docs/requirements.md` FR-3 (ADR-0013, restyled again by ADR-0014) states
  a set's summary is "one compact line — volume and load combined (e.g.
  '8 x 70kg')".

This ADR records that both are superseded for the specific case they
name — a plain Weight load with Reps volume and no effort tracking, which
is also this app's own documented default template (ADR-0006) — not
retired outright.

## Decision

### 1. The sets list renders as a two-column table

`ExerciseSetList` gains a `.sets-header-row` above the set list (Reps/
Duration/Distance — derived from the exercise's own `volumeKind`, never
hard-coded — and Load), and each already-logged set's row
(`.set-summary`) lays its reps and load values out in the same CSS grid
columns (`50px 80px 1fr 44px`) as that header, so labels/values/the
trailing delete control all line up as true columns rather than one
"x"-joined string. `toSetSummaryViewModel` (view-models.ts) gains
`volumeColumn`/`loadColumn`/`effortSuffix` alongside the existing
`summaryLine` (kept for any future single-line consumer) to back this
split rendering. ADR-0012's "no load placeholder when the load type is
None" rule is preserved: an absent column renders empty, never a "—"
dash.

Each row drops the previous "⋮" `OverflowMenu` (Edit/Delete) in favor of a
bare trailing "×" that only deletes; tapping the row's own value cells
(a `<button>` wrapping them) opens the same in-place edit form Edit used
to. This keeps editing reachable without a visible menu, matching the
approved design's one-icon-per-row footprint.

### 2. A compact single-line add-set row for Weight+Reps, no effort

`SetRow` gains an `isCompactRow` branch — `effectiveLoadKind === 'weight'
&& effectiveVolumeKind === 'reps' && !trackEffort` — rendering plain
numeric `<input>`s for reps and weight in the same grid columns as the
table above, with a trailing "+"/"✓" Confirm and (when offered) a small
Cancel, instead of the reps wheel-picker and the stacked field layout.
Every other load/volume/effort combination (Band, Bodyweight, Free text,
Duration, Distance, or effort tracking on) is unaffected — `SetRow` falls
through to its existing stacked form, wheel-picker included, exactly as
before. This is a deliberate scope limit, not an oversight: collapsing
every combination into one line would either drop a real field or force
horizontal scrolling on a narrow phone, the exact interaction this row
exists to avoid.

The compact reps/weight inputs are plain `type="number"` fields with the
native spinner suppressed (`appearance: textfield` plus the WebKit
spin-button reset) — a tap-to-type cell, not a stepper, so the row reads
as one line of table cells rather than reintroducing a scroll/drag
interaction under a different control.

## Consequences

- `docs/requirements.md` FR-3's wheel-picker bullet gains a parenthetical
  noting this ADR's scoped supersession (Weight+Reps, no effort only —
  every other load/volume/effort combination keeps the wheel/stacked
  form).
- `docs/requirements.md` FR-3's ADR-0013/ADR-0014 set-summary bullet gains
  a parenthetical noting the summary now renders as two table columns
  (plus an effort suffix) rather than one "x"-joined string, with
  `summaryLine` kept only as a computed convenience, not the rendered
  shape.
- `docs/design.md` §1.2's refinement note gains a sentence on the sets
  table/compact-row pattern, alongside its existing font/color/radius
  refinement notes.
- `specs/001-log-a-session/contracts/logging-screen-components.md`'s
  `SetConfirmControl`/set-summary rows are updated to describe the table
  layout and the Weight+Reps compact-row scope limit.
- Unit tests across `set-row.test.tsx`, `exercise-set-list.test.tsx`,
  `logging-screen.test.tsx`, `session-detail-screen.test.tsx`, and
  `view-models.test.ts` are updated to query the new markup (a plain
  `spinbutton` for the compact reps field rather than a `listbox`; a bare
  "×"/row-tap instead of the "⋮ actions" menu; the view model's new
  `volumeColumn`/`loadColumn`/`effortSuffix` fields).
</content>
