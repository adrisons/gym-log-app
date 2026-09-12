/**
 * FR-001: the session's date-time, fixed at creation, user-editable. A
 * native `<input type="datetime-local">` on design tokens — always
 * editable (no disabled state applies, `contracts/logging-screen-components.md`).
 */
import { Icon } from '@/presentation/design/icons';
import './logging.css';

function isoToLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** `datetime-local`'s value has no timezone — parsed as local time (ECMA-262). */
function localInputValueToIso(value: string): string {
  return new Date(value).toISOString();
}

export interface SessionDateTimeFieldProps {
  value: string;
  onChange: (iso: string) => void;
}

export function SessionDateTimeField({
  value,
  onChange,
}: SessionDateTimeFieldProps) {
  return (
    <label className="logging-screen__field-label">
      <span className="logging-screen__field-label--icon">
        <Icon name="calendar" />
        Session date &amp; time
      </span>
      <input
        type="datetime-local"
        className="logging-field-input"
        value={isoToLocalInputValue(value)}
        onChange={(event) => {
          if (event.target.value) {
            onChange(localInputValueToIso(event.target.value));
          }
        }}
      />
    </label>
  );
}
