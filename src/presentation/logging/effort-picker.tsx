/**
 * FR-013: one-tap 1-5 effort scale. Every level, in every state,
 * shows its word label next to the number — never a bare digit
 * (ADR-0003). Optional: tapping the already-selected level clears it.
 */
import { formatEffort } from '@/application/logging/view-models';
import './logging.css';

const LEVELS = [1, 2, 3, 4, 5] as const;
type EffortLevel = (typeof LEVELS)[number];

export interface EffortPickerProps {
  value: EffortLevel | undefined;
  onChange: (value: EffortLevel | undefined) => void;
}

export function EffortPicker({ value, onChange }: EffortPickerProps) {
  return (
    <div role="radiogroup" aria-label="Effort" className="set-row__inputs">
      {LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          role="radio"
          aria-checked={level === value}
          className="logging-button"
          onClick={() => onChange(level === value ? undefined : level)}
        >
          {formatEffort(level)}
        </button>
      ))}
    </div>
  );
}
