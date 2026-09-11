/**
 * FR-011: a Band load, picked from the user's own reorderable label list.
 * "Manage labels" (add/reorder/remove) is inline here, not a separate
 * screen — FR-011 doesn't specify a dedicated location and Settings
 * (FR-11) doesn't exist yet (spec.md Non-Goals).
 */
import { useState } from 'react';
import './logging.css';

export interface BandLoadInputProps {
  bandLabels: string[];
  selectedLabel: string | undefined;
  onSelectLabel: (label: string) => void;
  onSaveBandLabels: (labels: string[]) => void;
}

export function BandLoadInput({
  bandLabels,
  selectedLabel,
  onSelectLabel,
  onSaveBandLabels,
}: BandLoadInputProps) {
  const [newLabel, setNewLabel] = useState('');

  const moveUp = (index: number) => {
    if (index === 0) return;
    const next = [...bandLabels];
    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
    onSaveBandLabels(next);
  };

  const moveDown = (index: number) => {
    if (index === bandLabels.length - 1) return;
    const next = [...bandLabels];
    [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
    onSaveBandLabels(next);
  };

  const remove = (index: number) => {
    onSaveBandLabels(bandLabels.filter((_, i) => i !== index));
  };

  return (
    <div className="set-row__field">
      <span>Band</span>
      <div role="radiogroup" aria-label="Band label" className="set-list">
        {bandLabels.map((label, index) => (
          <div key={label} className="set-row__inputs">
            <button
              type="button"
              role="radio"
              aria-checked={label === selectedLabel}
              className="logging-button"
              onClick={() => onSelectLabel(label)}
            >
              {label}
            </button>
            <button
              type="button"
              className="logging-button"
              disabled={index === 0}
              aria-label={`Move ${label} up`}
              onClick={() => moveUp(index)}
            >
              ↑
            </button>
            <button
              type="button"
              className="logging-button"
              disabled={index === bandLabels.length - 1}
              aria-label={`Move ${label} down`}
              onClick={() => moveDown(index)}
            >
              ↓
            </button>
            <button
              type="button"
              className="logging-button"
              aria-label={`Remove ${label}`}
              onClick={() => remove(index)}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <div className="set-row__inputs">
        <input
          type="text"
          className="logging-field-input"
          placeholder="New band label"
          value={newLabel}
          onChange={(event) => setNewLabel(event.target.value)}
        />
        <button
          type="button"
          className="logging-button"
          disabled={newLabel.trim() === ''}
          aria-disabled={newLabel.trim() === ''}
          onClick={() => {
            if (newLabel.trim() === '') return;
            onSaveBandLabels([...bandLabels, newLabel.trim()]);
            setNewLabel('');
          }}
        >
          Add label
        </button>
      </div>
    </div>
  );
}
