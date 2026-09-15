/**
 * ADR-0010: defines a brand-new catalogue `Exercise`, name and set-entry
 * template together — the `/exercises` screen previously offered no way
 * to add an exercise at all (only manage one already created implicitly
 * via the logging screen's "Create…" search shortcut, which always
 * defaults to Weight + Reps, no effort). Reuses `ExerciseTemplateFields`,
 * the same template controls `ExerciseTemplatePanel` edits an existing
 * exercise with, so a newly created exercise and a later template edit
 * never present different controls for the same thing.
 *
 * Blocks a name/alias collision the same way `ExerciseSearchField`'s
 * "create" shortcut already does (FR-015/FR-022: two exercises must never
 * end up sharing a name or alias) — Create disables with an explanatory
 * message once the trimmed, normalized name matches an existing exercise.
 *
 * `onCreate` is awaited here, not fire-and-forget: the button disables for
 * the duration of the write (blocking a double-tap from creating two
 * exercises for one name) and a rejection is caught and logged, leaving
 * the form open to retry rather than silently closing on failure — the
 * same convention `ExerciseTemplatePanel`'s own save button follows.
 */
import { useEffect, useRef, useState } from 'react';
import { ExerciseTemplateFields } from '../logging/exercise-template-fields';
import { normalize } from '@/application/logging/use-cases';
import type { Exercise, Load, Volume } from '@/application/logging/use-cases';
import { Icon } from '@/presentation/design/icons';
import '../logging/logging.css';

export interface NewExerciseInput {
  canonicalName: string;
  defaultLoadType: Load['kind'];
  defaultVolumeKind: Volume['kind'];
  trackEffort: boolean;
}

export interface CreateExercisePanelProps {
  /** Checked for a name/alias collision before Create is ever enabled. */
  catalogue: Exercise[];
  onCreate: (input: NewExerciseInput) => Promise<void>;
  onClose: () => void;
}

export function CreateExercisePanel({
  catalogue,
  onCreate,
  onClose,
}: CreateExercisePanelProps) {
  const [name, setName] = useState('');
  const [loadType, setLoadType] = useState<Load['kind']>('weight');
  const [volumeKind, setVolumeKind] = useState<Volume['kind']>('reps');
  const [trackEffort, setTrackEffort] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Same focus-restore lifecycle as `ExerciseTemplatePanel` (see that
  // component's own doc comment): captures whatever had focus before this
  // dialog mounted (the "New exercise" trigger) and hands it back on
  // unmount — otherwise closing (Create or Cancel) drops keyboard focus to
  // the document body instead. The name field's own focus is set here too
  // (a plain `autoFocus` attribute would move focus to the field *before*
  // this effect runs — React applies it during commit, ahead of any
  // passive effect — so `document.activeElement` would already read as
  // the field itself by the time this callback captures it, restoring
  // focus to a node that's about to unmount instead of the real trigger).
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    nameInputRef.current?.focus();
    return () => {
      previouslyFocused?.focus();
    };
  }, []);

  const trimmedName = name.trim();
  const normalizedName = normalize(trimmedName);
  const collidesWith = catalogue.find((exercise) =>
    [exercise.canonicalName, ...exercise.aliases].some(
      (candidate) => normalize(candidate) === normalizedName,
    ),
  );
  const canSave = trimmedName !== '' && !collidesWith && !submitting;

  async function handleCreate() {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await onCreate({
        canonicalName: trimmedName,
        defaultLoadType: loadType,
        defaultVolumeKind: volumeKind,
        trackEffort,
      });
    } catch (error) {
      console.error('Failed to create exercise', error);
      setSubmitting(false);
    }
  }

  return (
    <div className="block-card" role="dialog" aria-label="New exercise">
      <label className="logging-screen__field-label">
        <span>Name</span>
        <input
          ref={nameInputRef}
          type="text"
          className="logging-field-input"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      {collidesWith && (
        <p role="status">
          &quot;{trimmedName}&quot; is already used by &quot;
          {collidesWith.canonicalName}&quot;.
        </p>
      )}

      <ExerciseTemplateFields
        loadType={loadType}
        onLoadTypeChange={setLoadType}
        volumeKind={volumeKind}
        onVolumeKindChange={setVolumeKind}
        trackEffort={trackEffort}
        onTrackEffortChange={setTrackEffort}
      />

      <button
        type="button"
        className="logging-button logging-button--primary logging-button--icon-label"
        disabled={!canSave}
        aria-disabled={!canSave}
        onClick={() => void handleCreate()}
      >
        <Icon name="check" />
        Create exercise
      </button>
      <button
        type="button"
        className="logging-button logging-button--icon-label"
        onClick={onClose}
      >
        <Icon name="close" />
        Cancel
      </button>
    </div>
  );
}
