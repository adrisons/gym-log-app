/**
 * Session-detail editing (spec 004 FR-005: "any field editable during
 * logging (spec 001) MUST remain editable here"). Reuses spec 001's own
 * `LoggingDraft` shape (synthetic per-level `id`s for stable list keys)
 * purely as an in-memory editing representation of an already-saved
 * `Session` — never persisted as a draft, never touching
 * `StoragePort.saveDraft`/`getDraft`. Every mutation here is followed by
 * `StoragePort.saveSession`, not the draft-promotion path.
 *
 * Scope note: mirrors spec 001's own editable surface (add/rename/delete
 * a block; add/delete an exercise entry; add/delete a set) — spec 001's
 * confirmed sets are themselves never edited in place, only added or
 * deleted (`logging-screen.tsx`), so this screen doesn't need to either.
 * Undo is intentionally out of scope for this screen: spec.md FR-005
 * requires edits to be editable and persisted, not undoable — the 5-second
 * undo window is spec 001 FR-001's own logging-critical-path guarantee,
 * not restated for after-the-fact editing here.
 */
import { createBlock } from '@/domain/block';
import { createSession } from '@/domain/session';
import { createSet } from '@/domain/set';
import type { Session } from '@/domain/session';
import { newId } from '@/shared/id';
import type {
  DraftBlock,
  DraftExerciseEntry,
  DraftSet,
} from '@/application/ports/logging-draft';

export interface EditableSession {
  blocks: DraftBlock[];
  notes: string;
  dateTime: string;
}

export function sessionToEditable(session: Session): EditableSession {
  return {
    dateTime: session.dateTime,
    notes: session.notes,
    blocks: session.blocks.map((block): DraftBlock => ({
      id: newId(),
      ...(block.name !== undefined ? { name: block.name } : {}),
      ...(block.loose !== undefined ? { loose: block.loose } : {}),
      type: block.type,
      exercises: block.exercises.map((entry): DraftExerciseEntry => ({
        id: newId(),
        exerciseId: entry.exerciseId,
        notes: entry.notes,
        sets: entry.sets.map((set): DraftSet => ({
          id: newId(),
          ...(set.volume !== undefined ? { volume: set.volume } : {}),
          load: set.load,
          ...(set.effort !== undefined ? { effort: set.effort } : {}),
          setKind: set.setKind,
          completed: set.completed,
        })),
      })),
    })),
  };
}

/**
 * Re-exposes `shared/id.ts`'s `newId()` for `presentation/` to mint a new
 * block/entry/set's synthetic id when editing — `presentation` may not
 * import `shared` directly (`docs/architecture.md`'s table).
 */
export function newEditableItemId(): string {
  return newId();
}

export function editableToSession(
  editable: EditableSession,
  original: Session,
): Session {
  return createSession({
    id: original.id,
    dateTime: editable.dateTime,
    notes: editable.notes,
    blocks: editable.blocks.map((block) =>
      createBlock({
        ...(block.name !== undefined ? { name: block.name } : {}),
        ...(block.loose !== undefined ? { loose: block.loose } : {}),
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
    ),
  });
}
