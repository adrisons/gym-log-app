/**
 * FR-009, FR-026: a Weight load's numeric value. Numeric keypad by default
 * (`inputMode="decimal"`) is the sole entry path — no quick-increment
 * buttons (a deliberate product decision superseding the ± buttons FR-3
 * used to require; see docs/requirements.md FR-3's updated text). Value is
 * `undefined` when empty (treated as "no Weight load entered", not `0` —
 * `0` is itself a valid FR-026 value once the user actually enters it).
 */
import './logging.css';

export interface WeightLoadInputProps {
  valueKg: number | undefined;
  onChange: (valueKg: number | undefined) => void;
}

export function WeightLoadInput({ valueKg, onChange }: WeightLoadInputProps) {
  return (
    <div className="set-row__field">
      <label>
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
    </div>
  );
}
