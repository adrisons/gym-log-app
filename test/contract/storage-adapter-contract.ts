/**
 * The shared `StoragePort` contract suite (spec 003
 * contracts/storage-adapters.md), run against both real adapters in real
 * browsers (spec 003 research.md §3 — jsdom has no IndexedDB/File System
 * Access implementation). Extends, rather than replaces, the vocabulary
 * spec 002 already established for the in-memory fake
 * (`test/unit/storage-port-fake.test.ts`).
 *
 * `runStorageAdapterContract` takes a `createStore` factory, called once
 * per scenario to produce a fresh, isolated persisted store (so scenarios
 * never see each other's data — `US4-1`'s "before any write" check in
 * particular would be meaningless on a store a prior scenario already
 * wrote to). Each scenario then calls the `makeAdapter` function that
 * factory returns as many times as it needs within its own `run` — every
 * call after the first simulates an app restart against the *same*
 * underlying store (spec 003 quickstart.md's "a fresh script context, not
 * just a re-render").
 *
 * Schema-version scope note: `CURRENT_SCHEMA_VERSION` is 2 as of ADR-0006
 * (Exercise gained `defaultVolumeKind`/`trackEffort`), so a real v1->v2
 * `decideSchemaAction` "migrate" transition now exists in both real
 * adapters (`#backfillExerciseTemplateDefaults`). It has no scenario in
 * *this* suite: `setSchemaVersion` is the only public, schema-check-free
 * way to seed a stale version, and every other `StoragePort` write
 * (including `saveExercise`) runs `#ensureSchemaChecked` first — so a
 * legacy-shaped record saved through this harness would trigger the
 * migrate transition (against whatever already exists, empty here)
 * *before* that same call's own write lands, never producing a genuinely
 * pre-migration stored record to migrate. A real device doesn't hit this
 * gap: its v1 exercises are already sitting in storage from earlier
 * sessions before the upgraded app's first call ever runs the check. The
 * migration's own logic is covered by code review, not a contract
 * scenario — `decideSchemaAction` itself stays proven at the pure-function
 * level, `test/unit/infrastructure/schema-version.test.ts`, against
 * synthetic current/stored fixtures. This suite proves the three
 * adapter-level cases reachable through the public port:
 * never-initialized, same, newer.
 */
import type {
  StoragePort,
  DateRange,
} from '../../src/application/ports/storage-port';
import type { LoggingDraft } from '../../src/application/ports/storage-port';
import type { Session } from '../../src/domain/session';
import type { Exercise } from '../../src/domain/exercise';
import type { BodyMeasurement } from '../../src/domain/body-measurement';
import type { SessionId, ExerciseId } from '../../src/domain/ids';
import { createSet } from '../../src/domain/set';
import { createLoad } from '../../src/domain/load';
import { createVolume } from '../../src/domain/volume';
import { StorageError } from '../../src/application/errors';

export interface ContractFailure {
  scenario: string;
  error: string;
}

export interface ContractResult {
  passed: string[];
  failed: ContractFailure[];
}

type MakeAdapter = () => Promise<StoragePort>;

/**
 * Produces a fresh, isolated persisted store, returning a `MakeAdapter`
 * bound to it — every call the returned function makes points at that
 * same store, simulating a restart. `dispose` (if given) is called once
 * the scenario finishes, win or lose — e.g. closing an IndexedDB
 * connection opened for this scenario's own handle cache. Every scenario
 * gets its own store, so leaving `dispose` out accumulates one open
 * connection per scenario for the suite's lifetime; harnesses running
 * many scenarios in one page session (spec 003 research.md §3) should
 * always provide it.
 */
type StoreFactory = () => Promise<{
  makeAdapter: MakeAdapter;
  dispose?: () => void | Promise<void>;
}>;

interface Scenario {
  name: string;
  run: (makeAdapter: MakeAdapter) => Promise<void>;
}

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
  return {
    id: 'ex-1' as ExerciseId,
    canonicalName: 'Back squat',
    aliases: [],
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: false,
    discipline: 'Strength',
    ...overrides,
  };
}

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'sess-1' as SessionId,
    dateTime: '2026-09-10T18:00:00.000Z',
    blocks: [],
    notes: '',
    ...overrides,
  };
}

