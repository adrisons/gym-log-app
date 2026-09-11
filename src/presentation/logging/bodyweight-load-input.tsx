/**
 * FR-014: a Bodyweight load's optional signed added/assisted component.
 * Clamped to -300..+300 in the UI (matching the domain `createLoad`
 * bound — defense in depth, not a substitute for it). A value of exactly
 * 0 reads as "no component" (`Bodyweight`, no +/- suffix).
 */
import './logging.css';

const MIN_KG = -300;
const MAX_KG = 300;

export interface BodyweightLoadInputProps {
  addedOrAssistedKg: number | undefined;
  onChange: (kg: number | undefined) => void;
}

export function BodyweightLoadInput({
  addedOrAssistedKg,
  onChange,
}: BodyweightLoadInputProps) {
  return (
    <label className="set-row__field">
      <span>Added (+) / assisted (−) kg</span>
      <input
        type="number"
        inputMode="decimal"
        min={MIN_KG}
        max={MAX_KG}
        step={0.5}
        className="logging-field-input"
        value={addedOrAssistedKg ?? ''}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          const parsed = Number(raw);
          if (!Number.isFinite(parsed)) return;
          const clamped = Math.min(MAX_KG, Math.max(MIN_KG, parsed));
          onChange(clamped === 0 ? undefined : clamped);
        }}
      />
      <span>
        {addedOrAssistedKg === undefined
          ? 'Bodyweight only'
          : `Bodyweight ${addedOrAssistedKg > 0 ? '+' : ''}${addedOrAssistedKg} kg`}
      </span>
    </label>
  );
}
