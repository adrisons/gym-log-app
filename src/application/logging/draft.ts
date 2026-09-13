/**
 * `LoggingDraft` — the not-yet-submitted state of the logging screen
 * (spec 001 Key Entities; data-model.md "LoggingDraft"). Explicitly NOT a
 * domain entity (`contracts/storage-port.md` from spec 002) — application
 * state that mirrors `Session`/`Block`/`ExerciseEntry`/`Set` field-for-field
 * plus one addition per level: a draft-local `id`, needed for stable list
 * keys and for the undo stack to target one item unambiguously.
 *
 * `createDraft`/`draftToSession` are this module's "only supported
 * construction path" (mirrors the domain layer's smart-constructor
 * convention) — but unlike a domain smart constructor, these never throw:
 * a draft may legitimately hold transient, not-yet-valid-as-a-`Set` data
 * (FR-019's rejection applies at confirm time, in `use-cases.ts`'s
 * `addSet`, not to the draft shape itself).
 *
 * The type definitions themselves live in
 * `@/application/ports/logging-draft` (re-exported below), not here —
 * `application-ports` may import only `domain`, so `storage-port.ts`
 * cannot reference a type declared in this file; this file imports the
 * type back instead (`application` → `application-ports` is allowed) and
 * adds the construction functions, which belong at the application layer.
 */

import { createBlock } from '@/domain/block';
import { createSession } from '@/domain/session';
import { createSet } from '@/domain/set';
import type { Session } from '@/domain/session';
import type { SessionId, ExerciseId } from '@/domain/ids';
import type { Volume } from '@/domain/volume';
import type { Load } from '@/domain/load';
import type { Effort } from '@/domain/effort';
import { newId } from '@/shared/id';
import type {
  LoggingDraft,
  DraftBlock,
  DraftExerciseEntry,
  DraftSet,
} from '@/application/ports/logging-draft';

export type { LoggingDraft, DraftBlock, DraftExerciseEntry, DraftSet };

/**
 * FR-024/FR-027 (ADR-0008): whether the draft has anything worth keeping —
 * the same threshold that gates both the first `saveDraft` call (nothing
 * is persisted until this is true) and the "Log workout" control's own
 * availability, so "worth saving as a draft" and "worth registering as a
 * Session" never diverge. Editing only the session's date-time does not
 * add a block, so it alone never makes this true (FR-024's explicit
 * carve-out for that path).
 */
export function draftHasContent(draft: LoggingDraft): boolean {
  return draft.blocks.length > 0;
}

/** Creates a brand-new, empty draft dated `now` (ISO 8601). */
export function createDraft(now: string): LoggingDraft {
  return {
    id: newId(),
    dateTime: now,
    blocks: [],
    notes: '',
    lastEditedAt: now,
  };
}

/**
 * Converts a draft to a real `Session`, stripping every draft-local `id`
 * field at every nesting level (data-model.md "LoggingDraft"). The only
 * place these two shapes are related to each other — used by
 * `openLoggingForm`'s promotion path (research.md §4), never called on a
 * draft the caller intends to keep editing.
 */
export function draftToSession(draft: LoggingDraft, id: SessionId): Session {
  const blocks = draft.blocks.map((block) =>
    createBlock({
      ...(block.name !== undefined ? { name: block.name } : {}),
      // `block.loose` is deliberately dropped here — presentation-only,
      // never part of the persisted `Block` (see `domain/block.ts`).
      type: block.type,
      exercises: block.exercises.map((entry) => ({
        exerciseId: entry.exerciseId,
        notes: entry.notes,
        sets: entry.sets.map((set) =>
          createSet({
            ...(set.volume !== undefined ? { volume: set.volume } : {}),
            load: set.load,
            ...(set.effort !== undefined ? { effort: set.effort } : {}),
            setKind: set.setKind,
            completed: set.completed,
          }),
        ),
      })),
    }),
  );

  return createSession({
    id,
    dateTime: draft.dateTime,
    blocks,
    notes: draft.notes,
    ...(draft.overallFeeling !== undefined
      ? { overallFeeling: draft.overallFeeling }
      : {}),
    ...(draft.durationSeconds !== undefined
      ? { durationSeconds: draft.durationSeconds }
      : {}),
  });
}

