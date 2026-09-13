/**
 * ADR-0007: the one remaining tap in the set-entry flow. Renders for a row
 * that is already valid (FR-019) but that the user has not yet touched —
 * every other case commits automatically as soon as an edit makes it valid
 * (`SetRow`). Two cases reach this state: a row pre-filled from the
 * previous set (FR-008), labelled "Repeat last set"; and a fresh row with
 * no previous set to repeat that is nonetheless already valid untouched —
 * a Bodyweight load with no other field required, since Bodyweight is
 * "present" on its own (`domain/load.ts`'s `createLoad`) — labelled "Log
 * this set" via the `label` prop. Never labelled "Save" or "confirm"
 * (FR-003) — this control's job is committing a value the user chose by
 * *not* editing anything further, not confirming an edit already made.
 */
import { Icon } from '@/presentation/design/icons';
import './logging.css';

export interface RepeatLastSetControlProps {
  onRepeat: () => void;
  label?: string;
}

export function RepeatLastSetControl({
  onRepeat,
  label = 'Repeat last set',
}: RepeatLastSetControlProps) {
  return (
    <button
      type="button"
      className="logging-button logging-button--primary logging-button--icon-label"
      onClick={onRepeat}
    >
      <Icon name="check" />
      {label}
    </button>
  );
}
