/**
 * FR-004/005: add, rename, reorder and remove band load labels from
 * Settings — reusing the existing `listBandLabels`/`saveBandLabels`
 * (`specs/001-log-a-session` FR-011); no new port method. Removing or
 * renaming a label here never rewrites a set already logged with it
 * (FR-005) — those sets store the label text directly, not a reference to
 * this list.
 */
import { useEffect, useRef, useState } from 'react';
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

  // Chains every save onto one queue (mirrors
  // `session-detail-screen.tsx`'s `saveQueueRef`, Copilot review, PR #31):
  // a rename fires this on every keystroke, unserialized, so two calls
  // close together could otherwise resolve out of order and persist an
  // older label list last, clobbering the newer one the UI already shows.
  const saveQueueRef = useRef(Promise.resolve());

  function persist(next: string[]): void {
    setLabels(next);
    const attempt = saveQueueRef.current.then(() =>
      requireStorage().saveBandLabels(next),
    );
    // Attached synchronously so the ref never holds a promise that itself
    // rejects — otherwise a failed save would permanently short-circuit
    // every later rename/reorder/remove chained onto it.
    saveQueueRef.current = attempt.catch((error: unknown) => {
      console.error('Failed to save band labels', error);
    });
  }

  if (!loaded) {
    return <section className="settings-section" aria-label="Band labels" />;
  }

  return (
    <section className="settings-section" aria-label="Band labels">
      <h2>Band labels</h2>
      {labels.map((label, index) => (
        // Keyed on position alone, not `${label}-${index}` (a pre-existing
        // bug, found debugging the save-queue fix below): keying on the
        // label text meant every keystroke while renaming changed the
        // key, so React unmounted and remounted the row's `<input>` on
        // each character — losing focus/selection mid-rename in real use,
        // and silently dropping every fireEvent past the first in a test
        // that queries the element once and reuses it.
        <div className="settings-band-row" key={index}>
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
