# Phase 1 Data Model

Concrete TypeScript shapes for `docs/requirements.md` §3.1/§3.2, realizing
spec.md's FR-001..FR-022. Discriminant field name for every sum type is
`kind`, consistent across `Load`/`Volume` (this project's existing ADRs use
"sum type" language without prescribing a field name — this plan picks one
name and uses it everywhere for consistency, per spec.md's Assumptions).

## Value objects

### `Load` (FR-007)

```ts
type Load =
  | { kind: 'weight'; value: number; unit: 'kg' | 'lb' }
  | { kind: 'band'; label: string; estimatedResistanceKg?: number }
  | { kind: 'bodyweight'; addedOrAssistedKg?: number } // signed, -300..+300, 0/undefined = bodyweight only
  | { kind: 'freeText'; text: string }
  | { kind: 'none' };
```

- `weight.value` and `bodyweight.addedOrAssistedKg` are stored exactly as
  entered (FR-015) — no kg/lb conversion here.
- `bodyweight.addedOrAssistedKg` range: -300..+300, reusing spec 001 FR-014's
  precedent (Edge Cases). A value outside this range is rejected by the
  smart constructor.

### `Volume` (FR-008)

```ts
type Volume =
  | { kind: 'reps'; count: number }
  | { kind: 'duration'; seconds: number }
  | { kind: 'distance'; metres: number };
```

All three fields are stored exactly as entered (FR-015).

### `Effort` (FR-009, FR-022)

```ts
type Effort = 1 | 2 | 3 | 4 | 5;
```

A plain integer literal union — never wrapped, never a "none" variant.
Optionality lives one level up, on `Set.effort?: Effort`.

## Entities

### `Exercise` (catalogue) (FR-001, FR-016)

```ts
interface Exercise {
  id: ExerciseId;
  canonicalName: string;
  aliases: string[];
  movementPattern: string;
  muscleGroups: string[];
  defaultLoadType: Load['kind'];
  unilateral: boolean;
  discipline: 'strength'; // fixed in v1; FR-001 — present so a future value is additive
}
```

No field distinguishes a seed-provided entry (FR-016) — a seed entry is
just an `Exercise` constructed by the app at first launch, indistinguishable
from one the user later creates.

### `Session` (FR-002)

```ts
interface Session {
  id: SessionId;
  dateTime: string; // ISO 8601, fixed at creation (spec 001 FR-001)
  blocks: Block[]; // ordered; order = list position (FR-018); [] is valid (FR-017)
  notes: string;
  overallFeeling?: Effort;
  durationSeconds?: number;
}
```

No open/closed lifecycle field (FR-002).

### `Block` (FR-003)

```ts
interface Block {
  name?: string;
  type: 'straightSets' | 'superset' | 'circuit';
  exercises: ExerciseEntry[]; // ordered; [] is valid (FR-017)
}
```

### `Exercise entry` (FR-004)

```ts
interface ExerciseEntry {
  exerciseId: ExerciseId; // reference by id, never by name (FR-011)
  notes: string;
  sets: Set[]; // ordered; order = list position (FR-018)
}
```

No separate `order` field (FR-018) — an entry's position within
`Block.exercises` (and a set's position within `ExerciseEntry.sets`) is the
only record of order.

### `Set` (FR-005, FR-010, FR-022)

```ts
interface Set {
  volume?: Volume;
  load: Load; // use `{ kind: 'none' }`, never `undefined`, when load doesn't apply
  effort?: Effort; // optionality here, not on Effort itself (FR-022)
  setKind: 'warmUp' | 'working' | 'toFailure';
  completed: boolean;
}
```

Construction rule (FR-010): rejected when `volume` is absent **and**
`load.kind === 'none'`. The smart constructor `createSet(...)` throws
`InvalidSetError` in that case; both are covered by test pairs (FR-028).

### `Body measurement` (FR-006, FR-021)

```ts
interface BodyMeasurement {
  date: string; // ISO 8601 date
  bodyWeightKg: number; // required — construction rejected without it (FR-021)
  fatPercentage?: number;
  musclePercentageOrMassKg?: number;
  notes: string;
}
```

Independent of any `Session` (Key Entities, spec.md).

## Identifiers

`SessionId` and `ExerciseId` remain opaque string-shaped types at this
layer (spec.md Assumptions) — generation strategy is Phase 2's concern:

```ts
type SessionId = string & { readonly __brand: 'SessionId' };
type ExerciseId = string & { readonly __brand: 'ExerciseId' };
```

(Branded types, not bare `string` aliases, so a `SessionId` and an
`ExerciseId` are not silently interchangeable — a small, free type-safety
win with no runtime cost, decided here rather than left ambiguous for
`/speckit-tasks`.)

## Domain errors (`src/domain/errors.ts`)

```ts
abstract class DomainError extends Error {}

class InvalidSetError extends DomainError {} // FR-010
class InvalidBodyMeasurementError extends DomainError {} // FR-021
class ExerciseMergeError extends DomainError {} // FR-019: same/nonexistent id
class ExerciseDeleteConfirmationRequiredError extends DomainError {} // FR-013
```

One subclass per rejection rule that needs to be distinguished by callers;
mirrors `StorageError`'s existing single-error-type-per-boundary pattern in
`src/application/errors.ts`.

## Storage port

Unchanged from `contracts/storage-port.md` — this data model file does not
duplicate it; see that contract for the full `StoragePort` interface
(FR-023..FR-026), which is expressed entirely in terms of the entity and
value-object shapes defined above.
