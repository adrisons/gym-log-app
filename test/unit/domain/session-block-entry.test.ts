import { describe, expect, it } from 'vitest';
import { createSession } from '@/domain/session';
import { createBlock } from '@/domain/block';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import { InvalidBlockError } from '@/domain/errors';
import type { SessionId, ExerciseId } from '@/domain/ids';
import type { ExerciseEntry } from '@/domain/exercise-entry';
import * as domain from '@/domain';

describe('Session > Block > Exercise entry > Set construction (US1)', () => {
  it('constructs a Session with one Block with one Exercise entry with Sets of each Load/Volume variant, no non-domain import anywhere in this file', () => {
    const entry: ExerciseEntry = {
      exerciseId: 'ex-1' as ExerciseId,
      notes: '',
      sets: [
        createSet({
          volume: createVolume({ kind: 'reps', count: 8 }),
          load: createLoad({ kind: 'weight', value: 60, unit: 'kg' }),
          setKind: 'working',
          completed: true,
        }),
        createSet({
          volume: createVolume({ kind: 'duration', seconds: 30 }),
          load: createLoad({ kind: 'bodyweight' }),
          setKind: 'working',
          completed: true,
        }),
        createSet({
          volume: createVolume({ kind: 'distance', metres: 100 }),
          load: createLoad({ kind: 'none' }),
          setKind: 'working',
          completed: true,
        }),
        createSet({
          load: createLoad({ kind: 'band', label: 'red' }),
          setKind: 'working',
          completed: true,
        }),
        createSet({
          load: createLoad({ kind: 'freeText', text: 'heavy dumbbell' }),
          setKind: 'working',
          completed: true,
        }),
      ],
    };
    const block = createBlock({
      type: 'straightSets',
      exercises: [entry],
    });
    const session = createSession({
      id: 'sess-1' as SessionId,
      dateTime: '2026-09-11T10:00:00.000Z',
      blocks: [block],
      notes: '',
    });
    expect(session.blocks[0]?.exercises[0]?.sets).toHaveLength(5);
  });
});

// FR-017: empty lists are valid domain states.
describe('Empty lists are valid (§3.3; FR-017)', () => {
  it('accepts a Block with zero Exercise entry items (green)', () => {
    const block = createBlock({ type: 'straightSets', exercises: [] });
    expect(block.exercises).toEqual([]);
  });

  it('accepts a Session with zero Blocks (green)', () => {
    const session = createSession({
      id: 'sess-1' as SessionId,
      dateTime: '2026-09-11T10:00:00.000Z',
      blocks: [],
      notes: '',
    });
    expect(session.blocks).toEqual([]);
  });
});

// FR-018: order is list position alone — no separate stored "order" field.
describe('Order is list position only (§3.3; FR-018)', () => {
  it('has no separate order field on Block, ExerciseEntry, or Set', () => {
    const set = createSet({
      volume: createVolume({ kind: 'reps', count: 5 }),
      load: createLoad({ kind: 'none' }),
      setKind: 'working',
      completed: true,
    });
    const entry: ExerciseEntry = {
      exerciseId: 'ex-1' as ExerciseId,
      notes: '',
      sets: [set],
    };
    const block = createBlock({ type: 'straightSets', exercises: [entry] });
    const session = createSession({
      id: 'sess-1' as SessionId,
      dateTime: '2026-09-11T10:00:00.000Z',
      blocks: [block],
      notes: '',
    });
    expect('order' in block).toBe(false);
    expect('order' in entry).toBe(false);
    expect('order' in session).toBe(false);
    expect('order' in set).toBe(false);
    // Position within the array is the only record of order.
    expect(session.blocks.indexOf(block)).toBe(0);
    expect(block.exercises.indexOf(entry)).toBe(0);
    expect(entry.sets.indexOf(set)).toBe(0);
  });
});

// ADR-0008: a Block's optional target round count.
describe('Block.rounds (ADR-0008)', () => {
  it('accepts a Block with no rounds specified (green)', () => {
    const block = createBlock({ type: 'straightSets', exercises: [] });
    expect(block.rounds).toBeUndefined();
  });

  it('accepts a positive integer rounds value', () => {
    const block = createBlock({
      type: 'circuit',
      rounds: 3,
      exercises: [],
    });
    expect(block.rounds).toBe(3);
  });

  it.each([0, -1, 1.5])(
    'rejects a non-positive-integer rounds value (%s)',
    (rounds) => {
      expect(() =>
        createBlock({ type: 'circuit', rounds, exercises: [] }),
      ).toThrow(InvalidBlockError);
    },
  );
});

// FR-014: no synthesized/implied Exercise entry — a structural-absence
// check, not a rejection case (plan.md's stated Constitution-Check
// exception; tasks.md T023a).
describe('Logging is selective — no implied entries (§3.3; FR-014)', () => {
  it('exposes no runtime constructor or function on the domain barrel that creates an ExerciseEntry (or adds one to a Block) except by being passed an explicit, caller-supplied ExerciseEntry value', () => {
    const exportNames = Object.keys(domain);
    // No "auto-add" / "populate" / implicit-entry-creation API exists.
    const suspiciousNames = exportNames.filter((name) =>
      /auto|populate|implicit|synthesiz|generateEntr/i.test(name),
    );
    expect(suspiciousNames).toEqual([]);
    // The only way to add an ExerciseEntry to a Block is to pass one
    // explicitly in `exercises` — createBlock does not synthesize any.
    const block = createBlock({ type: 'straightSets', exercises: [] });
    expect(block.exercises).toHaveLength(0);
  });
});
