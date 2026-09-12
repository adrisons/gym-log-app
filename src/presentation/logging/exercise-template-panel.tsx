/**
 * ADR-0006: edits an exercise's set-entry template — which load type and
 * volume kind a *new* set of this exercise defaults to, and whether
 * effort is tracked at all. Warns that the change is forward-only: an
 * already-recorded `Set` keeps exactly what it was given, never
 * reconciled or flagged (ADR-0006's whole point — nothing here can lose
 * or invalidate history).
 */
import { useEffect, useRef, useState } from 'react';
import { LoadTypePicker } from './load-type-picker';
import type { Exercise, Load, Volume } from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import './logging.css';

const VOLUME_KIND_LABELS: Record<Volume['kind'], string> = {
  reps: 'Reps',
  duration: 'Duration',
  distance: 'Distance',
};

export interface ExerciseTemplate {
  defaultLoadType: Load['kind'];
  defaultVolumeKind: Volume['kind'];
  trackEffort: boolean;
}

export interface ExerciseTemplatePanelProps {
  exercise: Exercise;
  onSave: (template: ExerciseTemplate) => void;
  onClose: () => void;
}

export function ExerciseTemplatePanel({
  exercise,
  onSave,
  onClose,
}: ExerciseTemplatePanelProps) {
  const [loadType, setLoadType] = useState<Load['kind']>(
    exercise.defaultLoadType,
  );
  const [volumeKind, setVolumeKind] = useState<Volume['kind']>(
    exercise.defaultVolumeKind,
  );
  const [trackEffort, setTrackEffort] = useState(exercise.trackEffort);
  const dialogRef = useRef<HTMLDivElement>(null);

  // This dialog is inserted wherever it sits in the tree (near the top of
  // the screen, not next to the menu item that opened it) without moving
  // focus on its own — without this, opening it leaves focus on that now
  // possibly-unmounted menu item and forward Tab navigation never reaches
  // the dialog at all. The cleanup restores focus to whatever had it
  // before (the "Edit tracked fields…" trigger) once Save/Cancel unmounts
  // this dialog — without it, focus falls back to the document body.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      ref={dialogRef}
      className="block-card"
      role="dialog"
      aria-label={`Edit ${exercise.canonicalName}'s tracked fields`}
      tabIndex={-1}
    >
      <p role="status">
        This changes what a new {exercise.canonicalName} set shows by default.
        Sets you already logged keep exactly what you recorded.
      </p>

      <div className="logging-screen__field-label">
        <span>Load type</span>
        <LoadTypePicker selected={loadType} onSelect={setLoadType} />
      </div>

      <div className="logging-screen__field-label">
        <span>Volume kind</span>
        <div
          role="radiogroup"
          aria-label="Volume kind"
          className="set-row__inputs"
        >
          {(Object.keys(VOLUME_KIND_LABELS) as Volume['kind'][]).map((kind) => (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={kind === volumeKind}
              className="logging-button"
              onClick={() => setVolumeKind(kind)}
            >
              {VOLUME_KIND_LABELS[kind]}
            </button>
          ))}
        </div>
      </div>

      <label className="exercise-template-panel__checkbox-label">
        <input
          type="checkbox"
          checked={trackEffort}
          onChange={(event) => setTrackEffort(event.target.checked)}
        />
        <span>Track effort for this exercise</span>
      </label>

      <button
        type="button"
        className="logging-button logging-button--primary logging-button--icon-label"
        onClick={() =>
          onSave({
            defaultLoadType: loadType,
            defaultVolumeKind: volumeKind,
            trackEffort,
          })
        }
      >
        <Icon name="check" />
        Save changes
      </button>
      <button
        type="button"
        className="logging-button logging-button--icon-label"
        onClick={onClose}
      >
        <Icon name="close" />
        Cancel
      </button>
    </div>
  );
}