/**
 * Drops presentation-only fields before a draft is written to storage.
 * `DraftBlock.loose` is a rendering hint (docs/requirements.md §6: an
 * undocumented field reaching the actual persisted bytes is an implicit
 * schema change, the same reasoning `draftToSession` already applies when
 * promoting a draft to a `Session`). Both real adapters call this at their
 * write boundary so `loose` never reaches disk/IndexedDB; a block that was
 * loose simply shows its header again after a reload, matching what a
 * freshly-migrated v1 record (which never had the field) already renders.
 */
export function toPersistableDraft(draft: LoggingDraft): LoggingDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) => ({
      id: block.id,
      ...(block.name !== undefined ? { name: block.name } : {}),
      type: block.type,
      exercises: block.exercises,
    })),
  };
}

/**
 * Repoints every reference to `fromId` onto `toId` in the *active,
 * in-memory* draft (ADR-0008) — the logging store's own counterpart to
 * `infrastructure/draft-cascade.ts`'s `repointDraftExerciseId`, which only
 * ever touches the *stored* draft (`StoragePort.mergeExercises`'s own
 * contract). `application/` cannot import `infrastructure/`
 * (`docs/architecture.md`'s layer table), and the active draft is not
 * necessarily the stored one any more (it may still be unpersisted), so
 * the store must repoint its own in-memory copy directly rather than
 * re-fetching `storage.getDraft()` and trusting it to be the same draft.
 */
export function repointDraftExerciseId(
  draft: LoggingDraft,
  fromId: ExerciseId,
  toId: ExerciseId,
): LoggingDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) => ({
      ...block,
      exercises: block.exercises.map((entry) =>
        entry.exerciseId === fromId ? { ...entry, exerciseId: toId } : entry,
      ),
    })),
  };
}

/**
 * Removes every exercise entry (and its sets) referencing `exerciseId` from
 * the active, in-memory draft — the store's counterpart to
 * `pruneDraftExerciseId`, for the same reason `repointDraftExerciseId`
 * above has one.
 */
export function pruneDraftExerciseId(
  draft: LoggingDraft,
  exerciseId: ExerciseId,
): LoggingDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) => ({
      ...block,
      exercises: block.exercises.filter(
        (entry) => entry.exerciseId !== exerciseId,
      ),
    })),
  };
}

/**
 * Adds an exercise entry to the draft (FR-002). With no `blockId` (the
 * "loose exercise" path a user reaches without ever tapping "Add block"):
 * appends to the trailing block only if it's itself `loose` (an implicit
 * container this same path created earlier), or creates a fresh `loose`
 * block otherwise — this is what lets User Story 1 read as "a single
 * running list of sets" (spec.md User Story 2 context) when nothing has
 * been named yet, while never silently dropping a "loose" add into a
 * block the user *explicitly* created via "Add block" just because that
 * block also happens to have no name yet (FR-2 requires an unnamed block
 * to still show its position label and stay renameable/deletable — it
 * must not be mistaken for a `loose` one). The presentation layer renders
 * only `loose` blocks "bare" (no header/menu), so this is also what keeps
 * a loose exercise from ever looking like it's inside a block once a
 * real, explicitly created one exists alongside it.
 *
 * With an explicit `blockId` (a block's own "Add exercise" control, used
 * to group exercises on purpose): appends to that specific block instead.
 * An id that doesn't resolve is a no-op, matching `findEntry`'s defensive-
 * lookup convention elsewhere in this module.
 */
export function addExerciseEntry(
  draft: LoggingDraft,
  exerciseId: ExerciseId,
  blockId?: string,
): LoggingDraft {
  const entry: DraftExerciseEntry = {
    id: newId(),
    exerciseId,
    notes: '',
    sets: [],
  };

  if (blockId !== undefined) {
    const targetExists = draft.blocks.some((block) => block.id === blockId);
    if (!targetExists) return draft;
    return {
      ...draft,
      blocks: draft.blocks.map((block) =>
        block.id === blockId
          ? { ...block, exercises: [...block.exercises, entry] }
          : block,
      ),
    };
  }

  const lastIndex = draft.blocks.length - 1;
  const lastBlock = draft.blocks[lastIndex];
  // Only ever piggybacks on the trailing block if it's itself `loose` —
  // an explicitly created block the user hasn't named yet (`loose` is
  // unset) must stay its own block, never silently absorb a loose add
  // just because it currently has no name (FR-2).
  if (!lastBlock || lastBlock.loose !== true) {
    const block: DraftBlock = {
      id: newId(),
      loose: true,
      type: 'straightSets',
      exercises: [entry],
    };
    return { ...draft, blocks: [...draft.blocks, block] };
  }

  return {
    ...draft,
    blocks: draft.blocks.map((block, index) =>
      index === lastIndex
        ? { ...block, exercises: [...block.exercises, entry] }
        : block,
    ),
  };
}

