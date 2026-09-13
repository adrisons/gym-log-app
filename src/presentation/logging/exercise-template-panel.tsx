/**
 * ADR-0006: edits an exercise's set-entry template — which load type and
 * volume kind a *new* set of this exercise defaults to, and whether
 * effort is tracked at all. Warns that the change is forward-only: an
 * already-recorded `Set` keeps exactly what it was given, never
 * reconciled or flagged (ADR-0006's whole point — nothing here can lose
 * or invalidate history).
 */
import { useEffect, useRef, useState } from 'react';
import { ExerciseTemplateFields } from './exercise-template-fields';
import type { Exercise, Load, Volume } from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import './logging.css';

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
