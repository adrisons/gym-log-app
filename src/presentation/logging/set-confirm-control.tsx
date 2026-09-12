/**
 * FR-003, FR-019, FR-025: confirms a set. Disabled-with-reason (not a
 * silent no-op — `contracts/logging-screen-components.md`'s stated
 * preference) until the pending set has a volume or a non-`none` load.
 * Never labelled "Save" (FR-003 — no visible Save control anywhere).
 */
import { Icon } from '@/presentation/design/icons';
import './logging.css';

export interface SetConfirmControlProps {
  canConfirm: boolean;
  onConfirm: () => void;
}

export function SetConfirmControl({
  canConfirm,
  onConfirm,
}: SetConfirmControlProps) {
  return (
    <div>
      <button
        type="button"
        className="logging-button logging-button--primary logging-button--icon-label"
        disabled={!canConfirm}
        aria-disabled={!canConfirm}
        onClick={onConfirm}
      >
        <Icon name="check" />
        Add set
      </button>
      {!canConfirm && (
        <p className="logging-screen__field-label" role="status">
          Enter a load or a rep count to record this set.
        </p>
      )}
    </div>
  );
}