function findEntry(
  draft: LoggingDraft,
  blockId: string,
  entryId: string,
): DraftExerciseEntry | undefined {
  const block = draft.blocks.find((b) => b.id === blockId);
  return block?.exercises.find((e) => e.id === entryId);
}

/**
 * Finds which block currently contains `entryId` — entry ids are minted by
 * `newId()` (globally unique), so this never needs a `blockId` hint to
 * disambiguate. Used to resolve a set's commit against the entry's
 * *current* block rather than whichever block a caller last knew about
 * (`logging-store.ts`'s `addSet`, ADR-0007's debounce: a `SetRow` can have
 * a commit still pending when its exercise entry is moved to a different
 * block via `moveExerciseAcrossBlocks` — that move unmounts the old
 * `SetRow` and mounts a fresh one under the new block, so nothing in the
 * old instance's own closures can be "kept fresh"; the fix is to never
 * bake a `blockId` into the pending commit at all and resolve it here,
 * fresh, when the commit actually fires).
 */
export function findBlockIdForEntry(
  draft: LoggingDraft,
  entryId: string,
): string | undefined {
  return draft.blocks.find((block) =>
    block.exercises.some((entry) => entry.id === entryId),
  )?.id;
}

/**
 * A prior set's volume/load, for pre-filling a new one (FR-008). Named so
 * `presentation/` components can import this one application-layer type
 * instead of `domain/volume`/`domain/load` directly — `docs/architecture.md`'s
 * table does not allow `presentation` → `domain` at all, even for a
 * read-only value shape.
 */
export interface SetPrefill {
  volume?: Volume;
  load: Load;
}

/**
 * data-model.md "Undo" (FR-004/FR-023). Never persisted — an app close
 * during the 5-second window doesn't need to restore it (spec.md's own
 * edge case: the deletion is already final by then). Defined here, not in
 * `logging-store.ts`, so `use-cases.ts` (which produces these) doesn't
 * need to import the store module.
 */
export interface UndoEntry {
  id: string;
  kind: 'block' | 'exerciseEntry' | 'set';
  restore: (draft: LoggingDraft) => LoggingDraft;
  expiresAt: number;
}

/**
 * The entry's last set's volume/load, for pre-filling a new set (FR-008).
 * `undefined` for an entry with no sets yet. Effort is deliberately never
 * carried forward (spec.md Clarifications, 2026-09-09) — it is re-entered
 * or left blank on each set.
 */
export function prefillNextSet(
  draft: LoggingDraft,
  blockId: string,
  entryId: string,
): SetPrefill | undefined {
  const lastSet = findEntry(draft, blockId, entryId)?.sets.at(-1);
  if (!lastSet) return undefined;
  return {
    ...(lastSet.volume !== undefined ? { volume: lastSet.volume } : {}),
    load: lastSet.load,
  };
}

export interface AddSetInput {
  volume?: Volume;
  load: Load;
  effort?: Effort;
  setKind: 'warmUp' | 'working' | 'toFailure';
}

const CONFIRM_DEBOUNCE_MS = 1000;

function sameSetInput(a: AddSetInput, b: DraftSet): boolean {
  return (
    JSON.stringify(a.volume) === JSON.stringify(b.volume) &&
    JSON.stringify(a.load) === JSON.stringify(b.load) &&
    a.effort === b.effort &&
    a.setKind === b.setKind
  );
}

