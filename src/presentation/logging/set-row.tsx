/**
 * The "add a new set" row for one exercise entry. Shows exactly the load
 * input and volume control the exercise's set-entry template says
 * (ADR-0006) — for a fresh exercise, that's Weight + Reps and nothing
 * else. There is no per-set switch between load types or volume kinds
 * any more; that only happens through the exercise's own "Edit tracked
 * fields" menu item (`ExerciseTemplatePanel`). Effort only appears when
 * the template tracks it. Pre-filled from the entry's previous set
 * (FR-008, load/volume only, never effort).
 *
 * ADR-0007: there is no confirm button. Every field's edit schedules one
 * shared, short (`COMMIT_DEBOUNCE_MS`) debounced commit for the row,
 * reset on each further edit to any field — so filling in weight, then
 * reps, then effort in quick succession still produces exactly one set
 * with all three, not one set per field. This is why no single control
 * commits on its own `onChange`: a wheel driven by repeated arrow-key
 * presses (or a quick-increment button tapped several times) fires
 * `onChange` once per step, and committing immediately on each step would
 * otherwise record a distinct set per intermediate value on the way to
 * the one the user actually meant (a real bug caught testing this in a
 * browser — dialing reps to 5 via arrow keys produced five 1-rep sets
 * before this fix). Deliberately no commit-on-blur either: leaving the
 * weight field to tab into reps is the ordinary way to fill this row, and
 * flushing right there would record the weight alone before reps ever
 * gets touched — the same fragmentation bug in a different guise. The
 * debounce is intentionally NOT cancelled on unmount either: a value the
 * user actually typed should still land even if they navigate away within
 * the window (constitution Principle II — closing the app, or leaving the
 * screen, must lose nothing already entered).
 *
 * Either way, the moment the pending result is valid (FR-019) it's what
 * gets committed, straight to `onConfirm` (this component has no
 * `StoragePort` access — `docs/architecture.md`'s presentation row). A row
 * that is already valid but untouched never schedules anything on its
 * own — nothing here ever fires from mounting with a prefilled value, only
 * from a real edit — so the one remaining tap, `RepeatLastSetControl`,
 * covers that case and disappears the instant the user changes anything.
 * Two situations reach "valid but untouched": a pre-filled row (FR-008's
 * "single tap" repeat), and a fresh Bodyweight-load row with no previous
 * set at all — Bodyweight counts as "present" with no component entered
 * (`domain/load.ts`), so it is already a legal `Set` before any field is
 * touched, and with nothing to edit there would otherwise be no way to
 * record it at all. The control's label tells the two apart.
 *
 * `onConfirm` is read through a ref that's refreshed on every render
 * (`onConfirmRef`), not captured directly in the debounce's closure: the
 * prop passed down here closes over this row's current `blockId`/`entryId`
 * at the call site (`logging-screen.tsx`), and if the exercise entry is
 * moved to another block while a commit is still pending, the timer must
 * call the *current* `onConfirm` (bound to the new block) when it fires,
 * not the one captured back when the edit happened.
 *
 * Keyed by the parent on the entry's set count (`key={entryId}-${sets.length}`)
 * so this component remounts, and its local input state re-initializes
 * from a fresh `prefill`, every time a set is actually added.
 */
import { useEffect, useRef, useState } from 'react';
import { WeightLoadInput } from './weight-load-input';
import { BandLoadInput } from './band-load-input';
import { BodyweightLoadInput } from './bodyweight-load-input';
import { FreeTextLoadInput } from './free-text-load-input';
import { VolumeInput, MAX_REPS } from './volume-input';
import type { VolumeKind } from './volume-input';
import { EffortPicker } from './effort-picker';
import { RepeatLastSetControl } from './repeat-last-set-control';
import type { AddSetInput, SetPrefill } from '@/application/logging/draft';
import type { Load } from '@/application/logging/use-cases';
import './logging.css';

export const COMMIT_DEBOUNCE_MS = 500;

export interface SetRowProps {
  prefill: SetPrefill | undefined;
  loadKind: Load['kind'];
  volumeKind: VolumeKind;
  trackEffort: boolean;
  bandLabels: string[];
  freeTextSuggestions: string[];
  onConfirm: (input: AddSetInput) => void;
  onSaveBandLabels: (labels: string[]) => void;
}

