/**
 * FR-008, FR-026: a set's Volume — reps, duration, or distance. Reps has
 * no numeric field of its own: it's a scrollable wheel from 1 to 100 with
 * a leading "unset" position (a set can be logged with a load and no
 * volume at all, so the wheel needs a way to represent "nothing chosen
 * yet" too), rather than a keypad + quick-increment buttons — the wheel
 * itself is the quick-increment mechanism. Duration/distance keep their
 * numeric field and quick-increment buttons unchanged (research.md §9);
 * only reps was asked to move to a wheel.
 */
import {
  DURATION_INCREMENT_SECONDS,
  DISTANCE_INCREMENT_METRES,
} from '@/application/logging/quick-increments';
import { WheelPicker } from './wheel-picker';
import type { WheelPickerOption } from './wheel-picker';
import './logging.css';

export type VolumeKind = 'reps' | 'duration' | 'distance';

const KIND_LABELS: Record<VolumeKind, string> = {
  reps: 'Reps',
  duration: 'Duration (s)',
  distance: 'Distance (m)',
};

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
  onKindChange: (kind: VolumeKind) => void;
  onValueChange: (value: number | undefined) => void;
}

export function VolumeInput({
  kind,
  value,
  onKindChange,
  onValueChange,
}: VolumeInputProps) {
  const current = value ?? 0;

  return (
    <div className="set-row__field">
      <div
        role="radiogroup"
        aria-label="Volume kind"
        className="set-row__inputs"
      >
        {(Object.keys(KIND_LABELS) as VolumeKind[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={k === kind}
            className="logging-button"
            onClick={() => onKindChange(k)}
          >
            {KIND_LABELS[k]}
          </button>
        ))}
      </div>

      {kind === 'reps' ? (
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
      ) : (
        <>
          <label>
            <span>{TIMED_KIND_META[kind].label}</span>
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
                  Number.isFinite(parsed) && parsed >= TIMED_KIND_META[kind].min
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
              disabled={current <= TIMED_KIND_META[kind].min}
              aria-disabled={current <= TIMED_KIND_META[kind].min}
              aria-label={
                current <= TIMED_KIND_META[kind].min
                  ? `Decrease ${TIMED_KIND_META[kind].label} (already at the minimum)`
                  : `Decrease ${TIMED_KIND_META[kind].label} by ${TIMED_KIND_META[kind].increment}`
              }
              onClick={() =>
                onValueChange(
                  Math.max(
                    TIMED_KIND_META[kind].min,
                    current - TIMED_KIND_META[kind].increment,
                  ),
                )
              }
            >
              −{TIMED_KIND_META[kind].increment}
            </button>
            <button
              type="button"
              className="logging-button"
              aria-label={`Increase ${TIMED_KIND_META[kind].label} by ${TIMED_KIND_META[kind].increment}`}
              onClick={() =>
                onValueChange(current + TIMED_KIND_META[kind].increment)
              }
            >
              +{TIMED_KIND_META[kind].increment}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
