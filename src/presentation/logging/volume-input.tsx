/**
 * FR-008, FR-026: a set's Volume — reps, duration, or distance, whichever
 * one the exercise's template (ADR-0006) says; the set-entry form no
 * longer offers a per-set switch between them (that only happens through
 * `ExerciseTemplatePanel`, ADR-0006's own component). Reps has no numeric
 * field of its own: it's a scrollable wheel from 1 to 100 with a leading
 * "unset" position (a set can be logged with a load and no volume at all,
 * so the wheel needs a way to represent "nothing chosen yet" too), rather
 * than a keypad + quick-increment buttons — the wheel itself is the
 * quick-increment mechanism. Duration/distance keep their numeric field
 * and quick-increment buttons unchanged (research.md §9); only reps was
 * asked to move to a wheel.
 */
import {
  DURATION_INCREMENT_SECONDS,
  DISTANCE_INCREMENT_METRES,
} from '@/application/logging/quick-increments';
import { WheelPicker } from './wheel-picker';
import type { WheelPickerOption } from './wheel-picker';
import './logging.css';

export type VolumeKind = 'reps' | 'duration' | 'distance';

const TIMED_KIND_META: Record<
  'duration' | 'distance',
  { label: string; increment: number; min: number }
> = {
  duration: {
    label: 'Duration (s)',
    increment: DURATION_INCREMENT_SECONDS,
    min: 1,
  },
  distance: {
    label: 'Distance (m)',
    increment: DISTANCE_INCREMENT_METRES,
    min: 1,
  },
};

const MAX_REPS = 100;
const REPS_OPTIONS: WheelPickerOption<number | undefined>[] = [
  { value: undefined, label: '—' },
  ...Array.from({ length: MAX_REPS }, (_, i) => ({
    value: i + 1,
    label: String(i + 1),
  })),
];

export interface VolumeInputProps {
  kind: VolumeKind;
  value: number | undefined;
  onValueChange: (value: number | undefined) => void;
}

export function VolumeInput({ kind, value, onValueChange }: VolumeInputProps) {
  if (kind === 'reps') {
    return (
      <div className="set-row__field">
        <span>Reps</span>
        <WheelPicker
          className="wheel-picker--numeric"
          ariaLabel="Reps"
          options={REPS_OPTIONS}
          value={value}
          onChange={onValueChange}
        />
      </div>
    );
  }

  const meta = TIMED_KIND_META[kind];
  const current = value ?? 0;

  return (
    <div className="set-row__field">
      <label>
        <span>{meta.label}</span>
        <input
          type="number"
          inputMode="decimal"
          min={0}
          step={0.5}
          className="logging-field-input"
          value={value ?? ''}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === '') {
              onValueChange(undefined);
              return;
            }
            const parsed = Number.parseFloat(raw);
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
