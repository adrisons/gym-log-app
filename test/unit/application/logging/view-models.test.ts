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

  it('toSetSummaryViewModel omits effortLabel entirely when effort is absent (exactOptionalPropertyTypes)', () => {
    const set: DraftSet = {
      id: 'set-1',
      load: { kind: 'weight', value: 60, unit: 'kg' },
      volume: { kind: 'reps', count: 8 },
      setKind: 'working',
      completed: true,
    };
    const vm = toSetSummaryViewModel(set);
    expect(vm).toEqual({
      id: 'set-1',
      loadLabel: '60 kg',
      volumeLabel: '8 reps',
      setKind: 'working',
    });
    expect('effortLabel' in vm).toBe(false);
  });

  it('toSetSummaryViewModel includes effortLabel when present', () => {
    const set: DraftSet = {
      id: 'set-2',
      load: { kind: 'none' },
      volume: { kind: 'reps', count: 8 },
      effort: 3,
      setKind: 'working',
      completed: true,
    };
    const vm = toSetSummaryViewModel(set);
    expect(vm.effortLabel).toBe('3 — Moderate');
  });
});

describe('toExerciseEntryViewModel / toBlockViewModel (FR-007)', () => {
  const exercise: Exercise = {
    id: 'ex-1' as ExerciseId,
    canonicalName: 'Back squat',
    aliases: [],
    defaultLoadType: 'weight',
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
