/**
 * FR-017, FR-018, FR-020, FR-022: rename (with collision → merge-offer),
 * merge (explicit, irreversible confirmation — no 5-second undo, unlike
 * every other destructive action on this screen), and delete-with-history
 * (confirm-or-merge-instead in the same dialog).
 */
import { useState } from 'react';
import type {
  Exercise,
  RenameExerciseResult,
  ExerciseId,
} from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import './logging.css';

export interface ExerciseCataloguePanelProps {
  exercise: Exercise;
  hasHistory: boolean;
  search: (query: string) => Exercise[];
  onRename: (newName: string) => Promise<RenameExerciseResult>;
  onMerge: (survivorId: ExerciseId, loserId: ExerciseId) => void;
  onDeleteConfirm: () => void;
  onClose: () => void;
}

type Mode = 'rename' | 'delete' | 'delete-merge-search';

export function ExerciseCataloguePanel({
  exercise,
  hasHistory,
  search,
  onRename,
  onMerge,
  onDeleteConfirm,
  onClose,
}: ExerciseCataloguePanelProps) {
  const [mode, setMode] = useState<Mode>('rename');
  const [newName, setNewName] = useState(exercise.canonicalName);
  const [collision, setCollision] = useState<
    Extract<RenameExerciseResult, { status: 'collision' }> | undefined
  >(undefined);
  const [mergeQuery, setMergeQuery] = useState('');

  const handleRenameSubmit = async () => {
    const result = await onRename(newName);
    if (result.status === 'collision') {
      setCollision(result);
    } else {
      setCollision(undefined);
      onClose();
    }
  };

  return (
    <div
      className="block-card"
      role="dialog"
      aria-label={`Manage ${exercise.canonicalName}`}
    >
      {mode === 'rename' && (
        <>
          <label className="logging-screen__field-label">
            <span>Rename exercise</span>
            <input
              type="text"
              className="logging-field-input"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="logging-button logging-button--icon-label"
            onClick={() => void handleRenameSubmit()}
          >
            <Icon name="check" />
            Save name
          </button>

          {collision && (
            <div role="alertdialog" aria-label="Name already in use">
              <p>
                &quot;{newName}&quot; is already used by &quot;
                {collision.collidesWith.canonicalName}&quot;. Merge{' '}
                {exercise.canonicalName} into{' '}
                {collision.collidesWith.canonicalName}?
              </p>
              <button
                type="button"
                className="logging-button"
                onClick={() => {
                  setCollision(undefined);
                  setNewName(exercise.canonicalName);
                }}
              >
                Cancel rename
              </button>
              <button
                type="button"
                className="logging-button logging-button--icon-label"
                onClick={() => {
                  onMerge(collision.collidesWith.id, exercise.id);
                  setCollision(undefined);
                  onClose();
                }}
              >
                <Icon name="move-to" />
                Merge (not undoable)
              </button>
            </div>
          )}

          <button
            type="button"
            className="logging-button logging-button--icon-label"
            onClick={() => setMode('delete')}
          >
            <Icon name="trash" />
            Delete exercise…
          </button>
        </>
      )}

      {mode === 'delete' && (
        <div role="alertdialog" aria-label={`Delete ${exercise.canonicalName}`}>
          {hasHistory ? (
            <>
              <p>
                {exercise.canonicalName} has recorded history. Deleting it
                removes every set that used it. Merge into another exercise
                instead?
              </p>
              <button
                type="button"
                className="logging-button logging-button--icon-label"
                onClick={() => setMode('delete-merge-search')}
              >
                <Icon name="move-to" />
                Merge instead
              </button>
              <button
                type="button"
                className="logging-button logging-button--icon-label"
                onClick={onDeleteConfirm}
              >
                <Icon name="trash" />
                Delete anyway
              </button>
            </>
          ) : (
            <button
              type="button"
              className="logging-button logging-button--icon-label"
              onClick={onDeleteConfirm}
            >
              <Icon name="trash" />
              Confirm delete
            </button>
          )}
          <button
            type="button"
            className="logging-button logging-button--icon-label"
            onClick={() => setMode('rename')}
          >
            <Icon name="close" />
            Cancel
          </button>
        </div>
      )}

      {mode === 'delete-merge-search' && (
        <div>
          <label className="logging-screen__field-label">
            <span>Merge into…</span>
            <input
              type="text"
              className="logging-field-input"
              value={mergeQuery}
              onChange={(event) => setMergeQuery(event.target.value)}
            />
          </label>
          <ul className="exercise-search-field__results">
            {search(mergeQuery)
              .filter((candidate) => candidate.id !== exercise.id)
              .map((candidate) => (
                <li key={candidate.id}>
                  <button
                    type="button"
                    className="logging-button logging-button--icon-label"
                    onClick={() => {
                      onMerge(candidate.id, exercise.id);
                      onClose();
                    }}
                  >
                    <Icon name="move-to" />
                    Merge into {candidate.canonicalName} (not undoable)
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}

      <button
        type="button"
        className="logging-button logging-button--icon-label"
        onClick={onClose}
      >
        <Icon name="close" />
        Close
      </button>
    </div>
  );
}
