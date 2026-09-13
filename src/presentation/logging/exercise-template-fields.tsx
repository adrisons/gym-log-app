/**
 * The load-type/volume-kind/track-effort controls shared by
 * `ExerciseTemplatePanel` (editing an existing exercise's template,
 * ADR-0006) and `CreateExercisePanel` (ADR-0010: defining a *new*
 * exercise's template at creation time) — factored out so the two forms
 * can never drift apart on what a "set-entry template" actually consists
 * of.
 */
import { LoadTypePicker } from './load-type-picker';
import type { Load, Volume } from '@/application/logging/use-cases';
import './logging.css';

const VOLUME_KIND_LABELS: Record<Volume['kind'], string> = {
  reps: 'Reps',
  duration: 'Duration',
  distance: 'Distance',
};

export interface ExerciseTemplateFieldsProps {
  loadType: Load['kind'];
  onLoadTypeChange: (kind: Load['kind']) => void;
  volumeKind: Volume['kind'];
  onVolumeKindChange: (kind: Volume['kind']) => void;
  trackEffort: boolean;
  onTrackEffortChange: (value: boolean) => void;
}

export function ExerciseTemplateFields({
  loadType,
  onLoadTypeChange,
  volumeKind,
  onVolumeKindChange,
  trackEffort,
  onTrackEffortChange,
}: ExerciseTemplateFieldsProps) {
  return (
    <>
      <div className="logging-screen__field-label">
        <span>Load type</span>
        <LoadTypePicker selected={loadType} onSelect={onLoadTypeChange} />
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
              onClick={() => onVolumeKindChange(kind)}
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
          onChange={(event) => onTrackEffortChange(event.target.checked)}
        />
        <span>Track effort for this exercise</span>
      </label>
    </>
  );
}