/**
 * Confirms a set (FR-003, FR-008, FR-019, FR-025, FR-026). Validates via
 * domain `createSet` — throws `InvalidSetError` when neither `volume` nor
 * a non-`none` `load` is given (FR-019); the caller/UI must not offer a
 * confirm control until this would succeed (spec.md's "silent no-op or
 * unavailable" clarification — this plan's UI picks "unavailable",
 * `contracts/logging-screen-components.md`).
 *
 * Debounce (FR-025): if the entry's current last set has identical
 * `{ volume, load, effort, setKind }` to `input` and `nowMs -
 * lastConfirmedAtMs < 1000`, returns the *same* `draft` reference
 * unchanged (no new set appended) — callers can detect a debounced no-op
 * with `result === draft`.
 */
export function addSet(
  draft: LoggingDraft,
  blockId: string,
  entryId: string,
  input: AddSetInput,
  nowMs: number,
  lastConfirmedAtMs: number | undefined,
): LoggingDraft {
  const entry = findEntry(draft, blockId, entryId);
  if (!entry) return draft;

  const lastSet = entry.sets.at(-1);
  if (
    lastSet &&
    lastConfirmedAtMs !== undefined &&
    nowMs - lastConfirmedAtMs < CONFIRM_DEBOUNCE_MS &&
    sameSetInput(input, lastSet)
  ) {
    return draft;
  }

  const validated = createSet({
    ...(input.volume !== undefined ? { volume: input.volume } : {}),
    load: input.load,
    ...(input.effort !== undefined ? { effort: input.effort } : {}),
    setKind: input.setKind,
    completed: true,
  });
  const newSet: DraftSet = { id: newId(), ...validated };

  return {
    ...draft,
    blocks: draft.blocks.map((block) =>
      block.id !== blockId
        ? block
        : {
            ...block,
            exercises: block.exercises.map((e) =>
              e.id !== entryId ? e : { ...e, sets: [...e.sets, newSet] },
            ),
          },
    ),
  };
}

/** FR-006: appends a new block, unnamed when `name` is omitted. */
export function addBlock(
  draft: LoggingDraft,
  name: string | undefined,
  type: DraftBlock['type'],
): LoggingDraft {
  const block: DraftBlock = {
    id: newId(),
    ...(name !== undefined ? { name } : {}),
    type,
    exercises: [],
  };
  return { ...draft, blocks: [...draft.blocks, block] };
}

/**
 * FR-006: renames a block, or clears its name (back to the FR-007
 * position-based fallback) when `name` is `undefined`.
 */
function withoutName(block: DraftBlock): DraftBlock {
  const rest: DraftBlock = {
    id: block.id,
    type: block.type,
    exercises: block.exercises,
  };
  return rest;
}

export function renameBlock(
  draft: LoggingDraft,
  blockId: string,
  name: string | undefined,
): LoggingDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) =>
      block.id !== blockId
        ? block
        : name !== undefined
          ? { ...block, name }
          : withoutName(block),
    ),
  };
}

/** FR-006: moves an exercise entry within one block, by list position. */
export function reorderBlockExercise(
  draft: LoggingDraft,
  blockId: string,
  fromIndex: number,
  toIndex: number,
): LoggingDraft {
  return {
    ...draft,
    blocks: draft.blocks.map((block) => {
      if (block.id !== blockId) return block;
      const exercises = [...block.exercises];
      const [moved] = exercises.splice(fromIndex, 1);
      if (!moved) return block;
      exercises.splice(toIndex, 0, moved);
      return { ...block, exercises };
    }),
  };
}

/**
 * FR-006: moves an exercise entry from one block to another, preserving
 * its already-recorded sets intact (spec.md Acceptance Scenario US2-3).
 * Appends to the end of the target block's exercises unless `toIndex` is
 * given.
 */
export function moveExerciseAcrossBlocks(
  draft: LoggingDraft,
  fromBlockId: string,
  entryId: string,
  toBlockId: string,
  toIndex?: number,
): LoggingDraft {
  const fromBlock = draft.blocks.find((b) => b.id === fromBlockId);
  const entry = fromBlock?.exercises.find((e) => e.id === entryId);
  if (!entry) return draft;

  return {
    ...draft,
    blocks: draft.blocks.map((block) => {
      if (block.id === fromBlockId) {
        return {
          ...block,
          exercises: block.exercises.filter((e) => e.id !== entryId),
        };
      }
      if (block.id === toBlockId) {
        const exercises = [...block.exercises];
        exercises.splice(toIndex ?? exercises.length, 0, entry);
        return { ...block, exercises };
      }
      return block;
    }),
  };
}

