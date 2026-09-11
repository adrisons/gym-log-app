import { describe, expect, it } from 'vitest';
import { createHarness } from '../support';
import {
  openLoggingForm,
  createExercise,
} from '../../src/application/logging/use-cases';
import { addExerciseEntry, addSet } from '../../src/application/logging/draft';
import type { AddSetInput } from '../../src/application/logging/draft';

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

// spec.md User Story 3 Independent Test: one set per load type for the
// same exercise entry, each read back unchanged.
describe('Logging flow (US3 Independent Test)', () => {
  it('records one set per load type and reads each back unchanged', async () => {
    const { storage } = createHarness();
    const draft = await openLoggingForm(storage);
    const exercise = await createExercise(storage, { canonicalName: 'Row' });

    let working = addExerciseEntry(draft, exercise.id);
    const blockId = working.blocks[0]!.id;
    const entryId = working.blocks[0]!.exercises[0]!.id;

    const inputs: AddSetInput[] = [
      {
        volume: { kind: 'reps', count: 8 },
        load: { kind: 'weight', value: 40, unit: 'kg' },
        setKind: 'working',
      },
      {
        volume: { kind: 'reps', count: 10 },
        load: { kind: 'band', label: 'Red' },
        setKind: 'working',
      },
      {
        volume: { kind: 'reps', count: 12 },
        load: { kind: 'bodyweight', addedOrAssistedKg: 10 },
        setKind: 'working',
      },
      {
        volume: { kind: 'reps', count: 6 },
        load: { kind: 'freeText', text: 'Machine level 4' },
        setKind: 'working',
      },
      {
        volume: { kind: 'distance', metres: 400 },
        load: { kind: 'none' },
        setKind: 'working',
      },
    ];

    let now = Date.now();
    for (const input of inputs) {
      working = addSet(
        working,
        blockId,
        entryId,
        input,
        (now += 2000),
        undefined,
      );
    }
    await storage.saveDraft(working);

    const reloaded = await storage.getDraft();
    const sets = reloaded?.blocks[0]?.exercises[0]?.sets ?? [];
    expect(sets).toHaveLength(5);
    expect(sets.map((s) => s.load)).toEqual(inputs.map((i) => i.load));
  });
});
