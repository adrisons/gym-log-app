/**
 * The seed exercise catalogue (D9, ADR-0005) — a starter set of common
 * strength exercises present from first launch, so the logging critical
 * path (Principle II) never starts from a true empty state.
 *
 * `specs/006-settings-data` research.md §1: this module, and wiring it
 * into `src/presentation/main.tsx`'s first-launch check, closes a
 * pre-existing gap — D9/ADR-0005 was already `Accepted`/`Closed`, but
 * nothing in `src/` seeded anything before this spec. It is also this
 * spec's own dependency: FR-016 (delete-everything) needs a seed list to
 * reset the catalogue to.
 *
 * Twelve exercises, covering the major strength movement patterns (squat,
 * hinge, horizontal/vertical push, horizontal/vertical pull, lunge, core)
 * — enough for FR-1's "most-used and recent first" ordering and §5.5's
 * aggregate-trend pattern grouping to have real data from first launch,
 * without trying to be exhaustive (ADR-0005: full editability mitigates
 * any one list not matching every training style).
 */
import type { Exercise } from '@/domain/exercise';
import { newExerciseId } from '@/application/logging/ids';

interface SeedExerciseDefinition {
  canonicalName: string;
  movementPattern: string;
  muscleGroups: string[];
  unilateral?: boolean;
}

const SEED_DEFINITIONS: SeedExerciseDefinition[] = [
  {
    canonicalName: 'Back Squat',
    movementPattern: 'squat',
    muscleGroups: ['quadriceps', 'glutes'],
  },
  {
    canonicalName: 'Front Squat',
    movementPattern: 'squat',
    muscleGroups: ['quadriceps', 'core'],
  },
  {
    canonicalName: 'Deadlift',
    movementPattern: 'hinge',
    muscleGroups: ['hamstrings', 'glutes', 'back'],
  },
  {
    canonicalName: 'Romanian Deadlift',
    movementPattern: 'hinge',
    muscleGroups: ['hamstrings', 'glutes'],
  },
  {
    canonicalName: 'Bench Press',
    movementPattern: 'horizontal push',
    muscleGroups: ['chest', 'triceps', 'shoulders'],
  },
  {
    canonicalName: 'Overhead Press',
    movementPattern: 'vertical push',
    muscleGroups: ['shoulders', 'triceps'],
  },
  {
    canonicalName: 'Barbell Row',
    movementPattern: 'horizontal pull',
    muscleGroups: ['back', 'biceps'],
  },
  {
    canonicalName: 'Pull-Up',
    movementPattern: 'vertical pull',
    muscleGroups: ['back', 'biceps'],
  },
  {
    canonicalName: 'Hip Thrust',
    movementPattern: 'hinge',
    muscleGroups: ['glutes', 'hamstrings'],
  },
  {
    canonicalName: 'Walking Lunge',
    movementPattern: 'lunge',
    muscleGroups: ['quadriceps', 'glutes'],
    unilateral: true,
  },
  {
    canonicalName: 'Plank',
    movementPattern: 'core',
    muscleGroups: ['core'],
  },
  {
    canonicalName: 'Bicep Curl',
    movementPattern: 'isolation',
    muscleGroups: ['biceps'],
  },
];

/**
 * Builds a fresh seed catalogue — one call per install/reset, with new
 * `crypto.randomUUID()`-derived ids each time (`newExerciseId()`), per
 * ADR-0005's own note that seed ids are not deterministic across installs
 * (`specs/001-log-a-session/research.md` §2).
 */
export function buildSeedCatalogue(): Exercise[] {
  return SEED_DEFINITIONS.map((definition) => ({
    id: newExerciseId(),
    canonicalName: definition.canonicalName,
    aliases: [],
    movementPattern: definition.movementPattern,
    muscleGroups: definition.muscleGroups,
    defaultLoadType: 'weight',
    defaultVolumeKind: 'reps',
    trackEffort: false,
    unilateral: definition.unilateral ?? false,
    discipline: 'Strength',
  }));
}
