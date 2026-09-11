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
import type { SessionId } from '@/domain/ids';
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
