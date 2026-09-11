/**
 * The "add a new set" row for one exercise entry (US1: Weight + reps
 * only; US3 extends this with the full `LoadTypePicker`/effort surface).
 * Pre-filled from the entry's previous set (FR-008); confirming builds an
 * `AddSetInput` and hands it to the parent, which is responsible for
 * calling the store's `addSet` action (this component has no `StoragePort`
 * access — `docs/architecture.md`'s presentation row).
 *
 * Keyed by the parent on the entry's set count (`key={entryId}-${sets.length}`)
 * so this component remounts, and its local input state re-initializes
 * from a fresh `prefill`, every time a set is actually added — the
 * simplest way to get "confirming an identical set is a single tap"
 * (FR-008) without a manual state-sync effect.
 */
import { useState } from 'react';
import { WeightLoadInput } from './weight-load-input';
import { VolumeInput } from './volume-input';
import { SetConfirmControl } from './set-confirm-control';
import type { AddSetInput, SetPrefill } from '@/application/logging/draft';
import './logging.css';

export interface SetRowProps {
  prefill: SetPrefill | undefined;
  onConfirm: (input: AddSetInput) => void;
}

export function SetRow({ prefill, onConfirm }: SetRowProps) {
  const initialWeightKg =
    prefill?.load.kind === 'weight' ? prefill.load.value : undefined;
  const initialReps =
    prefill?.volume?.kind === 'reps' ? prefill.volume.count : undefined;

  const [weightKg, setWeightKg] = useState<number | undefined>(initialWeightKg);
  const [reps, setReps] = useState<number | undefined>(initialReps);

  const canConfirm = weightKg !== undefined || reps !== undefined;

  const handleConfirm = () => {
    if (!canConfirm) return;
    const input: AddSetInput = {
      ...(reps !== undefined
        ? { volume: { kind: 'reps' as const, count: reps } }
        : {}),
      load:
        weightKg !== undefined
          ? { kind: 'weight' as const, value: weightKg, unit: 'kg' as const }
          : { kind: 'none' as const },
      setKind: 'working',
    };
    onConfirm(input);
  };

  return (
    <div className="set-row">
      <div className="set-row__inputs">
        <WeightLoadInput valueKg={weightKg} onChange={setWeightKg} />
        <VolumeInput reps={reps} onChange={setReps} />
      </div>
      <SetConfirmControl canConfirm={canConfirm} onConfirm={handleConfirm} />
    </div>
  );
}
