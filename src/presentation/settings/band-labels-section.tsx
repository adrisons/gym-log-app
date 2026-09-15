/**
 * FR-004/005: add, rename, reorder and remove band load labels from
 * Settings — reusing the existing `listBandLabels`/`saveBandLabels`
 * (`specs/001-log-a-session` FR-011); no new port method. Removing or
 * renaming a label here never rewrites a set already logged with it
 * (FR-005) — those sets store the label text directly, not a reference to
 * this list.
 */
import { useEffect, useState } from 'react';
import { requireStorage } from '@/application/storage-access';

export function BandLabelsSection() {
  const [labels, setLabels] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const stored = await requireStorage().listBandLabels();
      setLabels(stored);
      setLoaded(true);
    })();
  }, []);

  async function persist(next: string[]): Promise<void> {
    setLabels(next);
    await requireStorage().saveBandLabels(next);
  }

  if (!loaded) {
    return <section className="settings-section" aria-label="Band labels" />;
  }

  return (
    <section className="settings-section" aria-label="Band labels">
      <h2>Band labels</h2>
      {labels.map((label, index) => (
        <div className="settings-band-row" key={`${label}-${index}`}>
          <input
            className="settings-field-input settings-band-row__label"
            aria-label={`Band label ${index + 1}`}
            value={label}
            onChange={(event) => {
              const next = [...labels];
              next[index] = event.target.value;
              void persist(next);
            }}
          />
          <button
            type="button"
            className="settings-button"
            aria-label={`Move ${label || 'this band label'} up`}
            disabled={index === 0}
            onClick={() => {
              const next = [...labels];
              const [item] = next.splice(index, 1);
              if (item === undefined) return;
              next.splice(index - 1, 0, item);
              void persist(next);
            }}
          >
            Up
          </button>
          <button
            type="button"
            className="settings-button"
            aria-label={`Move ${label || 'this band label'} down`}
            disabled={index === labels.length - 1}
            onClick={() => {
              const next = [...labels];
              const [item] = next.splice(index, 1);
              if (item === undefined) return;
              next.splice(index + 1, 0, item);
              void persist(next);
            }}
          >
            Down
          </button>
          <button
            type="button"
            className="settings-button"
            aria-label={`Remove ${label || 'this band label'}`}
            onClick={() => {
              void persist(labels.filter((_, i) => i !== index));
            }}
          >
            Remove
          </button>
        </div>
      ))}

      <div className="settings-band-row">
        <label className="settings-field-label settings-band-row__label">
          New band label
          <input
            className="settings-field-input"
            value={newLabel}
            onChange={(event) => setNewLabel(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="settings-button settings-button--primary"
          disabled={newLabel.trim().length === 0}
          onClick={() => {
            const trimmed = newLabel.trim();
            if (trimmed.length === 0) return;
            void persist([...labels, trimmed]);
            setNewLabel('');
          }}
        >
          Add
        </button>
      </div>
    </section>
  );
}
