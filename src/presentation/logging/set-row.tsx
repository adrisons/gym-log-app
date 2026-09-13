/**
 * The "add/edit a set" form for one exercise entry. Shows exactly the load
 * input and volume control the exercise's set-entry template says
 * (ADR-0006) — for a fresh exercise, that's Weight + Reps and nothing
 * else. There is no per-set switch between load types or volume kinds any
 * more; that only happens through the exercise's own "Edit tracked fields"
 * menu item (`ExerciseTemplatePanel`). Effort only appears when the
 * template tracks it.
 *
 * ADR-0010 (superseding ADR-0007): recording a set is an explicit action
 * again. Filling in one field of a multi-field set (e.g. reps, before
 * weight is even touched) no longer saves anything on its own — every
 * field edit only updates this row's own local state; nothing reaches
 * `onConfirm` until the **Confirm** button is pressed. That button is
 * `disabled` (with a status line explaining why) until the row holds
 * every value the exercise's current template actually asks for — see
 * `buildRequirement` below.
 *
 * Add vs. edit mode: `editingSet`, when given, switches this row into
 * editing an already-recorded set in place — a capability sessions/
 * exercises didn't have before ADR-0010. In that mode the row's load/
 * volume kind come from the set being edited (`editingSet.load.kind`/
 * `editingSet.volume?.kind`), never the exercise's *current* template —
 * an already-recorded `Set` keeps exactly the kind it was given (ADR-0006);
 * editing lets the user correct its values, not silently re-kind it to
 * whatever the template has since become. Editing also only ever requires
 * the domain minimum (a load or a volume, FR-019) rather than the fuller
 * add-mode requirement below — the row starts pre-filled from an already
 * valid set, so there is no "half-entered" state to guard against, and
 * the exercise's template may have moved on since this particular set was
 * recorded.
 *
 * `prefill` (add mode only, FR-008) carries the previous set's load/volume
 * forward so confirming an identical repeat is immediate: fill nothing,
 * just press Confirm. Effort is deliberately never carried forward this
 * way (spec.md Clarifications, 2026-09-09) — only `editingSet` ever
 * pre-fills effort, since that is genuinely the value already recorded on
 * this exact set, not a guess forwarded from a different one.
 */
import { useState } from 'react';
import { WeightLoadInput } from './weight-load-input';
import { BandLoadInput } from './band-load-input';
import { BodyweightLoadInput } from './bodyweight-load-input';
import { FreeTextLoadInput } from './free-text-load-input';
import { VolumeInput, MAX_REPS } from './volume-input';
import type { VolumeKind } from './volume-input';
import { EffortPicker } from './effort-picker';
import { Icon } from '@/presentation/design/icons';
import type { AddSetInput, SetPrefill } from '@/application/logging/draft';
import type { Load, Volume, Effort } from '@/application/logging/use-cases';
import './logging.css';

export interface EditingSet {
  load: Load;
  volume?: Volume;
  effort?: Effort;
}

export interface SetRowProps {
  prefill: SetPrefill | undefined;
  /** Switches this row into editing an already-recorded set in place
   * (ADR-0010) — omit/undefined for the ordinary "add a new set" row. */
  editingSet?: EditingSet | undefined;
  loadKind: Load['kind'];
  volumeKind: VolumeKind;
  trackEffort: boolean;
  bandLabels: string[];
  freeTextSuggestions: string[];
  onConfirm: (input: AddSetInput) => void;
  /** Shown as a Cancel button alongside Confirm when given — the caller
   * decides when that's appropriate (editing an existing set always wants
   * one; adding a fresh set usually doesn't). */
  onCancel?: (() => void) | undefined;
  onSaveBandLabels: (labels: string[]) => void;
}

const VOLUME_KIND_WORDS: Record<VolumeKind, string> = {
  reps: 'a rep count',
  duration: 'a duration',
  distance: 'a distance',
};

/** Only these load kinds require the user to actually type/pick a value —
 * Bodyweight is "present" on its own with nothing entered, and None has no
 * field to fill at all (`domain/load.ts`'s `createLoad`). */
const LOAD_KIND_WORDS: Partial<Record<Load['kind'], string>> = {
  weight: 'a weight',
  band: 'a band',
  freeText: 'a value',
};

