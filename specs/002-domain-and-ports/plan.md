# Implementation Plan: Domain Model and Ports

**Branch**: `002-domain-and-ports` | **Date**: 2026-09-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-domain-and-ports/spec.md`

## Summary

Phase 1 (scoped): give the domain layer real types — `Exercise` (catalogue),
`Session`, `Block`, `Exercise entry`, `Set`, `Body measurement`, and the
value objects `Load`, `Volume`, `Effort` — replace the Phase-0 placeholder
`StoragePort` with the finalized interface `contracts/storage-port.md`
already specifies, update the in-memory fake to match, and cover every
domain rule (`docs/requirements.md` §3.3) with a red/green test pair. No new
technology: Phase 0 already chose TypeScript/Vitest and the layer structure;
this phase fills `src/domain/` and revises `src/application/ports/` within
that established structure. No I/O, no UI.

## Technical Context

**Language/Version**: TypeScript 5.x (strict), unchanged from Phase 0.

**Primary Dependencies**: none new. Sum types (`Load`, `Volume`) are plain
discriminated unions — no runtime validation library is introduced (no
zod/io-ts); construction goes through smart constructors/factory functions
in `src/domain/` that throw a domain error on an invalid shape (see Domain
error strategy below — thrown `DomainError` subclasses, not a `Result`
type), which is sufficient for FR-010/FR-019/FR-021's rejection rules
without adding a dependency for a concern this small.

**Storage**: none (unchanged from Phase 0 — the port is finalized here, but
only the in-memory fake implements it; real adapters are Phase 2).

**Testing**: Vitest, unchanged. Every new test lives under `test/unit/` per
the existing structure; `test/boundaries/` gains no new checks (the layer
graph itself doesn't change — `domain` still imports nothing internal).

**Target Platform**: unchanged (installable PWA).

**Project Type**: unchanged (single-codebase web application).

**Performance Goals**: none specific to this phase — pure in-memory
construction and validation, no measurable perf surface.

**Constraints**: no I/O anywhere in `src/domain/` or its tests (FR-028); no
literal persisted-format decision here beyond naming the schema-version
concern at the port level (FR-026) — migration logic stays Phase 2's job.

**Scale/Scope**: ~9 domain type modules (6 entities + 3 value objects), one
revised port interface, one revised in-memory fake, and an exhaustive
rule-level test suite (FR-010..FR-015, FR-019..FR-021, plus FR-007..FR-009
variant coverage) — no feature surface, no screens.

### Domain error strategy

`docs/requirements.md` and the constitution don't mandate a specific
rejection mechanism (exception vs. `Result` return) for domain-rule
violations — spec 002's User Story 2 says only "a thrown domain error or a
smart-constructor returning failure." This plan picks: **smart constructors
that throw a single `DomainError` subclass** (e.g. `InvalidSetError`,
`ExerciseMergeError`), mirroring `StorageError`'s existing pattern in
`src/application/errors.ts` (Phase 0 precedent — one error type per
boundary, not a `Result<T, E>` monad). Rationale: this project has already
established the thrown-typed-error convention at the application/storage
boundary; reusing it at the domain boundary keeps one error-handling idiom
across layers instead of introducing a second (`Result`) for no stated
benefit. `src/domain/errors.ts` is the new sibling to
`src/application/errors.ts`.

## Constitution Check

*GATE: must pass before Phase 0 research equivalent (none needed — see
Technical Context). Re-checked after Phase 1 design below.*

| Principle | Phase 1 (scoped) relevance | Status |
|---|---|---|
| I. Data Ownership & Recoverability | No persistence implementation here; the port names the schema-version concern (FR-026) so Phase 2 has a hook, but migration itself isn't built yet — no violation, nothing to recover yet. | PASS |
| II. Logging Is the Critical Path | No logging screen yet (spec 001). Domain types must not themselves impose latency — pure in-memory construction, no async in domain code. | PASS |
| III. BDD Before Code | This plan follows spec.md (Reviewed) → this plan → `/speckit-tasks`. Every domain rule ships as a Given/When/Then-shaped red/green test pair (FR-028), **with one stated exception**: FR-014 ("no synthesized/implied Exercise entry") is a structural-absence rule — there is no rejection case to write a red test against, since no API exists that could violate it. It is verified by a single presence/absence check instead (tasks.md T023a), not a red/green pair. Every other FR-010..FR-013/FR-019..FR-021 rule does get the full pair. Canonical schema stays discipline-neutral: `Exercise.discipline` is present but fixed to `Strength` (FR-001, canonical casing per `docs/requirements.md` §1.4), `Load`/`Volume` already generalize beyond strength per the constitution's own note. | PASS |
| IV. External Dependencies Behind Ports | `StoragePort` is finalized in domain terms (FR-023/FR-024/FR-025), no infrastructure type crosses it, and the in-memory fake is updated to match (FR-027) — every method has a fake. | PASS |
| V. Dependency-Inward Layering | `src/domain/` gains real content but still imports nothing internal (unchanged forbidden-edge table from spec 000's data-model.md). `application/ports/storage-port.ts` imports only from `domain/`. No presentation surface touched. | PASS |
| VI. Deterministic, Traceable Insights | Not applicable — §5 computation rules are this spec's explicit Non-Goal. | PASS (n/a) |
| Escalation — concrete technology choices | No new technology introduced (see Technical Context) — nothing to escalate. | PASS (n/a) |

No violations. Complexity Tracking table is empty.

## Project Structure

### Documentation (this feature)

```text
specs/002-domain-and-ports/
├── plan.md                    # This file
├── data-model.md              # Phase 1 output — entity/value-object shapes
├── quickstart.md              # How to verify this phase is done
├── contracts/
│   └── storage-port.md        # Already written (review-resolution round)
└── checklists/
    └── requirements.md        # Spec quality checklist (already present)
