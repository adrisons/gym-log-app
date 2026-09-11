/**
 * FR-008, FR-026: a set's Volume. Reps mode only for User Story 1 (integer
 * keypad); User Story 3 extends this with duration/distance modes.
 */
import './logging.css';

export interface VolumeInputProps {
  reps: number | undefined;
  onChange: (reps: number | undefined) => void;
}

export function VolumeInput({ reps, onChange }: VolumeInputProps) {
  return (
    <label className="set-row__field">
      <span>Reps</span>
      <input
        type="number"
        inputMode="numeric"
        min={1}
        step={1}
        className="logging-field-input"
        value={reps ?? ''}
        onChange={(event) => {
          const raw = event.target.value;
          if (raw === '') {
            onChange(undefined);
            return;
          }
          const parsed = Number.parseInt(raw, 10);
          onChange(Number.isFinite(parsed) && parsed > 0 ? parsed : undefined);
        }}
      />
    </label>
  );
}
