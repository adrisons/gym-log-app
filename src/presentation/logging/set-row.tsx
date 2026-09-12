/**
 * The "add a new set" row for one exercise entry. Shows exactly the load
 * input and volume control the exercise's set-entry template says
 * (ADR-0006) — for a fresh exercise, that's Weight + Reps and nothing
 * else. There is no per-set switch between load types or volume kinds
 * any more; that only happens through the exercise's own "Edit tracked
 * fields" menu item (`ExerciseTemplatePanel`). Effort only appears when
 * the template tracks it. Pre-filled from the entry's previous set
 * (FR-008, load/volume only, never effort). Confirming builds an
 * `AddSetInput` and hands it to the parent, which calls the store's
 * `addSet` action (this component has no `StoragePort` access —
 * `docs/architecture.md`'s presentation row).
 *
 * Keyed by the parent on the entry's set count (`key={entryId}-${sets.length}`)
 * so this component remounts, and its local input state re-initializes
 * from a fresh `prefill`, every time a set is actually added — the
 * simplest way to get "confirming an identical set is a single tap"
 * (FR-008) without a manual state-sync effect.
 */
import { useState } from 'react';
import { WeightLoadInput } from './weight-load-input';
import { BandLoadInput } from './band-load-input';
import { BodyweightLoadInput } from './bodyweight-load-input';
import { FreeTextLoadInput } from './free-text-load-input';
import { VolumeInput } from './volume-input';
import type { VolumeKind } from './volume-input';
import { EffortPicker } from './effort-picker';
import { SetConfirmControl } from './set-confirm-control';
import type { AddSetInput, SetPrefill } from '@/application/logging/draft';
import type { Load } from '@/application/logging/use-cases';
import './logging.css';

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
  if (volume.kind === 'reps') return volume.count;
  if (volume.kind === 'duration') return volume.seconds;
  return volume.metres;
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

  const load: { kind: Load['kind']; present: boolean } = (() => {
    switch (loadKind) {
      case 'weight':
        return { kind: 'weight', present: weightKg !== undefined };
      case 'band':
        return { kind: 'band', present: Boolean(bandLabel) };
      case 'bodyweight':
        return { kind: 'bodyweight', present: true };
      case 'freeText':
        return { kind: 'freeText', present: freeText.trim() !== '' };
      case 'none':
        return { kind: 'none', present: false };
    }
  })();

  const canConfirm = load.present || volumeValue !== undefined;

  const handleConfirm = () => {
    if (!canConfirm) return;

    const builtLoad: AddSetInput['load'] =
      loadKind === 'weight' && weightKg !== undefined
        ? { kind: 'weight', value: weightKg, unit: 'kg' }
        : loadKind === 'band' && bandLabel
          ? { kind: 'band', label: bandLabel }
          : loadKind === 'bodyweight'
            ? {
                kind: 'bodyweight',
                ...(bodyweightKg !== undefined
                  ? { addedOrAssistedKg: bodyweightKg }
                  : {}),
              }
            : loadKind === 'freeText' && freeText.trim() !== ''
              ? { kind: 'freeText', text: freeText.trim() }
              : { kind: 'none' };

    const builtVolume: AddSetInput['volume'] =
      volumeValue === undefined
        ? undefined
        : volumeKind === 'reps'
          ? { kind: 'reps', count: volumeValue }
          : volumeKind === 'duration'
            ? { kind: 'duration', seconds: volumeValue }
            : { kind: 'distance', metres: volumeValue };

    const input: AddSetInput = {
      ...(builtVolume !== undefined ? { volume: builtVolume } : {}),
      load: builtLoad,
      ...(effort !== undefined ? { effort } : {}),
      setKind: 'working',
    };
    onConfirm(input);
  };

  return (
    <div className="set-row">
      {loadKind === 'weight' && (
        <WeightLoadInput valueKg={weightKg} onChange={setWeightKg} />
      )}
      {loadKind === 'band' && (
        <BandLoadInput
          bandLabels={bandLabels}
          selectedLabel={bandLabel}
          onSelectLabel={setBandLabel}
          onSaveBandLabels={onSaveBandLabels}
        />
      )}
      {loadKind === 'bodyweight' && (
        <BodyweightLoadInput
          addedOrAssistedKg={bodyweightKg}
          onChange={setBodyweightKg}
        />
      )}
      {loadKind === 'freeText' && (
        <FreeTextLoadInput
          text={freeText}
          suggestions={freeTextSuggestions}
          onChange={setFreeText}
        />
      )}
      <VolumeInput
        kind={volumeKind}
        value={volumeValue}
        onValueChange={setVolumeValue}
      />
      {trackEffort && <EffortPicker value={effort} onChange={setEffort} />}
      <SetConfirmControl canConfirm={canConfirm} onConfirm={handleConfirm} />
    </div>
  );
}
