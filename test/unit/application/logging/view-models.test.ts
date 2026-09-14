import { describe, expect, it } from 'vitest';
import {
  EFFORT_LABELS,
  formatLoad,
  formatVolume,
  formatEffort,
  toSetSummaryViewModel,
  toExerciseEntryViewModel,
  toBlockViewModel,
} from '@/application/logging/view-models';
import type { DraftSet, DraftBlock } from '@/application/logging/draft';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId } from '@/domain/ids';

describe('view-models formatters (data-model.md "View models")', () => {
  it('formatLoad renders every load kind', () => {
    expect(formatLoad({ kind: 'weight', value: 60, unit: 'kg' })).toBe('60 kg');
    expect(formatLoad({ kind: 'band', label: 'Red' })).toBe('Band: Red');
    expect(formatLoad({ kind: 'bodyweight' })).toBe('Bodyweight');
    expect(formatLoad({ kind: 'bodyweight', addedOrAssistedKg: 10 })).toBe(
      'Bodyweight +10 kg',
    );
    expect(formatLoad({ kind: 'bodyweight', addedOrAssistedKg: -20 })).toBe(
      'Bodyweight -20 kg',
    );
    expect(formatLoad({ kind: 'freeText', text: 'Machine setting 4' })).toBe(
      'Machine setting 4',
    );
    expect(formatLoad({ kind: 'none' })).toBe('—');
  });

  it('formatVolume renders every volume kind, and "—" when absent', () => {
    expect(formatVolume({ kind: 'reps', count: 8 })).toBe('8 reps');
    expect(formatVolume({ kind: 'reps', count: 1 })).toBe('1 rep');
    expect(formatVolume({ kind: 'duration', seconds: 45 })).toBe('45 s');
    expect(formatVolume({ kind: 'distance', metres: 400 })).toBe('400 m');
    expect(formatVolume(undefined)).toBe('—');
  });

  it('formatEffort always pairs the number with its word label (ADR-0003), or is undefined when absent', () => {
    for (const level of [1, 2, 3, 4, 5] as const) {
      expect(formatEffort(level)).toBe(`${level} — ${EFFORT_LABELS[level]}`);
    }
    expect(formatEffort(undefined)).toBeUndefined();
  });

  it('toSetSummaryViewModel combines a compact volume and load into one "x"-joined line (ADR-0013), with no effortTone when effort is absent', () => {
    const set: DraftSet = {
      id: 'set-1',
      load: { kind: 'weight', value: 70, unit: 'kg' },
      volume: { kind: 'reps', count: 8 },
      setKind: 'working',
      completed: true,
    };
    const vm = toSetSummaryViewModel(set);
    expect(vm).toEqual({
      id: 'set-1',
      summaryLine: '8 x 70kg',
      setKind: 'working',
    });
    expect('effortTone' in vm).toBe(false);
  });

  it('toSetSummaryViewModel appends " - <effort word>" and sets effortTone when effort is recorded', () => {
    const set: DraftSet = {
      id: 'set-2',
      load: { kind: 'weight', value: 70, unit: 'kg' },
      volume: { kind: 'reps', count: 8 },
      effort: 2,
      setKind: 'working',
      completed: true,
    };
    const vm = toSetSummaryViewModel(set);
    expect(vm.summaryLine).toBe('8 x 70kg - Light');
    expect(vm.effortTone).toBe('success');
  });

  it.each([
    [1, 'success'],
    [2, 'success'],
    [3, 'warning'],
    [4, 'warning'],
    [5, 'danger'],
  ] as const)('effort level %i maps to the %s tone', (effort, tone) => {
    const vm = toSetSummaryViewModel({
      id: 'set-tone',
      load: { kind: 'none' },
      volume: { kind: 'reps', count: 8 },
      effort,
      setKind: 'working',
      completed: true,
    });
    expect(vm.effortTone).toBe(tone);
  });

  it('toSetSummaryViewModel shows only the volume, with no "x", for a none-kind load', () => {
    const set: DraftSet = {
      id: 'set-3',
      load: { kind: 'none' },
      volume: { kind: 'reps', count: 8 },
      setKind: 'working',
      completed: true,
    };
    const vm = toSetSummaryViewModel(set);
    expect(vm.summaryLine).toBe('8');
  });

  it('toSetSummaryViewModel formats duration/distance volume compactly (no unit word)', () => {
    expect(
      toSetSummaryViewModel({
        id: 'set-4',
        load: { kind: 'none' },
        volume: { kind: 'duration', seconds: 45 },
        setKind: 'working',
        completed: true,
      }).summaryLine,
    ).toBe('45s');
    expect(
      toSetSummaryViewModel({
        id: 'set-5',
        load: { kind: 'none' },
        volume: { kind: 'distance', metres: 400 },
        setKind: 'working',
        completed: true,
      }).summaryLine,
    ).toBe('400m');
  });

  it('toSetSummaryViewModel keeps non-weight load kinds as their full formatLoad text', () => {
    expect(
      toSetSummaryViewModel({
        id: 'set-6',
        load: { kind: 'band', label: 'Red' },
        volume: { kind: 'reps', count: 12 },
        setKind: 'working',
        completed: true,
      }).summaryLine,
    ).toBe('12 x Band: Red');
  });
});

describe('toExerciseEntryViewModel / toBlockViewModel (FR-007)', () => {
  const exercise: Exercise = {
    id: 'ex-1' as ExerciseId,
    canonicalName: 'Back squat',
    aliases: [],
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
  };

  it('resolves the exercise name from the catalogue', () => {
    const vm = toExerciseEntryViewModel(
      { id: 'entry-1', exerciseId: exercise.id, notes: '', sets: [] },
      [exercise],
    );
    expect(vm.exerciseName).toBe('Back squat');
  });

  it('falls back to a generic name if the exercise is not in the catalogue', () => {
    const vm = toExerciseEntryViewModel(
      { id: 'entry-1', exerciseId: exercise.id, notes: '', sets: [] },
      [],
    );
    expect(vm.exerciseName).toBe('Exercise');
  });

  it('an unnamed block falls back to "Block N" from its position, never "Untitled" (FR-007)', () => {
    const block: DraftBlock = {
      id: 'block-1',
      type: 'straightSets',
      exercises: [],
    };
    expect(toBlockViewModel(block, 1, []).displayName).toBe('Block 2');
  });

  it('a named block keeps its name', () => {
    const block: DraftBlock = {
      id: 'block-1',
      name: 'Squats',
      type: 'straightSets',
      exercises: [],
    };
    expect(toBlockViewModel(block, 0, []).displayName).toBe('Squats');
  });
});