```

### Source Code (repository root)

```text
src/
├── domain/
│   ├── exercise.ts            # FR-001, FR-016: Exercise catalogue entity
│   ├── session.ts             # FR-002: Session entity
│   ├── block.ts                # FR-003: Block entity
│   ├── exercise-entry.ts      # FR-004: Exercise entry entity
│   ├── set.ts                  # FR-005, FR-010: Set entity + no-empty-set rule
│   ├── body-measurement.ts    # FR-006, FR-021: Body measurement entity
│   ├── load.ts                  # FR-007: Load value object (sum type)
│   ├── volume.ts                # FR-008: Volume value object (sum type)
│   ├── effort.ts                # FR-009, FR-022: Effort value object
│   ├── ids.ts                    # branded SessionId/ExerciseId opaque types
│   ├── errors.ts                # DomainError and subclasses (see Domain error strategy)
│   └── index.ts                 # barrel — public domain surface
├── application/
│   ├── ports/
│   │   └── storage-port.ts    # FR-023..FR-026: finalized per contracts/storage-port.md
│   └── index.ts                # unchanged barrel
└── (infrastructure/, presentation/ untouched by this phase)

test/
├── support/
│   └── in-memory-storage.ts   # FR-027: revised fake, matches finalized StoragePort
└── unit/
    ├── domain/
    │   ├── exercise.test.ts          # FR-011, FR-012 (Exercise-local half), FR-013, FR-019, FR-020, FR-016
    │   ├── session-block-entry.test.ts # FR-002, FR-003, FR-004, FR-014, FR-017, FR-018
    │   ├── set.test.ts                # FR-005, FR-010, FR-022
    │   ├── body-measurement.test.ts   # FR-006, FR-021
    │   ├── load.test.ts               # FR-007, FR-015
    │   ├── volume.test.ts             # FR-008, FR-015
    │   └── effort.test.ts             # FR-009, FR-022
    └── storage-port-fake.test.ts      # FR-023..FR-027, incl. FR-012's cross-session reassignment half (SC-005)
```

**Structure Decision**: extends spec 000's established five-layer tree — no
new top-level directory, no new test category. `src/domain/` moves from its
Phase 0 `.gitkeep` placeholder to real content; `test/unit/domain/` is a new
subdirectory grouping this phase's rule-level tests, kept separate from
`test/unit/storage-port-fake.test.ts` and `test/unit/tokens.test.ts` (Phase
0's existing flat `test/unit/` files) so the domain-rule suite reads as one
group per SC-002's traceability requirement.

## Complexity Tracking

No constitution violations — table intentionally empty.
