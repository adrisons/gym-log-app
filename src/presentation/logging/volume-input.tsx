/**
 * FR-008, FR-026: a set's Volume — reps, duration, or distance, with
 * quick-increment buttons (research.md §9) that never go below the
 * FR-026 bound (reps: 1; duration/distance: > 0, enforced by the domain
 * `createVolume` constructor as defense in depth).
 */
import {
  REPS_INCREMENT,
  DURATION_INCREMENT_SECONDS,
  DISTANCE_INCREMENT_METRES,
} from '@/application/logging/quick-increments';
import './logging.css';

export type VolumeKind = 'reps' | 'duration' | 'distance';

const KIND_META: Record<
  VolumeKind,
  { label: string; unit: string; increment: number; min: number }
> = {
  reps: { label: 'Reps', unit: '', increment: REPS_INCREMENT, min: 1 },
  duration: {
    label: 'Duration (s)',
    unit: 's',
    increment: DURATION_INCREMENT_SECONDS,
    min: 1,
  },
  distance: {
    label: 'Distance (m)',
    unit: 'm',
    increment: DISTANCE_INCREMENT_METRES,
    min: 1,
  },
};

export interface VolumeInputProps {
  kind: VolumeKind;
  value: number | undefined;
  onKindChange: (kind: VolumeKind) => void;
  onValueChange: (value: number | undefined) => void;
}

export function VolumeInput({
  kind,
  value,
  onKindChange,
  onValueChange,
}: VolumeInputProps) {
  const meta = KIND_META[kind];
  const current = value ?? 0;

  return (
    <div className="set-row__field">
      <div
        role="radiogroup"
        aria-label="Volume kind"
        className="set-row__inputs"
      >
        {(Object.keys(KIND_META) as VolumeKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === kind}
            className="logging-button"
            onClick={() => onKindChange(k)}
          >
            {KIND_META[k].label}
          </button>
        ))}
      </div>
      <label>
        <span>{meta.label}</span>
        <input
          type="number"
          inputMode={kind === 'reps' ? 'numeric' : 'decimal'}
          min={0}
          step={kind === 'reps' ? 1 : 0.5}
          className="logging-field-input"
          value={value ?? ''}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === '') {
              onValueChange(undefined);
              return;
            }
            const parsed =
              kind === 'reps'
                ? Number.parseInt(raw, 10)
                : Number.parseFloat(raw);
            onValueChange(
              Number.isFinite(parsed) && parsed >= meta.min
                ? parsed
                : undefined,
            );
          }}
        />
      </label>
      <div className="set-row__inputs">
        <button
          type="button"
          className="logging-button"
          disabled={current <= meta.min}
          aria-disabled={current <= meta.min}
          aria-label={
            current <= meta.min
              ? `Decrease ${meta.label} (already at the minimum)`
              : `Decrease ${meta.label} by ${meta.increment}`
          }
          onClick={() =>
            onValueChange(Math.max(meta.min, current - meta.increment))
          }
        >
          −{meta.increment}
        </button>
        <button
          type="button"
          className="logging-button"
          aria-label={`Increase ${meta.label} by ${meta.increment}`}
          onClick={() => onValueChange(current + meta.increment)}
        >
          +{meta.increment}
        </button>
      </div>
    </div>
  );
}