/**
 * Builds the add-mode status message for a row that isn't yet confirmable,
 * naming exactly what the exercise's current template still needs (ADR-
 * 0010) — never the old blanket "a load or a rep count", which was untrue
 * the moment a template tracked both and the user had only filled one.
 */
function missingFieldsMessage(
  loadKind: Load['kind'],
  volumeKind: VolumeKind,
  loadPresent: boolean,
  volumePresent: boolean,
): string | undefined {
  const missing: string[] = [];
  const loadWord = LOAD_KIND_WORDS[loadKind];
  if (loadWord && !loadPresent) missing.push(loadWord);
  if (!volumePresent) missing.push(VOLUME_KIND_WORDS[volumeKind]);
  if (missing.length === 0) return undefined;
  return `Enter ${missing.join(' and ')} to record this set.`;
}

function initialVolumeValue(
  volume: Volume | undefined,
  volumeKind: VolumeKind,
): number | undefined {
  if (!volume || volume.kind !== volumeKind) return undefined;
  if (volume.kind === 'reps') {
    // A legal historical `Set` can hold a rep count the reps wheel
    // doesn't offer (it only goes to `MAX_REPS` — domain `createVolume`
    // has no upper bound). Left as-is, `WheelPicker` would silently fall
    // back to its "unset" position while this out-of-range value stayed
    // held here, letting an edit elsewhere confirm it despite the wheel
    // visibly showing nothing selected. Normalizing to `undefined` here
    // keeps what's held in sync with what's shown.
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
  editingSet,
  loadKind,
  volumeKind,
  trackEffort,
  bandLabels,
  freeTextSuggestions,
  onConfirm,
  onCancel,
  onSaveBandLabels,
}: SetRowProps) {
  // An already-recorded set keeps exactly the kind it was given (ADR-0006)
  // — editing it must use *that* kind, never the exercise's current
  // template, which may have moved on since. Add mode has no such history
  // to defer to, so it always uses the template's current kind.
  const effectiveLoadKind = editingSet ? editingSet.load.kind : loadKind;
  const effectiveVolumeKind: VolumeKind = editingSet?.volume
    ? editingSet.volume.kind
    : volumeKind;

  const initialLoad = editingSet?.load ?? prefill?.load;
  const loadMatchesEffectiveKind = initialLoad?.kind === effectiveLoadKind;

  const [weightKg, setWeightKg] = useState<number | undefined>(
    loadMatchesEffectiveKind && initialLoad!.kind === 'weight'
      ? initialLoad!.value
      : undefined,
  );
  const [bandLabel, setBandLabel] = useState<string | undefined>(
    loadMatchesEffectiveKind && initialLoad!.kind === 'band'
      ? initialLoad!.label
      : undefined,
  );
  const [bodyweightKg, setBodyweightKg] = useState<number | undefined>(
    loadMatchesEffectiveKind && initialLoad!.kind === 'bodyweight'
      ? initialLoad!.addedOrAssistedKg
      : undefined,
  );
  const [freeText, setFreeText] = useState<string>(
    loadMatchesEffectiveKind && initialLoad!.kind === 'freeText'
      ? initialLoad!.text
      : '',
  );
  const [volumeValue, setVolumeValue] = useState<number | undefined>(
    initialVolumeValue(
      editingSet?.volume ?? prefill?.volume,
      effectiveVolumeKind,
    ),
  );
  const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5 | undefined>(
    editingSet?.effort,
  );

  const buildInput = (fields: FieldSnapshot): AddSetInput | undefined => {
    const load: { kind: Load['kind']; present: boolean } = (() => {
      switch (effectiveLoadKind) {
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

    const domainValid = load.present || fields.volumeValue !== undefined;
    if (!domainValid) return undefined;

    const builtLoad: AddSetInput['load'] =
      effectiveLoadKind === 'weight' && fields.weightKg !== undefined
        ? { kind: 'weight', value: fields.weightKg, unit: 'kg' }
        : effectiveLoadKind === 'band' && fields.bandLabel
          ? { kind: 'band', label: fields.bandLabel }
          : effectiveLoadKind === 'bodyweight'
            ? {
                kind: 'bodyweight',
                ...(fields.bodyweightKg !== undefined
                  ? { addedOrAssistedKg: fields.bodyweightKg }
                  : {}),
              }
            : effectiveLoadKind === 'freeText' && fields.freeText.trim() !== ''
              ? { kind: 'freeText', text: fields.freeText.trim() }
              : { kind: 'none' };

    const builtVolume: AddSetInput['volume'] =
      fields.volumeValue === undefined
        ? undefined
        : effectiveVolumeKind === 'reps'
          ? { kind: 'reps', count: fields.volumeValue }
          : effectiveVolumeKind === 'duration'
            ? { kind: 'duration', seconds: fields.volumeValue }
            : { kind: 'distance', metres: fields.volumeValue };

    // Preserves an already-recorded effort even if the template no longer
    // tracks it (so `EffortPicker` isn't shown to change/clear it) — this
    // is an edit to a specific historical value, not a template change,
    // and ADR-0006's "template changes never touch history" cuts both
    // ways: it must not silently drop what this exact set already had.
    const effort =
      trackEffort || editingSet === undefined
        ? fields.effort
        : editingSet.effort;

    return {
      ...(builtVolume !== undefined ? { volume: builtVolume } : {}),
      load: builtLoad,
      ...(effort !== undefined ? { effort } : {}),
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
  const load: { present: boolean } = (() => {
    switch (effectiveLoadKind) {
      case 'weight':
        return { present: weightKg !== undefined };
      case 'band':
        return { present: Boolean(bandLabel) };
      case 'bodyweight':
        return { present: true };
      case 'freeText':
        return { present: freeText.trim() !== '' };
      case 'none':
        return { present: false };
    }
  })();
  const volumePresent = volumeValue !== undefined;

  // Editing an existing set only ever needs the domain minimum (FR-019) —
  // it started out already valid, and the template it was recorded under
  // may since have moved on. A fresh add needs every field the *current*
  // template actually asks for (ADR-0010) — the bug this whole change
  // exists to fix was a set silently saved with only one of two required
  // values.
  const canConfirm = editingSet
    ? load.present || volumePresent
    : (LOAD_KIND_WORDS[effectiveLoadKind] === undefined || load.present) &&
      volumePresent;

  const requirementMessage = canConfirm
    ? undefined
    : editingSet
      ? 'Enter a load or a rep count to record this set.'
      : missingFieldsMessage(
          effectiveLoadKind,
          effectiveVolumeKind,
          load.present,
          volumePresent,
        );

  function handleConfirm() {
    const input = buildInput(currentFields);
    if (input) onConfirm(input);
  }

  return (
    <div className="set-row">
      {effectiveLoadKind === 'weight' && (
        <WeightLoadInput valueKg={weightKg} onChange={setWeightKg} />
      )}
      {effectiveLoadKind === 'band' && (
        <BandLoadInput
          bandLabels={bandLabels}
          selectedLabel={bandLabel}
          onSelectLabel={setBandLabel}
          onSaveBandLabels={onSaveBandLabels}
        />
      )}
      {effectiveLoadKind === 'bodyweight' && (
        <BodyweightLoadInput
          addedOrAssistedKg={bodyweightKg}
          onChange={setBodyweightKg}
        />
      )}
      {effectiveLoadKind === 'freeText' && (
        <FreeTextLoadInput
          text={freeText}
          suggestions={freeTextSuggestions}
          onChange={setFreeText}
        />
      )}
      <VolumeInput
        kind={effectiveVolumeKind}
        value={volumeValue}
        onValueChange={setVolumeValue}
      />
      {trackEffort && <EffortPicker value={effort} onChange={setEffort} />}
      <div className="set-row__inputs">
        <button
          type="button"
          className="logging-button logging-button--primary logging-button--icon-label"
          disabled={!canConfirm}
          aria-disabled={!canConfirm}
          onClick={handleConfirm}
        >
          <Icon name="check" />
          {editingSet ? 'Save changes' : 'Add set'}
        </button>
        {onCancel && (
          <button
            type="button"
            className="logging-button logging-button--icon-label"
            onClick={onCancel}
          >
            <Icon name="close" />
            Cancel
          </button>
        )}
      </div>
      {requirementMessage && (
        <p className="logging-screen__field-label" role="status">
          {requirementMessage}
        </p>
      )}
    </div>
  );
}
