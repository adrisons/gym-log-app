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

/**
 * The success/warning/danger tone for an effort level (ADR-0003's
 * graduated intensity, `docs/design.md`'s refinement note: 1–2 success,
 * 3–4 warning, 5 danger) — the single source both `EffortPicker`'s wheel
 * and a logged set's own summary row (ADR-0013) paint with.
 */
export function effortTone(effort: Effort): 'success' | 'warning' | 'danger' {
  if (effort <= 2) return 'success';
  if (effort <= 4) return 'warning';
  return 'danger';
}

/** Compact volume for the one-line set summary (ADR-0013) — a bare count,
 * not `formatVolume`'s word-suffixed form ("8", not "8 reps"): the
 * summary line's own "x" already reads as a rep/time/distance count.
 * `undefined` when volume itself is absent (a valid load-only set, FR-3/
 * FR-019) — never a "—" placeholder standing in for the missing half of
 * an "x" join that then has nothing on the other side to join with. */
function formatVolumeCompact(volume: Volume | undefined): string | undefined {
  if (volume === undefined) return undefined;
  switch (volume.kind) {
    case 'reps':
      return `${volume.count}`;
    case 'duration':
      return `${volume.seconds}s`;
    case 'distance':
      return `${volume.metres}m`;
  }
}

/** Compact load for the one-line set summary (ADR-0013) — `undefined` for
 * a `none`-kind load (nothing to show, same reasoning `toSetSummaryViewModel`
 * already applied to the old `loadLabel`), a tight "70kg" (no space) for
 * Weight specifically; every other kind matches `formatLoad`'s own text. */
function formatLoadCompact(load: Load): string | undefined {
  switch (load.kind) {
    case 'weight':
      return `${load.value}${load.unit}`;
    case 'none':
      return undefined;
    default:
      return formatLoad(load);
  }
}

export interface SetSummaryViewModel {
  id: string;
  /** e.g. "8 x 70kg - Light" — volume and load combined ("x"-joined) when
   * both are present, or whichever one alone is present (a none-kind load,
   * or FR-019's valid load-only set with no volume) — never an "x" with
   * only one real side. " - <effort word>" is appended when effort was
   * recorded (ADR-0013). */
  summaryLine: string;
  effortTone?: 'success' | 'warning' | 'danger';
  setKind: 'warmUp' | 'working' | 'toFailure';
}

export function toSetSummaryViewModel(set: DraftSet): SetSummaryViewModel {
  const volumePart = formatVolumeCompact(set.volume);
  const loadPart = formatLoadCompact(set.load);
  const line =
    volumePart !== undefined && loadPart !== undefined
      ? `${volumePart} x ${loadPart}`
      : (volumePart ?? loadPart ?? '—');
  const summaryLine =
    set.effort !== undefined ? `${line} - ${EFFORT_LABELS[set.effort]}` : line;
  return {
    id: set.id,
    summaryLine,
    ...(set.effort !== undefined ? { effortTone: effortTone(set.effort) } : {}),
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
