# Contract: `StoragePort` extension (Phase 1 → this phase)

Extends, does not replace, `specs/002-domain-and-ports/contracts/storage-port.md`
("finalized" there in the sense of the canonical-entity method set —
`saveSession`/`getExercise`/etc. are unchanged by this document). Two
additions, both already anticipated by spec 002's own text:

1. `LoggingDraft` gets its real shape (spec 002's contract: "the draft's
   real shape... is spec 001's own design job" — `data-model.md` above).
2. Two new methods for band labels (research.md §7) — new, not anticipated
   by name in spec 002, but the same kind of narrow, non-canonical surface
   as the draft methods.

The five contract rules from spec 002's document (vocabulary, types,
location, async, failure-as-`StorageError`) carry over unchanged and are
not repeated here.

## 1. `LoggingDraft` — real shape replaces the placeholder

```ts
// src/application/ports/storage-port.ts — was:
export interface LoggingDraft {
  id: string;
  [key: string]: unknown;
}
// becomes: the interface in data-model.md ("LoggingDraft"), imported from
// src/application/logging/draft.ts, re-exported (not redefined) here so
// the port and the application layer share one source of truth for the
// shape. (`application/ports` → `application` is a same-layer import per
// `docs/architecture.md`'s table — both classify as `application`.)
```

`saveDraft`/`getDraft`/`discardDraft` signatures are unchanged — only the
`LoggingDraft` type they reference gains real fields.

### Consequence for `test/support/in-memory-storage.ts`

The three `#referencesExercise`/`#repointDraftExerciseId`/`#pruneDraftExerciseId`
helpers (currently a flat `draft['exerciseId']` convention, explicitly
flagged as a placeholder by spec 002's own comment) are replaced with real
tree walks:

- `#referencesExercise`: `true` if any `DraftExerciseEntry.exerciseId` in
  any block equals the given id.
- `#repointDraftExerciseId` (merge): maps every matching
  `DraftExerciseEntry.exerciseId` from loser to survivor. Per spec.md's
  clarification ("The draft's exercise entry is rewritten in place: on
  merge it now points at the survivor"), sets already recorded on that
  entry are **kept** — only the `exerciseId` reference changes.
- `#pruneDraftExerciseId` (cascade delete): removes every
  `DraftExerciseEntry` (and its sets) whose `exerciseId` matches, from
  every block. Per spec.md ("on delete... the draft entry and its
  in-progress sets are removed too"). A block that becomes empty as a
  result stays in the draft as an empty block (FR-017's "zero blocks/entries
  is valid" applies to the draft too, not only a submitted `Session`) — it
  is not itself removed by this prune.

### Verification

`test/unit/storage-port-fake.test.ts` (spec 002's existing file) gains
cases exercising `mergeExercises`/`deleteExerciseCascade` against a
draft with nested blocks/entries/sets — replacing reliance on the flat
placeholder test, per `contracts/storage-port.md`'s explicit instruction
that spec 001 "MUST replace this logic and re-verify."

## 2. Band labels

```ts
export interface StoragePort {
  // ...existing methods unchanged...

  /**
   * The user's own reorderable list of Band load labels (spec 001 FR-011).
   * Not a canonical entity (`docs/requirements.md` §3) — see research.md
   * §7 for why this does not trigger the schema-version bump rule
   * (constitution Principle III). Order is significant and is exactly the
   * order the caller passed to the last `saveBandLabels` call; there is no
   * separate sort step.
   */
  listBandLabels(): Promise<string[]>;
  saveBandLabels(labels: string[]): Promise<void>;
}
```

`InMemoryStorage` adds `#bandLabels: string[] = []`; `reset()` clears it
to `[]` alongside its existing fields.

### Verification

`test/unit/storage-port-fake.test.ts` gains a round-trip case
(`saveBandLabels` → `listBandLabels` returns the same order) and confirms
`reset()` clears it.

## Not part of this extension

- No change to `getSchemaVersion`/`setSchemaVersion` — band labels and the
  draft are both explicitly outside the canonical-schema-version concern
  (research.md §7; spec 002's contract, same reasoning for the draft).
- No new `StoragePort` methods for the free-text-load autocomplete
  (FR-012) — research.md §8, derived on read from existing `Session` data,
  no new persisted surface.
- No real `infrastructure/` implementation of any of the above — research.md
  §1. Only `InMemoryStorage` implements this extended interface in this
  plan's scope.
