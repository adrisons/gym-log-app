/**
 * FR-017, FR-018, FR-020, FR-022: a single combined form for an existing
 * catalogue exercise — rename and set-entry template edits share one
 * "Save changes" button (no separate "Save name"/"Edit tracked fields…"
 * steps) — plus rename-collision → merge-offer, and delete-with-history
 * (confirm-or-merge-instead in the same popup).
 */
import { useEffect, useRef, useState } from 'react';
import type {
  Exercise,
  RenameExerciseResult,
  ExerciseId,
} from '@/application/logging/use-cases';
import { ExerciseTemplateFields } from './exercise-template-fields';
import type { ExerciseTemplate } from './exercise-template-panel';
import { Icon } from '@/presentation/design/icons';
import './logging.css';

export interface ExerciseCataloguePanelProps {
  exercise: Exercise;
  hasHistory: boolean;
  search: (query: string) => Exercise[];
  /** Renames the exercise and, once the rename lands without a collision,
   * also saves the template fields — one round-trip for the whole form. */
  onSave: (
    newName: string,
    template: ExerciseTemplate,
  ) => Promise<RenameExerciseResult>;
  onMerge: (survivorId: ExerciseId, loserId: ExerciseId) => void;
  onDeleteConfirm: () => void;
  onClose: () => void;
}

type Mode = 'edit' | 'delete' | 'delete-merge-search';

export function ExerciseCataloguePanel({
  exercise,
  hasHistory,
  search,
  onSave,
  onMerge,
  onDeleteConfirm,
  onClose,
}: ExerciseCataloguePanelProps) {
  const [mode, setMode] = useState<Mode>('edit');
  const [newName, setNewName] = useState(exercise.canonicalName);
  const [loadType, setLoadType] = useState(exercise.defaultLoadType);
  const [volumeKind, setVolumeKind] = useState(exercise.defaultVolumeKind);
  const [trackEffort, setTrackEffort] = useState(exercise.trackEffort);
  const [collision, setCollision] = useState<
    Extract<RenameExerciseResult, { status: 'collision' }> | undefined
  >(undefined);
  const [mergeQuery, setMergeQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Same focus-restore lifecycle as `ExerciseTemplatePanel`/
  // `CreateExercisePanel`: this form is inserted in place of the row's own
  // "Manage" button, which unmounts as this mounts, so keyboard focus would
  // otherwise drop to the document body. Moves focus into the name field on
  // mount and hands it back to whatever had it before (the "Manage"
  // trigger) once this panel unmounts (Save/Close/Delete).
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    nameInputRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  const handleSaveSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await onSave(newName, {
        defaultLoadType: loadType,
        defaultVolumeKind: volumeKind,
        trackEffort,
      });
      if (result.status === 'collision') {
        setCollision(result);
        setSubmitting(false);
      } else {
        setCollision(undefined);
        onClose();
      }
    } catch (error) {
      console.error('Failed to save exercise changes', error);
      setSubmitting(false);
    }
  };

  return (
    <div
      className="block-card"
      role="dialog"
      aria-label={`Manage ${exercise.canonicalName}`}
    >
      {mode === 'edit' && (
        <>
          <label className="logging-screen__field-label">
            <span>Rename exercise</span>
            <input
              ref={nameInputRef}
              type="text"
              className="logging-field-input"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
            />
          </label>

          <ExerciseTemplateFields
            loadType={loadType}
            onLoadTypeChange={setLoadType}
            volumeKind={volumeKind}
            onVolumeKindChange={setVolumeKind}
            trackEffort={trackEffort}
            onTrackEffortChange={setTrackEffort}
          />

          <button
            type="button"
            className="logging-button logging-button--primary logging-button--icon-label"
            disabled={submitting}
            aria-disabled={submitting}
            onClick={() => void handleSaveSubmit()}
          >
            <Icon name="check" />
            Save changes
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
            onClick={() => setMode('edit')}
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
