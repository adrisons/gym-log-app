/**
 * ADR-0007: the one remaining tap in the set-entry flow. Renders only for
 * a row that is pre-filled from the previous set (FR-008) and that the
 * user has not yet touched — every other case commits automatically as
 * soon as an edit makes it valid (`SetRow`). Never labelled "Save" or
 * "confirm" (FR-003) — this control's one job is repeating the exact same
 * set, not confirming whatever is currently entered.
 */
import { Icon } from '@/presentation/design/icons';
import './logging.css';

export interface RepeatLastSetControlProps {
  onRepeat: () => void;
}

export function RepeatLastSetControl({ onRepeat }: RepeatLastSetControlProps) {
  return (
    <button
      type="button"
      className="logging-button logging-button--primary logging-button--icon-label"
      onClick={onRepeat}
    >
      <Icon name="check" />
      Repeat last set
    </button>
  );
}
