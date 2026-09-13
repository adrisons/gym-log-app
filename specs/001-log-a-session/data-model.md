# Phase 1 Data Model: Log a Session

Application-layer shapes this plan adds on top of spec 002's domain model
(`src/domain/`, unchanged by this plan) and finalized `StoragePort`
(extended per `contracts/storage-adapters-and-ports.md`). Nothing here is a
`domain/` type — `LoggingDraft` in particular is explicitly UI/session
state, not a domain entity (spec.md Key Entities; `contracts/storage-port.md`
from spec 002).

## `LoggingDraft` (`src/application/logging/draft.ts`)

Replaces spec 002's placeholder (`{ id: string; [key: string]: unknown }`)
with a real, nested shape — required before draft repoint/prune (FR-024,
merge/cascade-delete) can be verified against anything but a flat
convention (`contracts/storage-port.md` "Known limitation", assigned to
this spec).

```ts
interface LoggingDraft {
  id: string; // stable across the draft's lifetime; not a SessionId (FR-024: not a Session)
  dateTime: string; // ISO 8601, user-editable (FR-001), set when the draft was created
  blocks: DraftBlock[]; // same ordering rule as Session.blocks — [] is valid
  notes: string;
  overallFeeling?: Effort;
  durationSeconds?: number;
  lastEditedAt: string; // ISO 8601, updated on every mutation — research.md §4
}

interface DraftBlock {
  id: string; // draft-local stable key (list reordering needs a key; Block itself has none)
  name?: string;
  type: 'straightSets' | 'superset' | 'circuit';
  rounds?: number; // target round count for the whole block (ADR-0008); mirrors domain `Block.rounds`
  exercises: DraftExerciseEntry[];
}

interface DraftExerciseEntry {
  id: string; // draft-local stable key
  exerciseId: ExerciseId; // same reference rule as ExerciseEntry (FR-011/FR-020)
  notes: string;
  sets: DraftSet[];
}

interface DraftSet {
  id: string; // draft-local stable key (needed for the 5-second undo to target one set)
  volume?: Volume;
  load: Load;
  effort?: Effort;
  setKind: 'warmUp' | 'working' | 'toFailure';
  completed: boolean;
}
```

