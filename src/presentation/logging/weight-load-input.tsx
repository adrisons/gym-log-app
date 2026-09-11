/**
 * FR-009, FR-010, FR-026: a Weight load's numeric value. Numeric keypad by
 * default (`inputMode="decimal"`); quick-increment buttons (research.md
 * §9) never take the value below 0 — the down button shows
 * disabled-with-reason at 0 rather than silently no-opping. Value is
 * `undefined` when empty (treated as "no Weight load entered", not `0` —
 * `0` is itself a valid FR-026 value once the user actually enters it).
 */
import { WEIGHT_INCREMENT_KG } from '@/application/logging/quick-increments';
import './logging.css';

export interface WeightLoadInputProps {
  valueKg: number | undefined;
  onChange: (valueKg: number | undefined) => void;
}

export function WeightLoadInput({ valueKg, onChange }: WeightLoadInputProps) {
  const current = valueKg ?? 0;

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
      <div className="set-row__inputs">
        <button
          type="button"
          className="logging-button"
          disabled={current <= 0}
          aria-disabled={current <= 0}
          aria-label={
            current <= 0
              ? `Decrease weight (already at the 0 kg minimum)`
              : `Decrease weight by ${WEIGHT_INCREMENT_KG} kg`
          }
          onClick={() => onChange(Math.max(0, current - WEIGHT_INCREMENT_KG))}
        >
          −{WEIGHT_INCREMENT_KG} kg
        </button>
        <button
          type="button"
          className="logging-button"
          aria-label={`Increase weight by ${WEIGHT_INCREMENT_KG} kg`}
          onClick={() => onChange(current + WEIGHT_INCREMENT_KG)}
        >
          +{WEIGHT_INCREMENT_KG} kg
        </button>
      </div>
    </div>
  );
}
