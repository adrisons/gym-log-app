/**
 * FR-009, FR-010, FR-026: a Weight load's numeric value. Numeric keypad by
 * default (`inputMode="decimal"`); quick-increment controls are added by
 * User Story 3 (`quick-increments.ts`) — this is the minimal Weight-only
 * input User Story 1 needs to log a first set at all. Value is `undefined`
 * when empty (US1's set-row treats that as "no Weight load entered", not
 * `0` — `0` is itself a valid FR-026 value once the user actually enters it).
 */
import './logging.css';

export interface WeightLoadInputProps {
  valueKg: number | undefined;
  onChange: (valueKg: number | undefined) => void;
}

export function WeightLoadInput({ valueKg, onChange }: WeightLoadInputProps) {
  return (
    <label className="set-row__field">
      <span>Weight (kg)</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step={0.5}
        className="logging-field-input"
        value={valueKg ?? ''}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          const parsed = Number(raw);
          onChange(Number.isFinite(parsed) && parsed >= 0 ? parsed : 0);
        }}
      />
    </label>
  );
}