- `DraftBlock`/`DraftExerciseEntry`/`DraftSet` mirror `Block`/`ExerciseEntry`/`Set`
  field-for-field, plus one addition: a draft-local `id`. The domain
  entities themselves carry no `id` at that level (order = list position,
  per spec 002's data-model.md) because a stored `Session` never needs to
  address "block 2, entry 1, set 3" independently of its position — but the
  *draft* does, for two reasons neither domain type has to deal with: (a)
  presentation needs a stable React list key across reorders, and (b) the
  undo stack (below) needs to say "reinsert exactly this deleted item"
  without ambiguity if positions shifted since.
- On submit (draft → `Session`, research.md §4), the conversion
  `draftToSession(draft: LoggingDraft, id: SessionId): Session` strips every
  draft-local `id` field, producing a plain domain `Session` — the only
  place these two shapes are related to each other.
- Construction goes through `createDraft(...)`/`updateDraftBlock(...)`
  etc. in `src/application/logging/draft.ts` — plain functions, not domain
  smart constructors (this is application state, not a domain rule) —
  following the same "one supported construction path" convention spec
  002 established, but without throwing `DomainError`: a draft can hold
  transient, not-yet-valid-as-a-`Set` data (e.g., a set being entered with
  no volume or load yet) since FR-019's rejection only applies at confirm
  time (`addSet`, below), not to draft shape itself.

## Use cases (`src/application/logging/use-cases.ts`)

Each takes the relevant `StoragePort` (research.md §6) plus its own
arguments and returns a `Promise` (every write is optimistic — the caller,
i.e. the Zustand store, applies the in-memory change first and calls the
use case to persist after, per constitution Principle II — the use case
itself does not decide UI ordering, it just performs the persistence
step and returns the updated value).

| Use case | FRs | Behavior |
|---|---|---|
| `openLoggingForm(storage)` | FR-001, FR-024, research.md §4 | Loads the stored draft. If none, creates a new `LoggingDraft` with `dateTime`/`lastEditedAt` = now. If one exists and `lastEditedAt` is today (local), returns it unchanged. If one exists and `lastEditedAt` is an earlier local day, promotes it (`draftToSession` + `saveSession` + `discardDraft`) then creates and returns a fresh draft. |
| `discardDraft(storage)` | FR-024 | `discardDraft()` on the port; caller resets its in-memory draft state. |
| `addBlock(draft, name?, type)` | FR-006 | Appends a `DraftBlock`; returns the updated draft. Pure — persistence is the caller's `saveDraft` call. |
| `renameBlock` / `reorderBlockExercise` / `moveExerciseAcrossBlocks` | FR-006 | Pure draft transforms, list-position moves only (FR-018 — no separate order field). |
| `setBlockRounds(draft, blockId, rounds?)` | FR-2 (ADR-0008) | Sets or clears (`undefined`) a block's target round count. Unvalidated at this layer — a draft may hold a transient, not-yet-valid value; domain `createBlock` rejects a non-positive-integer `rounds` at promotion time (`draftToSession`), the same point every other draft-only laxness is caught. |
| `deleteBlock(draft, blockId)` | FR-004, FR-023 | Removes the block; returns `{ draft: updatedDraft, undo: UndoEntry }` (see Undo below) — cascades to the block's entries/sets by construction (they're nested, so removing the block removes them). |
| `addExerciseEntry(draft, blockId, exerciseId)` | FR-002 | Appends a `DraftExerciseEntry` with `sets: []`. No implicit set creation (mirrors domain FR-014's "no synthesized entry" spirit one level up). |
| `deleteExerciseEntry(draft, blockId, entryId)` | FR-004 | Same undo shape as `deleteBlock`, one level down. |
| `prefillNextSet(draft, blockId, entryId)` | FR-008 | Returns `{ volume, load } \| undefined` — the entry's last set's volume/load, or `undefined` if the entry has no sets yet. Effort is never included (FR-008 explicit exclusion). Pure query, not a mutation. |
| `addSet(draft, blockId, entryId, input, now)` | FR-003, FR-008, FR-010, FR-019, FR-025, FR-026 | Validates via domain `createSet` (throws `InvalidSetError` if neither volume nor a non-`none` load — FR-019; caller/UI must not offer a confirm control until this would pass, per spec.md's "silent no-op or unavailable" clarification). Debounce: if the immediately preceding set on this entry has an identical `{ volume, load, effort, setKind }` and was added within 1000 ms (compares against the store's own last-confirm timestamp, not wall-clock re-derivation), returns the existing draft unchanged instead of appending (FR-025). Otherwise appends a new `DraftSet`. |
| `deleteSet(draft, blockId, entryId, setId)` | FR-004 | Same undo shape as `deleteBlock`/`deleteExerciseEntry`. |
| `setSessionDateTime(draft, iso)` | FR-001 | Replaces `draft.dateTime`. |
| `searchExercises(query, catalogue)` | FR-002, FR-016 | Uses `shared/fuzzy-match.ts` (research.md §3) over `canonicalName` + `aliases`; most-used/most-recently-used ranking (FR-002) is computed from the sessions already loaded for the current context — usage-frequency and last-used-at are folded into the ranking key alongside match quality, not stored as separate fields on `Exercise`. |
| `createExercise(storage, input)` | FR-002, FR-015 | Builds an `Exercise` (`application/logging/ids.ts`'s `newExerciseId()` for the id) and `saveExercise`s it. |
| `renameExerciseWithCollisionCheck(storage, id, newName)` | FR-020, FR-022 | Looks up every exercise's `canonicalName`/`aliases` for a case/accent-insensitive collision; if found, returns `{ status: 'collision', collidesWith: ExerciseId }` for the caller to offer a merge (never auto-merges); if none, calls domain `renameExercise` + `saveExercise`. |
| `mergeExercises(storage, survivorId, loserId)` | FR-017, FR-019 | Thin wrapper over `StoragePort.mergeExercises` — the domain-local half (`mergeExerciseIdentities`) plus cross-session reassignment already live at the port (spec 002 finalized this split; this plan does not re-derive it). |
| `deleteExerciseCascade(storage, id, hasHistory, confirmed)` | FR-018 | Calls domain `deleteExercise(hasHistory, confirmed)` first (throws `ExerciseDeleteConfirmationRequiredError` if unconfirmed with history — caller maps that to the confirm/merge-offer dialog), then `StoragePort.deleteExerciseCascade`. |
| `suggestFreeTextLoads(exerciseId, sessions)` | FR-012 | research.md §8 — derived, not persisted. |
| `listBandLabels` / `saveBandLabels` (reorder is a client-side array move + `saveBandLabels`) | FR-011 | Thin wrapper over the new port methods (research.md §7). |

### Undo (FR-004, FR-023)

```ts
interface UndoEntry {
  id: string; // matches the deleted item's draft-local id
  kind: 'block' | 'exerciseEntry' | 'set';
  restore: (draft: LoggingDraft) => LoggingDraft; // closes over the removed item + its original index
  expiresAt: number; // Date.now() + 5000, set by the store when the entry is pushed
}
```

Lives in the Zustand store (research.md §5), not in `StoragePort` — it is
never persisted (an app close during the window doesn't need to restore
it; spec.md's own edge case says the deletion is already final at that
point). `restore` re-inserts at the original index: if the containing
list has since shrunk (e.g. another deletion happened in between), it
clamps to the new end rather than throwing — reordering during an open
undo window is possible in this UI (nothing blocks it) and must not crash.
Two independent `UndoEntry`s can be live at once per spec.md's overlapping-window
edge case (a set deleted, then its block deleted before the set's own
timer expires) — the store keeps a list, not a single slot, and
`deleteBlock`'s cascade does **not** clear any `UndoEntry` already queued
for a set inside it (spec.md: "the already-deleted set stays deleted,"
i.e. its own undo entry, if still live, stays live and independent).

## View models (`src/application/logging/view-models.ts`)

Presentation-facing shapes so `presentation/` never touches `Load`/`Volume`'s
raw discriminated unions directly for display formatting (keeps formatting
logic — e.g. "kg", pluralizing "rep"/"reps" — out of components):

```ts
interface SetSummaryViewModel {
  id: string;
  loadLabel: string; // e.g. "60 kg", "Band: red", "Bodyweight +10 kg", "—" for None
  volumeLabel: string; // e.g. "8 reps", "45 s", "400 m", "—" if absent
  effortLabel?: string; // e.g. "3 — Moderate" (ADR-0003: number + word, always together)
  setKind: 'warmUp' | 'working' | 'toFailure';
}

interface ExerciseEntryViewModel {
  id: string;
  exerciseName: string; // resolved from exerciseId via the catalogue, not stored redundantly
  sets: SetSummaryViewModel[];
}

interface BlockViewModel {
  id: string;
  displayName: string; // block.name, or "Block N" from position (FR-007) — never "Untitled"
  type: 'straightSets' | 'superset' | 'circuit';
  entries: ExerciseEntryViewModel[];
}
```

Built by a `toBlockViewModel(block: DraftBlock, index: number, catalogue: Exercise[])`
mapper in `application/logging/view-models.ts` — the one place FR-007's
"Block N" fallback and the effort word-label table (ADR-0003) are applied,
so no component computes them independently.

## Identifiers

No new identifier types. `LoggingDraft`/`DraftBlock`/`DraftExerciseEntry`/`DraftSet`
`id` fields are plain `string` (via `crypto.randomUUID()`, research.md §2)
— deliberately **not** branded like `SessionId`/`ExerciseId`: they never
leave the draft, are never compared against a domain identifier, and
`draftToSession` discards them entirely on submit, so there is no
interchangeability hazard branding would guard against.
