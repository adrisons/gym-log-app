# ADR-0013: Block rounds removed, the set summary becomes one compact line, blocks reorder via their own menu, and "Move to" drops its redundant suffix

## Status

Accepted.

## Context

Four related refinements from the same design-review pass, gathered here
rather than as four separate ADRs, following the precedent ADR-0010/
ADR-0011/ADR-0012 already set for a single multi-item pass:

1. **Block rounds (ADR-0008/D15) is redundant.** A block's optional
   target round count ("3 rounds" of a circuit) duplicated information
   already visible per exercise: each exercise entry's own logged set
   count already says how many times it was actually done. The field
   added a control to every block card for a number nothing else in the
   app ever read back or computed from.
2. **The set summary read as three loose fields, not one line.** Each
   logged set rendered its load, volume, and effort as separate spans
   inside a wrapping flex row — readable individually, but not compact:
   fitting several sets on screen at once (the actual point of a
   fast-entry logging list) took more vertical/horizontal room than the
   values themselves needed.
3. **Reordering a block had no control at all.** Spec 001 FR-006 already
   *said* "create, rename, reorder, and delete blocks," but only
   rename/delete ever shipped a control — an exercise entry could move up/
   down within its block (and across blocks), but a block itself, once
   created, was stuck in creation order.
4. **"Move to block" repeated itself.** The exercise-entry menu's
   move-to-another-block control already showed a "Move to…" placeholder
   inside its own `<select>`; the label above it read "Move to block,"
   restating both "move" and "block" a second time in the same control.

## Decision

### 1. `Block.rounds` is removed

The field is deleted from `domain/block.ts`'s `Block` interface (and its
positive-integer validation, `InvalidBlockError`, along with it —
nothing else threw that error), `DraftBlock` (`application/ports/
logging-draft.ts`), and every read/write site (`draft.ts`'s
`setBlockRounds`/`withoutRounds`, `logging-store.ts`'s `setBlockRounds`
action, `session-editing.ts`'s round-trip, `BlockCard`'s rounds `<input>`
and its CSS). `docs/requirements.md` §6 requires a version bump and a
tested migration for *any* change to a canonical persisted shape (§3.1),
with no carve-out for a field's removal specifically (unlike Settings'
own D14 exception) — `CURRENT_SCHEMA_VERSION` bumps to 4
(`infrastructure/schema-version.ts`), with a v3→v4 step in both real
adapters' `#checkSchema`. That step has no backfill of its own to run,
the same "additive/removal needs no data rewrite" reasoning ADR-0008's
own v2→v3 step already relied on for the field's *addition* — a v3
record's leftover `rounds` key is simply inert data `Block`'s own type no
longer declares, never stripped and never read again. New
`window.__runV3ToV4MigrationTest` (`test/e2e/fixtures/storage-harness.ts`)
tests this against both real adapters, mirroring the existing
`__runV2ToV3MigrationTest` (Copilot review, PR #30).

### 2. The set summary is one compact "x"-joined line

`toSetSummaryViewModel` (`application/logging/view-models.ts`) replaces
`loadLabel`/`volumeLabel`/`effortLabel` with a single `summaryLine`
string: compact volume and load joined by " x " (e.g. "8 x 70kg"), with
" - <effort word>" appended when effort was recorded (e.g.
"8 x 70kg - Light") — no load segment at all for a `none`-kind load
(unaffected by ADR-0012's earlier fix, just carried into the new shape).
Two new private formatters back this: `formatVolumeCompact` (a bare count
— "8", not "8 reps" — since the line's own "x" already reads as a count)
and `formatLoadCompact` (a tight "70kg", no space, for Weight
specifically; every other load kind keeps `formatLoad`'s existing text).
`formatLoad`/`formatVolume`/`formatEffort` themselves are unchanged —
`progression-list.tsx`'s fixed-column table still uses them as before,
a genuinely different, tabular context where a word-suffixed, aligned
value reads better than this compact line does.

`SetSummaryViewModel` also gains `effortTone?: 'success' | 'warning' |
'danger'`, computed by a new exported `effortTone(effort)` — the exact
success/warning/danger split `EffortPicker`'s wheel already used via its
own local `toneForLevel` (1–2/3–4/5), now the one shared source both
read. `ExerciseSetList` paints a set's row with a `border-left` in that
tone (`.set-summary--success/--warning/--danger`, reusing the
`--color-success/warning/danger` tokens `.wheel-picker__item--*` already
established this exact left-border pattern with) when a set has an
effort recorded, and a transparent 3px border — reserving the same
space, not collapsing it — when it doesn't.

### 3. A block reorders via Move up/Move down on its own menu

`BlockCard` gains `canMoveUp`/`canMoveDown`/`onMoveUp`/`onMoveDown` props
(replacing `rounds`/`onSetRounds`), rendered as two new `OverflowMenu`
items — mirroring `ExerciseEntryCard`'s own Move up/Move down exactly,
including the `disabled`/`aria-disabled` pattern at each end of the list.
Unlike the exercise-entry menu (`OverflowMenu`-only, no inline copy),
these render only inside the block's menu, matching the request
("desde su menú") and not competing with Rename/Delete's existing
inline-vs-menu responsive split for space. A new `reorderBlock(draft,
fromIndex, toIndex)` (`application/logging/draft.ts`) mirrors
`reorderBlockExercise`'s own splice-based implementation one level up;
`logging-store.ts` gains a matching `reorderBlock` action.
`SessionDetailScreen`, which edits an `EditableSession` locally rather
than through the store, gets the equivalent inline (`moveBlock`).

### 4. "Move to block" becomes "Move to"

`ExerciseEntryCard`'s move-to-another-block field label drops "block" —
the `<select>`'s own "Move to…" placeholder option already carries that
word, so the label above it only needed "Move to."

## Consequences

- `domain/errors.ts`'s `InvalidBlockError` (and its barrel export,
  `domain/index.ts`) is deleted — its only use was `Block.rounds`
  validation.
- `SetSummaryViewModel.loadLabel`/`volumeLabel`/`effortLabel` are gone,
  replaced by `summaryLine`/`effortTone`; `ExerciseSetList` is the only
  consumer, updated alongside. `summaryLine` "x"-joins volume and load
  only when *both* are present — a valid load-only set (FR-019, no
  volume) shows just its load, never a "—" standing in for the missing
  half of a join with nothing on the other side (Copilot review, PR #30).
- `CURRENT_SCHEMA_VERSION` is 4 (§1 above); both real adapters'
  `#checkSchema` gain a v3→v4 step, and a new `__runV3ToV4MigrationTest`
  harness function (mirroring `__runV2ToV3MigrationTest`) is exercised by
  both `test/e2e/indexed-db-adapter.contract.spec.ts` and
  `test/e2e/file-system-adapter.contract.spec.ts`.
- `docs/requirements.md` §3.1 (Block entity description), FR-2 (rounds
  bullet removed, block-reorder-via-menu noted), FR-3 (set summary
  format), D15 (superseded by new D20); `specs/001-log-a-session/spec.md`
  FR-003 and FR-006; `specs/001-log-a-session/data-model.md` (`DraftBlock`,
  `setBlockRounds`/new `reorderBlock`, and the superseded three-field
  `SetSummaryViewModel` shape); `specs/002-domain-and-ports/data-model.md`
  (`Block.rounds`) — all annotated as amended by this ADR, following the
  precedent already set by ADR-0006 through ADR-0012 for amending FR/
  data-model text in place rather than deleting it outright (Copilot
  review, PR #30, flagged these governing artifacts as originally missed).