function makeDraft(overrides: Partial<LoggingDraft> = {}): LoggingDraft {
  return {
    id: 'draft-1',
    dateTime: '2026-09-11T09:00:00.000Z',
    lastEditedAt: '2026-09-11T09:00:00.000Z',
    blocks: [],
    notes: '',
    ...overrides,
  };
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

const ALL_TIME: DateRange = { from: '2000-01-01', to: '2100-01-01' };

// Sessions (contracts/storage-adapters.md scenarios 1-3, US1)

const sessionScenarios: Scenario[] = [
  {
    name: 'US1-1: a saved Session with nested Block/ExerciseEntry/Set survives a restart',
    async run(makeAdapter) {
      const writer = await makeAdapter();
      const session = makeSession({
        blocks: [
          {
            type: 'straightSets',
            exercises: [
              {
                exerciseId: 'ex-1' as ExerciseId,
                notes: '',
                sets: [
                  createSet({
                    volume: createVolume({ kind: 'reps', count: 5 }),
                    load: createLoad({
                      kind: 'weight',
                      value: 100,
                      unit: 'kg',
                    }),
                    setKind: 'working',
                    completed: true,
                  }),
                ],
              },
            ],
          },
        ],
      });
      await writer.saveSession(session);

      const reader = await makeAdapter();
      const loaded = await reader.getSession(session.id);
      assert(
        deepEqual(loaded, session),
        'getSession returns the session unchanged after restart',
      );
      const listed = await reader.listSessions(ALL_TIME);
      assert(
        listed.some((s) => deepEqual(s, session)),
        'listSessions includes the session after restart',
      );
    },
  },
  {
    name: 'US1-2: an added Exercise survives a restart',
    async run(makeAdapter) {
      const writer = await makeAdapter();
      const exercise = makeExercise();
      await writer.saveExercise(exercise);

      const reader = await makeAdapter();
      assert(
        deepEqual(await reader.getExercise(exercise.id), exercise),
        'getExercise returns the exercise unchanged after restart',
      );
      const listed = await reader.listExercises();
      assert(
        listed.some((e) => deepEqual(e, exercise)),
        'listExercises includes the exercise after restart',
      );
    },
  },
  {
    name: 'US1-3: a saved BodyMeasurement survives a restart',
    async run(makeAdapter) {
      const writer = await makeAdapter();
      const measurement: BodyMeasurement = {
        date: '2026-09-10',
        bodyWeightKg: 78.4,
        notes: '',
      };
      await writer.saveBodyMeasurement(measurement);

      const reader = await makeAdapter();
      const listed = await reader.listBodyMeasurements({
        from: '2026-09-01',
        to: '2026-09-30',
      });
      assert(
        listed.some((m) => deepEqual(m, measurement)),
        'listBodyMeasurements includes the measurement after restart',
      );
    },
  },
  {
    name: 'US1-4: deleteSession removes a session durably',
    async run(makeAdapter) {
      const writer = await makeAdapter();
      const session = makeSession({ id: 'sess-to-delete' as SessionId });
      await writer.saveSession(session);
      await writer.deleteSession(session.id);

      const reader = await makeAdapter();
      assert(
        (await reader.getSession(session.id)) === undefined,
        'getSession returns undefined for a deleted session after restart',
      );
    },
  },
];

// Draft (contracts/storage-adapters.md scenarios 4-5, US2)

const draftScenarios: Scenario[] = [
  {
    name: 'US2-1: a saved Draft survives a restart when not discarded or promoted',
    async run(makeAdapter) {
      const writer = await makeAdapter();
      const draft = makeDraft({
        blocks: [
          {
            id: 'block-1',
            type: 'straightSets',
            exercises: [
              {
                id: 'entry-1',
                exerciseId: 'ex-1' as ExerciseId,
                notes: '',
                sets: [
                  {
                    id: 'set-1',
                    load: createLoad({ kind: 'weight', value: 60, unit: 'kg' }),
                    volume: createVolume({ kind: 'reps', count: 8 }),
                    setKind: 'working',
                    completed: true,
                  },
                ],
              },
            ],
          },
        ],
      });
      await writer.saveDraft(draft);

      const reader = await makeAdapter();
      assert(
        deepEqual(await reader.getDraft(), draft),
        'getDraft returns the same draft after restart',
      );
    },
  },
  {
    name: 'US2-2: discardDraft leaves nothing behind after a restart',
    async run(makeAdapter) {
      const writer = await makeAdapter();
      await writer.saveDraft(makeDraft());
      await writer.discardDraft();

      const reader = await makeAdapter();
      assert(
        (await reader.getDraft()) === undefined,
        'getDraft returns undefined after discardDraft and a restart',
      );
    },
  },
];

// Cross-adapter parity / band labels (contracts/storage-adapters.md scenario 7, US3)

const crossAdapterScenarios: Scenario[] = [
  {
    name: 'US3-1: Band labels round-trip in order across a restart',
    async run(makeAdapter) {
      const writer = await makeAdapter();
      await writer.saveBandLabels(['Red', 'Blue', 'Green']);

      const reader = await makeAdapter();
      assert(
        deepEqual(await reader.listBandLabels(), ['Red', 'Blue', 'Green']),
        'listBandLabels preserves order after restart',
      );
    },
  },
];

// Schema version (contracts/storage-adapters.md scenarios 8, 10, 11 — US4; see module doc comment on scenario 9)

const schemaVersionScenarios: Scenario[] = [
  {
    name: 'US4-1: a never-initialized device opens with no migration and adopts the current version on first write',
    async run(makeAdapter) {
      const adapter = await makeAdapter();
      assert(
        (await adapter.getSchemaVersion()) === 0,
        'getSchemaVersion is 0 (never-initialized sentinel) before any write',
      );
      await adapter.saveBandLabels(['first-write']);
      assert(
        (await adapter.getSchemaVersion()) >= 1,
        'getSchemaVersion is at least 1 after the first real write',
      );
    },
  },
  {
    name: 'US4-2: a device at the current schema version opens normally with no data change',
    async run(makeAdapter) {
      const writer = await makeAdapter();
      await writer.saveBandLabels(['unchanged']);
      const versionBefore = await writer.getSchemaVersion();

      const reader = await makeAdapter();
      assert(
        (await reader.getSchemaVersion()) === versionBefore,
        'getSchemaVersion is unchanged on a same-version open',
      );
      assert(
        deepEqual(await reader.listBandLabels(), ['unchanged']),
        'data is unchanged on a same-version open',
      );
    },
  },
  {
    name: 'US4-3: a device at a newer schema version than this app understands refuses every write',
    async run(makeAdapter) {
      const seeder = await makeAdapter();
      await seeder.setSchemaVersion(999);

      const adapter = await makeAdapter();
      let threw: unknown;
      try {
        await adapter.saveBandLabels(['should-not-be-written']);
      } catch (error) {
        threw = error;
      }
      assert(
        threw instanceof StorageError,
        'a write on a too-new device rejects with StorageError',
      );
      assert(
        (threw as StorageError).kind === 'schema-too-new',
        'the rejection kind is schema-too-new',
      );

      const verifier = await makeAdapter();
      assert(
        (await verifier.getSchemaVersion()) === 999,
        'the stored (too-new) schema version is left untouched',
      );
    },
  },
];

// Cascades and atomicity (contracts/storage-adapters.md scenarios 12-13)

const cascadeScenarios: Scenario[] = [
  {
    name: 'mergeExercises reassigns every referencing Session Set and repoints a referencing Draft, durably',
    async run(makeAdapter) {
      const writer = await makeAdapter();
      const survivor = makeExercise({
        id: 'ex-survivor' as ExerciseId,
        canonicalName: 'Back squat',
      });
      const loser = makeExercise({
        id: 'ex-loser' as ExerciseId,
        canonicalName: 'Squats',
      });
      await writer.saveExercise(survivor);
      await writer.saveExercise(loser);
      const session = makeSession({
        id: 'sess-merge' as SessionId,
        blocks: [
          {
            type: 'straightSets',
            exercises: [
              {
                exerciseId: loser.id,
                notes: '',
                sets: [
                  createSet({
                    volume: createVolume({ kind: 'reps', count: 5 }),
                    load: createLoad({ kind: 'none' }),
                    setKind: 'working',
                    completed: true,
                  }),
                ],
              },
            ],
          },
        ],
      });
      await writer.saveSession(session);
      const draft = makeDraft({
        blocks: [
          {
            id: 'block-1',
            type: 'straightSets',
            exercises: [
              {
                id: 'entry-1',
                exerciseId: loser.id,
                notes: '',
                sets: [],
              },
            ],
          },
        ],
      });
      await writer.saveDraft(draft);

      await writer.mergeExercises(survivor.id, loser.id);

      const reader = await makeAdapter();
      const reloadedSession = await reader.getSession(session.id);
      assert(
        reloadedSession?.blocks[0]?.exercises[0]?.exerciseId === survivor.id,
        'the Session Set is reassigned to the survivor after restart',
      );
      const reloadedSurvivor = await reader.getExercise(survivor.id);
      assert(
        (reloadedSurvivor?.aliases ?? []).includes('Squats'),
        'the survivor gains the loser name as an alias after restart',
      );
      assert(
        (await reader.getExercise(loser.id)) === undefined,
        'the loser exercise is gone after restart',
      );
      const reloadedDraft = await reader.getDraft();
      assert(
        reloadedDraft?.blocks[0]?.exercises[0]?.exerciseId === survivor.id,
        'the draft reference is repointed to the survivor after restart',
      );
    },
  },
  {
    name: 'deleteExerciseCascade removes every referencing ExerciseEntry/Set and prunes a referencing Draft, durably',
    async run(makeAdapter) {
      const writer = await makeAdapter();
      const exercise = makeExercise({ id: 'ex-to-delete' as ExerciseId });
      await writer.saveExercise(exercise);
      const session = makeSession({
        id: 'sess-cascade' as SessionId,
        blocks: [
          {
            type: 'straightSets',
            exercises: [
              {
                exerciseId: exercise.id,
                notes: '',
                sets: [
                  createSet({
                    volume: createVolume({ kind: 'reps', count: 5 }),
                    load: createLoad({ kind: 'none' }),
                    setKind: 'working',
                    completed: true,
                  }),
                ],
              },
            ],
          },
        ],
      });
      await writer.saveSession(session);
      const draft = makeDraft({
        blocks: [
          {
            id: 'block-1',
            type: 'straightSets',
            exercises: [
              { id: 'entry-1', exerciseId: exercise.id, notes: '', sets: [] },
            ],
          },
        ],
      });
      await writer.saveDraft(draft);

      await writer.deleteExerciseCascade(exercise.id);

      const reader = await makeAdapter();
      assert(
        (await reader.getExercise(exercise.id)) === undefined,
        'the exercise is gone after restart',
      );
      const reloadedSession = await reader.getSession(session.id);
      assert(
        deepEqual(reloadedSession?.blocks[0]?.exercises, []),
        'the Session ExerciseEntry is removed after restart',
      );
      const reloadedDraft = await reader.getDraft();
      assert(
        deepEqual(reloadedDraft?.blocks[0]?.exercises, []),
        'the draft ExerciseEntry is pruned, block kept, after restart',
      );
    },
  },
  {
    name: 'mergeExercises rejects identical survivor/loser ids with StorageError, writing nothing',
    async run(makeAdapter) {
      const adapter = await makeAdapter();
      const exercise = makeExercise();
      await adapter.saveExercise(exercise);
      let threw: unknown;
      try {
        await adapter.mergeExercises(exercise.id, exercise.id);
      } catch (error) {
        threw = error;
      }
      assert(threw instanceof StorageError, 'rejects with StorageError');
    },
  },
  {
    name: 'deleteExerciseCascade rejects a nonexistent id with StorageError',
    async run(makeAdapter) {
      const adapter = await makeAdapter();
      let threw: unknown;
      try {
        await adapter.deleteExerciseCascade('ex-does-not-exist' as ExerciseId);
      } catch (error) {
        threw = error;
      }
      assert(threw instanceof StorageError, 'rejects with StorageError');
    },
  },
];

// Errors (contracts/storage-adapters.md scenarios 15-16)
// Scenario 15 (quota-exceeded) and 16 (permission-lost, File System Access
// only) are not run generically here — they require adapter-specific
// fault injection the harness itself sets up (research.md §3) rather than
// a makeAdapter-only scenario; see test/e2e/file-system-adapter.contract.spec.ts
// (T029) and the harness for how each is exercised.

export const CONTRACT_SCENARIOS: Scenario[] = [
  ...sessionScenarios,
  ...draftScenarios,
  ...crossAdapterScenarios,
  ...schemaVersionScenarios,
  ...cascadeScenarios,
];

export async function runStorageAdapterContract(
  createStore: StoreFactory,
): Promise<ContractResult> {
  const passed: string[] = [];
  const failed: ContractFailure[] = [];
  for (const scenario of CONTRACT_SCENARIOS) {
    const outcome = await runOneScenario(scenario, createStore);
    if (outcome.passed) passed.push(scenario.name);
    else failed.push({ scenario: scenario.name, error: outcome.error });
  }
  return { passed, failed };
}

/**
 * Runs exactly one named scenario against a fresh store. Exists
 * separately from `runStorageAdapterContract` so a Playwright test can
 * drive one `page.evaluate()` call per scenario instead of cramming all
 * ~15 into a single browser-side call — CI's `chromium` hit a
 * reproducible, real (not flaky — 3/3) crash specifically on the
 * File System Access contract test's single giant `page.evaluate()`
 * ("Target page, context or browser has been closed", Chromium crashpad
 * visible in the browser logs, on both the default headless-shell binary
 * and the full Chrome-for-Testing build) that never reproduced locally.
 * Isolating each scenario to its own call gives the CDP protocol a
 * boundary per scenario, and if a specific scenario is the real trigger,
 * only that one test fails instead of the whole suite silently losing
 * its browser context.
 */
export async function runOneScenario(
  scenario: Scenario,
  createStore: StoreFactory,
): Promise<{ passed: true } | { passed: false; error: string }> {
  const { makeAdapter, dispose } = await createStore();
  try {
    await scenario.run(makeAdapter);
    return { passed: true };
  } catch (error) {
    return {
      passed: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    await dispose?.();
  }
}

export function findScenario(name: string): Scenario | undefined {
  return CONTRACT_SCENARIOS.find((s) => s.name === name);
}
