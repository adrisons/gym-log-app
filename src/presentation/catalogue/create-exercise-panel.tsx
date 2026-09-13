/**
 * ADR-0010: defines a brand-new catalogue `Exercise`, name and set-entry
 * template together — the `/exercises` screen previously offered no way
 * to add an exercise at all (only manage one already created implicitly
 * via the logging screen's "Create…" search shortcut, which always
 * defaults to Weight + Reps, no effort). Reuses `ExerciseTemplateFields`,
 * the same template controls `ExerciseTemplatePanel` edits an existing
 * exercise with, so a newly created exercise and a later template edit
 * never present different controls for the same thing.
 */
import { useState } from 'react';
import { ExerciseTemplateFields } from '../logging/exercise-template-fields';
import type { Load, Volume } from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import '../logging/logging.css';

export interface NewExerciseInput {
  canonicalName: string;
  defaultLoadType: Load['kind'];
  defaultVolumeKind: Volume['kind'];
  trackEffort: boolean;
}

export interface CreateExercisePanelProps {
  onCreate: (input: NewExerciseInput) => void;
  onClose: () => void;
}

export function CreateExercisePanel({
  onCreate,
  onClose,
}: CreateExercisePanelProps) {
  const [name, setName] = useState('');
  const [loadType, setLoadType] = useState<Load['kind']>('weight');
  const [volumeKind, setVolumeKind] = useState<Volume['kind']>('reps');
  const [trackEffort, setTrackEffort] = useState(false);

  const canSave = name.trim() !== '';

  return (
    <div className="block-card" role="dialog" aria-label="New exercise">
      <label className="logging-screen__field-label">
        <span>Name</span>
        <input
          type="text"
          className="logging-field-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoFocus
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
        disabled={!canSave}
        aria-disabled={!canSave}
        onClick={() =>
          onCreate({
            canonicalName: name.trim(),
            defaultLoadType: loadType,
            defaultVolumeKind: volumeKind,
            trackEffort,
          })
        }
      >
        <Icon name="check" />
        Create exercise
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
