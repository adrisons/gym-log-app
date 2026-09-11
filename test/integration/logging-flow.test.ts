import { describe, expect, it } from 'vitest';
import { createHarness } from '../support';
import {
  openLoggingForm,
  createExercise,
} from '../../src/application/logging/use-cases';
import { addExerciseEntry, addSet } from '../../src/application/logging/draft';

// spec.md User Story 1 Independent Test: through createHarness() (the real
// InMemoryStorage, not pure values), open the form, create an exercise,
// add it, add a set, and confirm it round-trips through storage.getDraft()
// — proves the optimistic-then-persist pattern works against the port,
// not just pure functions (FR-003, FR-005 at the port-contract level).

describe('Logging flow (US1 Independent Test)', () => {
  it('open → create exercise → add entry → add set → round-trips through storage.getDraft()', async () => {
    const { storage } = createHarness();

    const draft = await openLoggingForm(storage);
    const exercise = await createExercise(storage, {
      canonicalName: 'Back squat',
    });

    const withEntry = addExerciseEntry(draft, exercise.id);
    const withSet = addSet(
      withEntry,
      withEntry.blocks[0]!.id,
      withEntry.blocks[0]!.exercises[0]!.id,
      {
        volume: { kind: 'reps', count: 5 },
        load: { kind: 'weight', value: 100, unit: 'kg' },
        setKind: 'working',
      },
      Date.now(),
      undefined,
    );
    await storage.saveDraft(withSet);

    const reloaded = await storage.getDraft();
    expect(reloaded?.blocks[0]?.exercises[0]?.exerciseId).toBe(exercise.id);
    expect(reloaded?.blocks[0]?.exercises[0]?.sets).toHaveLength(1);
    expect(reloaded?.blocks[0]?.exercises[0]?.sets[0]?.load).toEqual({
      kind: 'weight',
      value: 100,
      unit: 'kg',
    });
  });
});
