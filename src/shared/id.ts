/**
 * Identifier generation (research.md §2). `crypto.randomUUID()` — no
 * dependency; a cross-cutting utility with no business concept
 * (`docs/architecture.md`'s description of `shared/`).
 *
 * Deliberately unbranded: `shared/` may import nothing internal
 * (`docs/architecture.md`'s table — `shared` has no allowed edges at
 * all), so it cannot reference `domain/ids.ts`'s branded `SessionId`/
 * `ExerciseId` types. `src/application/logging/ids.ts` wraps this with
 * the branded casts, since `application` is allowed to import both
 * `domain` and `shared`.
 */
export function newId(): string {
  return crypto.randomUUID();
}
