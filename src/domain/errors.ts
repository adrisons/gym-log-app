/**
 * Domain-layer error types (Phase 1, `specs/002-domain-and-ports`).
 *
 * Mirrors `src/application/errors.ts`'s pattern: one thrown, named `Error`
 * subclass per rejection rule, not a `Result<T, E>` monad (plan.md "Domain
 * error strategy"). Every domain-rule violation in `docs/requirements.md`
 * §3.3 that a smart constructor or domain function can reject throws one of
 * these.
 */

/** Base class for every domain-rule violation. Never thrown directly. */
export abstract class DomainError extends Error {}

/**
 * A `Set` was constructed with neither a `Volume` nor a `Load` other than
 * `{ kind: 'none' }` (`docs/requirements.md` §3.3; FR-010).
 */
export class InvalidSetError extends DomainError {
  override readonly name = 'InvalidSetError';
}

/**
 * A `Load`'s `bodyweight` variant was constructed with an
 * `addedOrAssistedKg` outside the -300..+300 range (FR-007, spec 001
 * FR-014 precedent).
 */
export class InvalidLoadError extends DomainError {
  override readonly name = 'InvalidLoadError';
}

/**
 * A `Volume`'s `reps` variant was constructed with a non-integer `count`
 * (FR-008: "Reps (integer)").
 */
export class InvalidVolumeError extends DomainError {
  override readonly name = 'InvalidVolumeError';
}

/**
 * `mergeExerciseIdentities` was called with the same identifier as
 * survivor and loser, or with an identifier that does not resolve to an
 * existing `Exercise` (FR-019).
 */
export class ExerciseMergeError extends DomainError {
  override readonly name = 'ExerciseMergeError';
}

/**
 * `deleteExercise` was called, without confirmation, on an `Exercise` that
 * has logged history (FR-013). The caller should offer merging as the
 * alternative — this error's type alone is the signal; no separate
 * message/payload contract is needed (tasks.md T021).
 */
export class ExerciseDeleteConfirmationRequiredError extends DomainError {
  override readonly name = 'ExerciseDeleteConfirmationRequiredError';
}
