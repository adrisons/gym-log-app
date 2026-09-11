import { describe, expect, it } from 'vitest';
import { createHarness } from '../support';
import {
  openLoggingForm,
  createExercise,
} from '../../src/application/logging/use-cases';
import {
  addExerciseEntry,
  addSet,
  addBlock,
  moveExerciseAcrossBlocks,
  deleteBlock,
} from '../../src/application/logging/draft';
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

// spec.md User Story 2 Independent Test: two blocks, move an exercise
// between them, delete a block with sets, undo it within the window, and
// confirm the draft matches the pre-deletion state exactly.
describe('Logging flow (US2 Independent Test)', () => {
  it('moves an exercise across blocks, then delete+undo restores a block with sets exactly', async () => {
    const { storage } = createHarness();
    let draft = await openLoggingForm(storage);
    const exercise = await createExercise(storage, { canonicalName: 'Row' });

    draft = addBlock(draft, 'A', 'straightSets');
    draft = addBlock(draft, 'B', 'straightSets');
    const blockAId = draft.blocks[0]!.id;
    const blockBId = draft.blocks[1]!.id;

    draft = addExerciseEntry(draft, exercise.id);
    // addExerciseEntry appends to the last block (B); move it to A instead.
    const entryId = draft.blocks[1]!.exercises[0]!.id;
    draft = moveExerciseAcrossBlocks(draft, blockBId, entryId, blockAId);
    expect(draft.blocks[0]?.exercises).toHaveLength(1);
    expect(draft.blocks[1]?.exercises).toHaveLength(0);

    draft = addSet(
      draft,
      blockAId,
      entryId,
      {
        volume: { kind: 'reps', count: 5 },
        load: { kind: 'none' },
        setKind: 'working',
      },
      Date.now(),
      undefined,
    );
    const beforeDelete = draft;

    const { draft: afterDelete, undo } = deleteBlock(draft, blockAId);
    expect(afterDelete.blocks).toHaveLength(1);

    const restored = undo.restore(afterDelete);
    await storage.saveDraft(restored);

    expect(restored).toEqual(beforeDelete);
  });
});