function initialVolumeValue(
  prefill: SetPrefill | undefined,
  volumeKind: VolumeKind,
): number | undefined {
  const volume = prefill?.volume;
  if (!volume || volume.kind !== volumeKind) return undefined;
  if (volume.kind === 'reps') {
    // A legal historical `Set` can hold a rep count the reps wheel
    // doesn't offer (it only goes to `MAX_REPS` — domain `createVolume`
    // has no upper bound). Left as-is, `WheelPicker` would silently fall
    // back to its "unset" position while this out-of-range value stayed
    // held here, letting an edit elsewhere auto-commit it despite the
    // wheel visibly showing nothing selected. Normalizing to `undefined`
    // here keeps what's held in sync with what's shown.
    return volume.count <= MAX_REPS ? volume.count : undefined;
  }
  if (volume.kind === 'duration') return volume.seconds;
  return volume.metres;
}

interface FieldSnapshot {
  weightKg: number | undefined;
  bandLabel: string | undefined;
  bodyweightKg: number | undefined;
  freeText: string;
  volumeValue: number | undefined;
  effort: 1 | 2 | 3 | 4 | 5 | undefined;
}

export function SetRow({
  prefill,
  loadKind,
  volumeKind,
  trackEffort,
  bandLabels,
  freeTextSuggestions,
  onConfirm,
  onSaveBandLabels,
}: SetRowProps) {
  const prefillMatchesLoadKind = prefill?.load.kind === loadKind;
  const [weightKg, setWeightKg] = useState<number | undefined>(
    prefillMatchesLoadKind && prefill!.load.kind === 'weight'
      ? prefill!.load.value
      : undefined,
  );
  const [bandLabel, setBandLabel] = useState<string | undefined>(
    prefillMatchesLoadKind && prefill!.load.kind === 'band'
      ? prefill!.load.label
      : undefined,
  );
  const [bodyweightKg, setBodyweightKg] = useState<number | undefined>(
    prefillMatchesLoadKind && prefill!.load.kind === 'bodyweight'
      ? prefill!.load.addedOrAssistedKg
      : undefined,
  );
  const [freeText, setFreeText] = useState<string>(
    prefillMatchesLoadKind && prefill!.load.kind === 'freeText'
      ? prefill!.load.text
      : '',
  );
  const [volumeValue, setVolumeValue] = useState<number | undefined>(
    initialVolumeValue(prefill, volumeKind),
  );
  const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5 | undefined>(
    undefined,
  );
  const [touched, setTouched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  // Kept current every render (not read via a captured closure) so a
  // debounce timer already in flight calls whatever `onConfirm` is by the
  // time it fires, not the one bound to this row's block at the moment the
  // edit happened — see the stale-block-id note above.
  const onConfirmRef = useRef(onConfirm);
  useEffect(() => {
    onConfirmRef.current = onConfirm;
  }, [onConfirm]);

  const buildInput = (fields: FieldSnapshot): AddSetInput | undefined => {
    const load: { kind: Load['kind']; present: boolean } = (() => {
      switch (loadKind) {
        case 'weight':
          return { kind: 'weight', present: fields.weightKg !== undefined };
        case 'band':
          return { kind: 'band', present: Boolean(fields.bandLabel) };
        case 'bodyweight':
          return { kind: 'bodyweight', present: true };
        case 'freeText':
          return { kind: 'freeText', present: fields.freeText.trim() !== '' };
        case 'none':
          return { kind: 'none', present: false };
      }
    })();

    const canConfirm = load.present || fields.volumeValue !== undefined;
    if (!canConfirm) return undefined;

    const builtLoad: AddSetInput['load'] =
      loadKind === 'weight' && fields.weightKg !== undefined
        ? { kind: 'weight', value: fields.weightKg, unit: 'kg' }
        : loadKind === 'band' && fields.bandLabel
          ? { kind: 'band', label: fields.bandLabel }
          : loadKind === 'bodyweight'
            ? {
                kind: 'bodyweight',
                ...(fields.bodyweightKg !== undefined
                  ? { addedOrAssistedKg: fields.bodyweightKg }
                  : {}),
              }
            : loadKind === 'freeText' && fields.freeText.trim() !== ''
              ? { kind: 'freeText', text: fields.freeText.trim() }
              : { kind: 'none' };

    const builtVolume: AddSetInput['volume'] =
      fields.volumeValue === undefined
        ? undefined
        : volumeKind === 'reps'
          ? { kind: 'reps', count: fields.volumeValue }
          : volumeKind === 'duration'
            ? { kind: 'duration', seconds: fields.volumeValue }
            : { kind: 'distance', metres: fields.volumeValue };

    return {
      ...(builtVolume !== undefined ? { volume: builtVolume } : {}),
      load: builtLoad,
      ...(fields.effort !== undefined ? { effort: fields.effort } : {}),
      setKind: 'working',
    };
  };

  const currentFields: FieldSnapshot = {
    weightKg,
    bandLabel,
    bodyweightKg,
    freeText,
    volumeValue,
    effort,
  };
  const liveInput = buildInput(currentFields);

  function clearPendingCommit() {
    if (debounceRef.current !== undefined) {
      clearTimeout(debounceRef.current);
      debounceRef.current = undefined;
    }
  }

  /** Marks the row touched, stores a field's new value, and (re)schedules
   * the row's one shared debounced commit — computed now, from `value`
   * substituted in explicitly alongside this render's other fields, not
   * read back off state later when the timer fires (state may have moved
   * on by then; `value` and the other fields as of *this* edit are what
   * this specific commit should reflect). */
  function updateField<K extends keyof FieldSnapshot>(
    field: K,
    value: FieldSnapshot[K],
    setter: (value: FieldSnapshot[K]) => void,
  ) {
    setTouched(true);
    setter(value);
    clearPendingCommit();
    const input = buildInput({ ...currentFields, [field]: value });
    if (input) {
      debounceRef.current = setTimeout(() => {
        debounceRef.current = undefined;
        onConfirmRef.current(input);
      }, COMMIT_DEBOUNCE_MS);
    }
  }

  // Valid without any edit: either a pre-filled repeat (FR-008), or a
  // fresh Bodyweight-only row with nothing else required (see file
  // doc comment) — the two cases `RepeatLastSetControl` covers.
  const untouchedValidInput = !touched ? liveInput : undefined;

  return (
    <div className="set-row">
      {loadKind === 'weight' && (
        <WeightLoadInput
          valueKg={weightKg}
          onChange={(value) => updateField('weightKg', value, setWeightKg)}
        />
      )}
      {loadKind === 'band' && (
        <BandLoadInput
          bandLabels={bandLabels}
          selectedLabel={bandLabel}
          onSelectLabel={(value) =>
            updateField('bandLabel', value, setBandLabel)
          }
          onSaveBandLabels={onSaveBandLabels}
        />
      )}
      {loadKind === 'bodyweight' && (
        <BodyweightLoadInput
          addedOrAssistedKg={bodyweightKg}
          onChange={(value) =>
            updateField('bodyweightKg', value, setBodyweightKg)
          }
        />
      )}
      {loadKind === 'freeText' && (
        <FreeTextLoadInput
          text={freeText}
          suggestions={freeTextSuggestions}
          onChange={(value) => updateField('freeText', value, setFreeText)}
        />
      )}
      <VolumeInput
        kind={volumeKind}
        value={volumeValue}
        onValueChange={(value) =>
          updateField('volumeValue', value, setVolumeValue)
        }
      />
      {trackEffort && (
        <EffortPicker
          value={effort}
          onChange={(value) => updateField('effort', value, setEffort)}
        />
      )}
      {untouchedValidInput && (
        <RepeatLastSetControl
          onRepeat={() => onConfirm(untouchedValidInput)}
          {...(prefill === undefined ? { label: 'Log this set' } : {})}
        />
      )}
      {!liveInput && (
        <p className="logging-screen__field-label" role="status">
          Enter a load or a rep count to record this set.
        </p>
      )}
    </div>
  );
}
