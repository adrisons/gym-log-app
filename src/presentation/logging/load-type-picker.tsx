/**
 * FR-009: chooses which of the five load kinds a set uses, remembered as
 * the exercise's default (the parent wires the chosen kind to
 * `recordLoadTypeDefault`).
 */
import type { Load } from '@/application/logging/use-cases';
import './logging.css';

const OPTIONS: { kind: Load['kind']; label: string }[] = [
  { kind: 'weight', label: 'Weight' },
  { kind: 'band', label: 'Band' },
  { kind: 'bodyweight', label: 'Bodyweight' },
  { kind: 'freeText', label: 'Free text' },
  { kind: 'none', label: 'None' },
];

export interface LoadTypePickerProps {
  selected: Load['kind'];
  onSelect: (kind: Load['kind']) => void;
}

export function LoadTypePicker({ selected, onSelect }: LoadTypePickerProps) {
  return (
    <div role="radiogroup" aria-label="Load type" className="set-row__inputs">
      {OPTIONS.map((option) => (
        <button
          key={option.kind}
          type="button"
          role="radio"
          aria-checked={option.kind === selected}
          className="logging-button"
          onClick={() => onSelect(option.kind)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
