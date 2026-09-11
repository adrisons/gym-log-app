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
 * Adds an exercise entry to the draft (FR-002). Appends to the last
 * existing block, or creates a default unnamed `straightSets` block first
 * if the draft has none yet — this is what lets User Story 1 read as "a
 * single running list of sets" (spec.md User Story 2 context) without any
 * block-management UI existing yet; User Story 2 layers real block
 * creation/naming on top of the same structure.
 */
export function addExerciseEntry(
  draft: LoggingDraft,
  exerciseId: ExerciseId,
): LoggingDraft {
  const entry: DraftExerciseEntry = {
    id: newId(),
    exerciseId,
    notes: '',
    sets: [],
  };

  if (draft.blocks.length === 0) {
    const block: DraftBlock = {
      id: newId(),
      type: 'straightSets',
      exercises: [entry],
    };
    return { ...draft, blocks: [block] };
  }

  const lastIndex = draft.blocks.length - 1;
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
