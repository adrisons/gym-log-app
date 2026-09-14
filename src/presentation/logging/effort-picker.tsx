/**
 * FR-004/FR-013: effort as a scrollable wheel, 1-5, each position showing
 * its word label — never a bare digit (ADR-0003). Effort is optional
 * (FR-4), so the wheel's first position is an explicit "not recorded"
 * state rather than always resting on some level by default.
 */
import { effortTone, formatEffort } from '@/application/logging/view-models';
import { WheelPicker } from './wheel-picker';
import type { WheelPickerOption } from './wheel-picker';
import './logging.css';

const LEVELS = [1, 2, 3, 4, 5] as const;
type EffortLevel = (typeof LEVELS)[number];

const OPTIONS: WheelPickerOption<EffortLevel | undefined>[] = [
  { value: undefined, label: 'Not recorded' },
  ...LEVELS.map((level) => ({
    value: level,
    label: formatEffort(level)!,
    tone: effortTone(level),
  })),
];

export interface EffortPickerProps {
  value: EffortLevel | undefined;
  onChange: (value: EffortLevel | undefined) => void;
}

export function EffortPicker({ value, onChange }: EffortPickerProps) {
  return (
    <div className="set-row__field">
      <span>Effort</span>
      <WheelPicker
        ariaLabel="Effort"
        options={OPTIONS}
        value={value}
        onChange={onChange}
      />
    </div>
  );
}
