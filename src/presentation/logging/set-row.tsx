/**
 * The "add a new set" row for one exercise entry — every load type
 * (Weight/Band/Bodyweight/Free text/None), every volume kind (reps/
 * duration/distance), and effort (US3), pre-filled from the entry's
 * previous set (FR-008, load/volume only, never effort). Confirming
 * builds an `AddSetInput` and hands it to the parent, which calls the
 * store's `addSet` action (this component has no `StoragePort` access —
 * `docs/architecture.md`'s presentation row).
 *
 * Keyed by the parent on the entry's set count (`key={entryId}-${sets.length}`)
 * so this component remounts, and its local input state re-initializes
 * from a fresh `prefill`, every time a set is actually added — the
 * simplest way to get "confirming an identical set is a single tap"
 * (FR-008) without a manual state-sync effect.
 */
import { useState } from 'react';
import { LoadTypePicker, LOAD_TYPE_LABELS } from './load-type-picker';
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
  defaultLoadKind: Load['kind'];
  bandLabels: string[];
  freeTextSuggestions: string[];
  onConfirm: (input: AddSetInput) => void;
  onLoadTypeChange: (kind: Load['kind']) => void;
  onSaveBandLabels: (labels: string[]) => void;
}

function initialVolumeKind(prefill: SetPrefill | undefined): VolumeKind {
  return prefill?.volume?.kind ?? 'reps';
}

function initialVolumeValue(
  prefill: SetPrefill | undefined,
): number | undefined {
  const volume = prefill?.volume;
  if (!volume) return undefined;
  if (volume.kind === 'reps') return volume.count;
  if (volume.kind === 'duration') return volume.seconds;
  return volume.metres;
}

export function SetRow({
  prefill,
  defaultLoadKind,
  bandLabels,
  freeTextSuggestions,
  onConfirm,
  onLoadTypeChange,
  onSaveBandLabels,
}: SetRowProps) {
  const [loadKind, setLoadKind] = useState<Load['kind']>(
    prefill?.load.kind ?? defaultLoadKind,
  );
  const [weightKg, setWeightKg] = useState<number | undefined>(
    prefill?.load.kind === 'weight' ? prefill.load.value : undefined,
  );
  const [bandLabel, setBandLabel] = useState<string | undefined>(
    prefill?.load.kind === 'band' ? prefill.load.label : undefined,
  );
  const [bodyweightKg, setBodyweightKg] = useState<number | undefined>(
    prefill?.load.kind === 'bodyweight'
      ? prefill.load.addedOrAssistedKg
      : undefined,
  );
  const [freeText, setFreeText] = useState<string>(
    prefill?.load.kind === 'freeText' ? prefill.load.text : '',
  );
  const [volumeKind, setVolumeKind] = useState<VolumeKind>(
    initialVolumeKind(prefill),
  );
  const [volumeValue, setVolumeValue] = useState<number | undefined>(
    initialVolumeValue(prefill),
  );
  const [effort, setEffort] = useState<1 | 2 | 3 | 4 | 5 | undefined>(
    undefined,
  );
  const [loadTypeOpen, setLoadTypeOpen] = useState(false);

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

  const handleLoadTypeChange = (kind: Load['kind']) => {
    setLoadKind(kind);
    onLoadTypeChange(kind);
  };

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
      {loadTypeOpen ? (
        <LoadTypePicker
          selected={loadKind}
          onSelect={(kind) => {
            handleLoadTypeChange(kind);
            setLoadTypeOpen(false);
          }}
        />
      ) : (
        <button
          type="button"
          className="logging-button"
          onClick={() => setLoadTypeOpen(true)}
        >
          Change load type ({LOAD_TYPE_LABELS[loadKind]})
        </button>
      )}
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
        onKindChange={setVolumeKind}
        onValueChange={setVolumeValue}
      />
      <EffortPicker value={effort} onChange={setEffort} />
      <SetConfirmControl canConfirm={canConfirm} onConfirm={handleConfirm} />
    </div>
  );
}
