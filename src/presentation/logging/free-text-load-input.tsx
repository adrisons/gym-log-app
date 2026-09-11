/**
 * FR-012: a Free text load. Capped at 40 characters with a visible
 * counter (not just a submit-time rejection); autocompletes from values
 * previously used for this exercise via a native `<datalist>`.
 */
import './logging.css';

const MAX_LENGTH = 40;

export interface FreeTextLoadInputProps {
  text: string;
  suggestions: string[];
  onChange: (text: string) => void;
}

export function FreeTextLoadInput({
  text,
  suggestions,
  onChange,
}: FreeTextLoadInputProps) {
  return (
    <label className="set-row__field">
      <span>Machine / setting</span>
      <input
        type="text"
        list="free-text-load-suggestions"
        maxLength={MAX_LENGTH}
        className="logging-field-input"
        value={text}
        onChange={(event) => onChange(event.target.value.slice(0, MAX_LENGTH))}
      />
      <datalist id="free-text-load-suggestions">
        {suggestions.map((suggestion) => (
          <option key={suggestion} value={suggestion} />
        ))}
      </datalist>
      <span>
        {text.length}/{MAX_LENGTH}
      </span>
    </label>
  );
}
