/**
 * The `LoggingDraft` tree-walk helpers `mergeExercises`/
 * `deleteExerciseCascade` both need to repoint/prune a matching exercise
 * reference in the pending draft (spec 001
 * contracts/storage-port-extension.md §1). Shared by
 * `IndexedDbStorageAdapter` and `FileSystemStorageAdapter` — pure
 * functions with no storage API involved, so there is nothing
 * adapter-specific about them. `InMemoryStorageAdapter` keeps its own
 * private copy (spec 001/002, predates this module, out of this spec's
 * scope per spec.md's Assumptions).
 */
import type { LoggingDraft } from '../application/ports/storage-port';
import type { ExerciseId } from '../domain/ids';

export function draftReferencesExercise(
  draft: LoggingDraft,
  exerciseId: ExerciseId,
): boolean {
  return draft.blocks.some((block) =>
    block.exercises.some((entry) => entry.exerciseId === exerciseId),
  );
}

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
