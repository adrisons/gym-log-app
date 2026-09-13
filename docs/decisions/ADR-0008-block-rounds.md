# ADR-0008: A block can carry a target round count

**Date:** 2026-09-13
**Status:** Accepted

## Context

A `Block` groups exercise entries (straight sets / superset / circuit —
`docs/requirements.md` §3.1) but had no way to record a very common piece
of a circuit or superset plan: "3 rounds of this". The only per-block
count already visible is derived — total sets logged across its exercise
entries (`BlockCard`'s subtitle) — which describes what *has been done*,
not what the block is *meant to be repeated* as a whole.

Adding a persisted field to `Block` is a schema change under
`docs/requirements.md` §6 (version bump, ADR, migration) — this is that
ADR.

## Decision

Add one optional field:

```ts
interface Block {
  name?: string;
  type: 'straightSets' | 'superset' | 'circuit';
  rounds?: number; // positive integer; unset means "not specified"
  exercises: ExerciseEntry[];
}
```

`rounds` is a plain target count the user sets on the block itself — it is
never computed from, and never constrains, how many sets each exercise
entry in the block actually has. A block with `rounds: 3` and an exercise
entry holding 5 logged sets is not a contradiction to reconcile; the two
numbers answer different questions ("how many times was this circuit meant
to go round" vs. "how many sets did I record for this one exercise").
Nothing in the domain or storage layer ever derives one from the other.

Editing it follows FR-1/ADR-0007's existing rule for this screen: no
confirm step. A change commits immediately, the same as renaming a block
already does after its edit is submitted.

Considered and rejected:

- **Per-exercise-entry rounds instead of per-block.** A circuit's rounds
  apply to the whole rotation, not to one exercise in isolation — putting
  it on `ExerciseEntry` would need every entry in the same block kept in
  sync by hand, or silently allow entries in the same circuit to disagree
  about how many rounds it is, which doesn't correspond to how a circuit
  is actually planned or performed.
- **Deriving a "rounds" display from the exercise entries' own set
  counts**, and not persisting anything new. Rejected because the target
  (planned) round count and the sets actually logged per exercise are
  genuinely different pieces of information — a straight-sets block with
  three exercises each holding 4 sets was never "4 rounds" of anything,
  and a circuit planned for 3 rounds where the user only got through 2
  needs the plan (3) to stay visible independent of what got logged.

## Consequences

- `domain/block.ts`'s `createBlock` gains `rounds` validation: when
  present, must be a positive integer (`InvalidBlockError` otherwise,
  mirroring `createLoad`'s bound-checking convention); absent is always
  valid — an empty draft block, or one nobody has set a round count on,
  is not an error.
- `application/ports/logging-draft.ts`'s `DraftBlock` and
  `application/logging/draft.ts` gain the same field and a
  `setBlockRounds` action, mirroring `renameBlock` exactly.
- `presentation/logging/block-card.tsx` gains an inline, always-editable
  numeric field for it (no separate edit-mode toggle needed — unlike the
  name field, a single always-visible number input doesn't compete for
  the same visual space as the block's title).
- Schema version bumps from 2 to 3. The migration is trivial and needs no
  data rewrite: `rounds` is optional everywhere it's read
  (`draftToSession`, `BlockCard`, progression/insights, which don't
  consume it at all in v1), so a pre-existing `Block` simply has no
  `rounds` — which is exactly the correct "not specified" state, not a
  gap that needs backfilling with an invented default (unlike ADR-0006's
  `defaultVolumeKind`/`trackEffort`, which needed a real default because
  those fields are read unconditionally). Both real adapters
  (`IndexedDbStorageAdapter`, `FileSystemStorageAdapter`) still run their
  existing migration step for anything below v3 and then record the
  stored version as v3 — there is no new per-record rewrite to add.
- No computation in §5 reads `rounds` in v1 — it is a plan the user records
  for their own reference, not an input to e1RM/progression/insights.
