/**
 * Opaque, branded identifier types (`docs/requirements.md` §3.1; spec 002
 * data-model.md "Identifiers").
 *
 * Branded so a `SessionId` and an `ExerciseId` are not silently
 * interchangeable, even though both are string-shaped at runtime. The
 * exact generation strategy (whatever a chosen storage adapter's natural
 * key format is) is Phase 2 (Persistence)'s concern, not this layer's.
 */

export type SessionId = string & { readonly __brand: 'SessionId' };
export type ExerciseId = string & { readonly __brand: 'ExerciseId' };