const UNDO_WINDOW_MS = 5000;

export interface DeleteResult {
  draft: LoggingDraft;
  undo: UndoEntry;
}

/** A no-op `UndoEntry`, already expired — used when the target id doesn't resolve. */
function noopUndo(id: string, kind: UndoEntry['kind']): UndoEntry {
  return { id, kind, restore: (d) => d, expiresAt: 0 };
}

/**
 * FR-004, FR-023: deletes a block, cascading to its exercise entries/sets
 * by construction (they're nested). `restore` re-inserts the exact same
 * block at its original index, clamped to the list's current length if it
 * has since shrunk (spec.md: reordering during an open undo window must
 * not crash).
 */
export function deleteBlock(
  draft: LoggingDraft,
  blockId: string,
): DeleteResult {
  const index = draft.blocks.findIndex((b) => b.id === blockId);
  if (index === -1) return { draft, undo: noopUndo(blockId, 'block') };
  const removed = draft.blocks[index]!;

  const restore = (d: LoggingDraft): LoggingDraft => {
    const blocks = [...d.blocks];
    blocks.splice(Math.min(index, blocks.length), 0, removed);
    return { ...d, blocks };
  };

  return {
    draft: { ...draft, blocks: draft.blocks.filter((b) => b.id !== blockId) },
    undo: {
      id: blockId,
      kind: 'block',
      restore,
      expiresAt: Date.now() + UNDO_WINDOW_MS,
    },
  };
}

/** FR-004: deletes one exercise entry from a block, with the same restore-at-original-index contract as `deleteBlock`. */
export function deleteExerciseEntry(
  draft: LoggingDraft,
  blockId: string,
  entryId: string,
): DeleteResult {
  const block = draft.blocks.find((b) => b.id === blockId);
  const index = block ? block.exercises.findIndex((e) => e.id === entryId) : -1;
  if (!block || index === -1) {
    return { draft, undo: noopUndo(entryId, 'exerciseEntry') };
  }
  const removed = block.exercises[index]!;

  const restore = (d: LoggingDraft): LoggingDraft => ({
    ...d,
    blocks: d.blocks.map((b) => {
      if (b.id !== blockId) return b;
      const exercises = [...b.exercises];
      exercises.splice(Math.min(index, exercises.length), 0, removed);
      return { ...b, exercises };
    }),
  });

  return {
    draft: {
      ...draft,
      blocks: draft.blocks.map((b) =>
        b.id !== blockId
          ? b
          : { ...b, exercises: b.exercises.filter((e) => e.id !== entryId) },
      ),
    },
    undo: {
      id: entryId,
      kind: 'exerciseEntry',
      restore,
      expiresAt: Date.now() + UNDO_WINDOW_MS,
    },
  };
}

/** FR-004: deletes one set from an exercise entry, with the same restore-at-original-index contract as `deleteBlock`. */
export function deleteSet(
  draft: LoggingDraft,
  blockId: string,
  entryId: string,
  setId: string,
): DeleteResult {
  const entry = findEntry(draft, blockId, entryId);
  const index = entry ? entry.sets.findIndex((s) => s.id === setId) : -1;
  if (!entry || index === -1) {
    return { draft, undo: noopUndo(setId, 'set') };
  }
  const removed = entry.sets[index]!;

  const restore = (d: LoggingDraft): LoggingDraft => ({
    ...d,
    blocks: d.blocks.map((b) =>
      b.id !== blockId
        ? b
        : {
            ...b,
            exercises: b.exercises.map((e) => {
              if (e.id !== entryId) return e;
              const sets = [...e.sets];
              sets.splice(Math.min(index, sets.length), 0, removed);
              return { ...e, sets };
            }),
          },
    ),
  });

  return {
    draft: {
      ...draft,
      blocks: draft.blocks.map((b) =>
        b.id !== blockId
          ? b
          : {
              ...b,
              exercises: b.exercises.map((e) =>
                e.id !== entryId
                  ? e
                  : { ...e, sets: e.sets.filter((s) => s.id !== setId) },
              ),
            },
      ),
    },
    undo: {
      id: setId,
      kind: 'set',
      restore,
      expiresAt: Date.now() + UNDO_WINDOW_MS,
    },
  };
}
