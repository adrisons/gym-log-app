/**
 * The public domain surface (Phase 1, `specs/002-domain-and-ports`).
 *
 * FR-014 ("no synthesized/implied Exercise entry"): notice this barrel
 * exports no function that creates an `ExerciseEntry` or adds one to a
 * `Block` except by being passed an explicit, caller-supplied
 * `ExerciseEntry` value — there is no "auto-add an entry for every
 * catalogue exercise" or similar implicit-population API anywhere below.
 */

export type { Load } from './load';
export { createLoad } from './load';

export type { Volume } from './volume';
export { createVolume } from './volume';

export type { Effort } from './effort';

export type { SessionId, ExerciseId } from './ids';

export type { Set } from './set';
export { createSet } from './set';

export type { ExerciseEntry } from './exercise-entry';

export type { Block } from './block';
export { createBlock } from './block';

export type { Session } from './session';
export { createSession } from './session';

export type { Exercise, ExerciseHasHistory } from './exercise';
export {
  renameExercise,
  mergeExerciseIdentities,
  deleteExercise,
} from './exercise';

export {
  DomainError,
  InvalidSetError,
  InvalidLoadError,
  InvalidVolumeError,
  InvalidBlockError,
  ExerciseMergeError,
  ExerciseDeleteConfirmationRequiredError,
} from './errors';
