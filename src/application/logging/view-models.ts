/**
 * Presentation-facing formatting (data-model.md "View models") — keeps
 * `Load`/`Volume`'s raw discriminated unions and effort's number+word
 * pairing out of `presentation/` components.
 */

import type { Load } from '@/domain/load';
import type { Volume } from '@/domain/volume';
import type { Effort } from '@/domain/effort';
import type { Exercise } from '@/domain/exercise';
import type {
  DraftSet,
  DraftExerciseEntry,
  DraftBlock,
} from '@/application/logging/draft';

/**
 * Word label shown next to every effort number, never a bare digit
 * (ADR-0003). Provisional copy — an application-layer content decision
 * per spec.md Assumptions ("word labels... are an application/
 * presentation concern, not specified here"); the always-paired
 * number+word *shape* is what ADR-0003 actually binds, not this wording.
 */
export const EFFORT_LABELS: Record<Effort, string> = {
  1: 'Very light',
  2: 'Light',
  3: 'Moderate',
  4: 'Hard',
  5: 'Maximal',
};

export function formatLoad(load: Load): string {
  switch (load.kind) {
    case 'weight':
      return `${load.value} ${load.unit}`;
    case 'band':
      return `Band: ${load.label}`;
    case 'bodyweight':
      if (load.addedOrAssistedKg === undefined) return 'Bodyweight';
      return `Bodyweight ${load.addedOrAssistedKg > 0 ? '+' : ''}${load.addedOrAssistedKg} kg`;
    case 'freeText':
      return load.text;
    case 'none':
      return '—';
  }
}

export function formatVolume(volume: Volume | undefined): string {
  if (volume === undefined) return '—';
  switch (volume.kind) {
    case 'reps':
      return `${volume.count} rep${volume.count === 1 ? '' : 's'}`;
    case 'duration':
      return `${volume.seconds} s`;
    case 'distance':
      return `${volume.metres} m`;
  }
}

export function formatEffort(effort: Effort | undefined): string | undefined {
  if (effort === undefined) return undefined;
  return `${effort} — ${EFFORT_LABELS[effort]}`;
}

export interface SetSummaryViewModel {
  id: string;
  loadLabel: string;
  volumeLabel: string;
  effortLabel?: string;
  setKind: 'warmUp' | 'working' | 'toFailure';
}

export function toSetSummaryViewModel(set: DraftSet): SetSummaryViewModel {
  const effortLabel = formatEffort(set.effort);
  return {
    id: set.id,
    loadLabel: formatLoad(set.load),
    volumeLabel: formatVolume(set.volume),
    ...(effortLabel !== undefined ? { effortLabel } : {}),
    setKind: set.setKind,
  };
}

export interface ExerciseEntryViewModel {
  id: string;
  exerciseName: string;
  sets: SetSummaryViewModel[];
}

/** Resolves the entry's exercise name from the catalogue, never stored redundantly. */
export function toExerciseEntryViewModel(
  entry: DraftExerciseEntry,
  catalogue: Exercise[],
): ExerciseEntryViewModel {
  const exercise = catalogue.find((e) => e.id === entry.exerciseId);
  return {
    id: entry.id,
    exerciseName: exercise?.canonicalName ?? 'Exercise',
    sets: entry.sets.map(toSetSummaryViewModel),
  };
}

export interface BlockViewModel {
  id: string;
  displayName: string;
  type: 'straightSets' | 'superset' | 'circuit';
  entries: ExerciseEntryViewModel[];
}

/**
 * FR-007: an unnamed block's `displayName` falls back to its position
 * ("Block N"), computed here once rather than per component.
 */
export function toBlockViewModel(
  block: DraftBlock,
  index: number,
  catalogue: Exercise[],
): BlockViewModel {
  return {
    id: block.id,
    displayName: block.name ?? `Block ${index + 1}`,
    type: block.type,
    entries: block.exercises.map((entry) =>
      toExerciseEntryViewModel(entry, catalogue),
    ),
  };
}
