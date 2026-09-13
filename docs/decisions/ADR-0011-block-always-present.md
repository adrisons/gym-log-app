# ADR-0011: An exercise always belongs to a block; the logging form opens with one pre-seeded; block chrome flattens for space

## Status

Accepted.

## Context

The logging form let a user add an exercise with no block at all, via a
top-level "Add exercise" control. `LoggingDraft`'s in-memory representation
modeled this as a `DraftBlock` with a presentation-only `loose: true` flag —
rendered "bare" (no header, no collapse toggle, no name) — that was never
part of the persisted `Session`/`Block` domain shape; `toPersistableDraft`
stripped it before every save. `Block` (`domain/block.ts`) has no concept of
"loose" and never did.

That mismatch produced a real, reported bug: the exercise looked blockless
while being entered, but the moment the workout was saved and the session
detail view was reopened, the same exercise reappeared inside a fully
chromed block (a name-less "Block N") — because on reload there was no
`loose` flag to reconstruct; the persisted data was, and always had been,
an ordinary block. Nothing was lost, but the UI silently disagreed with
itself between entry and review.

Two flattening requests arrived alongside the fix, gathered here rather than
as a separate ADR since they came out of the same design-refinement pass:
removing the border from the block collapse-toggle and the three-dot
overflow-menu trigger, dropping the set count from both the block summary
and the diary's per-session summary line, and having blocks span the full
screen width with square corners to reclaim horizontal space.

## Decision

### 1. The "loose" block is retired; a block is always a real block

`DraftBlock.loose` is removed from the port type entirely. `createDraft`
now seeds `LoggingDraft` with one empty block from the start, instead of
zero. `addExerciseEntry` called with no explicit `blockId` appends to the
last existing block, creating one only in the edge case of literally zero
blocks (every block was deleted). `toPersistableDraft` — whose only job was
stripping the flag before a save — is deleted; adapters write the draft
object directly.

`draftHasContent` (gating both draft persistence, FR-024, and "Log
workout" availability, FR-027) is redefined from "the draft has at least
one block" to "at least one block has at least one exercise entry" — a
bare block is no longer a signal of user intent now that one exists by
default in every fresh draft. FR-024, FR-027, and User Story 1's
Acceptance Scenario 10 in `specs/001-log-a-session/spec.md` are amended
accordingly, as is D16 in `docs/requirements.md`.

### 2. Every block gets its own "add exercise" control; no top-level one

The single top-level "Add exercise" control (the one that used to produce
a loose exercise) is removed. Each block's own footer carries "Add
exercise to <block name>" — including the first, pre-seeded block — so
there is always at least one such control visible. The "Add block" button
stays below the last block, unchanged, for adding further blocks. Per
FR-028, a block's add-exercise control is unavailable while an unresolved
pending-draft recovery banner is showing, same as it already was for every
other add control.

### 3. Flatter block chrome

- The block collapse-toggle and the overflow-menu trigger (`.overflow-menu
  __trigger`) both drop their border (`border-color: transparent`, not
  `border: none`, so the box model and click/tap target size are
  unaffected).
- A block's summary line, and a session's row in the diary, drop the set
  count — a block now shows only its exercise count (e.g. "3 exercises"),
  and a diary row shows only its `kindOfWork`, if any.
  `DiarySessionSummary.setCount` is removed from the type; nothing
  computes it any more.
- `.block-card--collapsible` (the block card used on the logging and
  session-detail screens) spans the full screen width via negative
  inline margins that cancel the screen's own side padding, and its
  border-radius drops to 0. This is a deliberate, narrowly-scoped
  departure from `docs/design.md`'s "every structural surface shares one
  rounded identity" rule (§7.4) — for this one surface only, to reclaim
  horizontal space on narrow screens. The shared base `.block-card` class
  (also used by dialogs elsewhere) is untouched; only the
  `--collapsible` modifier gets the edge-to-edge treatment.

## Consequences

- `DraftBlock.loose` (port type), `toPersistableDraft`
  (`application/logging/draft.ts`), and `BlockCard`'s `bare` prop are all
  deleted; the storage adapters (`indexed-db-storage-adapter.ts`,
  `file-system-storage-adapter.ts`) write `saveDraft`'s input directly.
- No schema change: `Block`/`Session`'s persisted shape never had a
  `loose` concept to begin with — this was purely a draft-side,
  never-persisted presentation artifact. `LoggingDraft`'s own shape is
  unaffected (still just an ordered list of blocks); the storage port
  contract is unaffected.
- `docs/requirements.md` FR-1 (pending-draft gate), FR-2 (block summary,
  no set count), and D16 (persistence gate); `specs/001-log-a-session/
  spec.md` FR-024, FR-027, and User Story 1's Acceptance Scenario 10;
  `specs/004-diary-search-progression/spec.md` FR-002 and
  `data-model.md`'s `DiarySessionSummary` doc — all annotated as
  amended by this ADR, following the precedent already set by
  ADR-0006/ADR-0007/ADR-0009/ADR-0010 for amending FR text in place.
- `docs/design.md` §7.4 gets a scoped exception note for
  `.block-card--collapsible`, rather than a rewrite of the corner-radius
  rule itself — every other structural surface keeps the base radius.
