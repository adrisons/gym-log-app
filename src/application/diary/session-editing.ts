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
 * a block; add/delete/edit an exercise entry's sets — ADR-0010 added
 * editing a set in place, spec 001 FR-029, alongside add/delete). Undo is
 * intentionally out of scope for this screen: spec.md FR-005
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
      // No `loose` here: the persisted `Block` doesn't carry it (see
      // `domain/block.ts`'s doc comment) — every block reloaded from
      // storage defaults to non-loose (shows its header), which is the
      // FR-2-compliant choice for a block whose original "explicit vs.
      // implicit" provenance wasn't persisted.
      type: block.type,
      ...(block.rounds !== undefined ? { rounds: block.rounds } : {}),
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
        // `block.loose` is deliberately dropped here — presentation-only,
        // never part of the persisted `Block` (see `domain/block.ts`).
        type: block.type,
        ...(block.rounds !== undefined ? { rounds: block.rounds } : {}),
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
