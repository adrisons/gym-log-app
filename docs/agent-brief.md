# Agent brief: build order

This document defines **the order in which the application is built** and the
scaffolding that must exist before product code. It does not restate process
or quality rules — those are in `.specify/memory/constitution.md` (the
Definition of Done, the layering and ports principles, and the escalation
list all live there) and in `AGENTS.md` (reading order, spec-kit flow).

Read alongside `docs/requirements.md` (what the app does), `docs/design.md`
(how it looks), `docs/development-principles.md` (how it is built), and the
ADRs under `docs/decisions/` (why it is the way it is).

---

## 1. Before the first line of product code

Build the documentation scaffolding — one ADR already exists per closed
decision (`docs/decisions/ADR-0001..0004`). All three scaffolding docs below
now exist, written by Phase 0 (`specs/000-scaffolding/`):

- `docs/stack.md`: one tool per concern (PWA framework, state, the two
  storage adapters, charts, navigation, tests, lint, formatting) plus an
  explicit list of what may not be added without an ADR. Written by
  `/speckit-plan` for Phase 0 — the framework and adapter libraries were
  chosen there, not assumed here, and confirmed with the project owner
  first (`AGENTS.md`).
- `docs/architecture.md`: the layer map and the dependency-inward rule
  (constitution Principle V), mechanically enforced
  (`eslint-plugin-boundaries`, `test/boundaries/edge-set.test.ts`).
- `docs/testing.md`: the pyramid, shared doubles, how a test is written here.

`docs/design.md`, `docs/requirements.md` and `docs/development-principles.md`
already existed before Phase 0 and were not recreated by it. `README.md`
covers setup and usage and is kept separate from the above.

**Do not write product code until the CI gate exists** (typecheck + tests +
lint) and the layer-boundary rule genuinely fails on an illegal import.
Verify it with a deliberate illegal import that must break the build, and
check the barrel-import path too.

---

## 2. Layers

The full rule is constitution Principle V and `docs/development-principles.md`;
ADR-0002 covers how it applies to the storage port. Shape, for reference:

```
src/
  domain/          entities, value objects, pure rules (no I/O, no framework)
  application/     ports, use cases, session state, view models, error policy
  infrastructure/  storage adapters (File System Access, IndexedDB), platform APIs
  presentation/    screens and UI; consumes view models
    design/        tokens, primitives, compositions, root
  shared/          cross-cutting utilities with no business concept
```

Both storage adapters are tested against one shared contract test suite; an
in-memory fake of the same port is the test-only implementation used
everywhere else. A single composition point wires infrastructure to the
application, including the runtime choice of storage adapter (ADR-0002).

---

## 3. Order of work

Each phase ends with typecheck, tests and lint green, and with the affected
documentation updated. Do not start a phase before closing the previous one.
Phases map onto the MVP / v1 / v1.1 scope in `docs/requirements.md` §9.

### Phase 0 — Scaffolding

Repository, stack (via `/speckit-plan`), design tokens (light and dark), CI
gate, boundary rules, shared test doubles including the in-memory
storage-port fake, integration harness. No screens.

**Deliverable:** an empty app that launches, with a smoke test and a red
build on a layer violation.

### Phase 1 — Domain and ports

Entities, value objects (Load, Volume, Effort), the rules in
`docs/requirements.md` §3.3 and every computation in §5, with exhaustive unit
tests. Ports defined and in-memory fakes working. No real I/O, no UI.

**Deliverable:** complete business rules, tested without touching disk.

### Phase 2 — Persistence

Port implementations, schema version, migrate/refuse behaviour, launch
reconciliation and regeneration of derived data. Integration tests against
real storage, including a simulated migration.

### Phase 3 — Logging (FR-1 to FR-5) — MVP

The critical path first. Optimistic UI, deferred persistence, undo, numeric
keypad, duplicate-previous-set. Measure and record the number of taps needed
to log a set.

### Phase 4 — Diary, search and progression (FR-6 to FR-8) — MVP

Derived, rebuildable search index. Chart with metric and range selectors.
Honest degradation for non-numeric loads. Closes the MVP loop.

### Phase 5 — Insights (FR-9) — v1

Deterministic rules from `docs/requirements.md` §5 only, with their
sufficiency thresholds (§5.7). Every card type ships tests covering the case
with data, the case just below the threshold, and the case with no data.
Incremental recomputation, off the interaction path.

### Phase 6 — Body composition (FR-10) — v1

Logging, derived kg values, charts with moving average. Neutral tone: no
targets, no alarms.

### Phase 7 — Settings, data, closing (FR-11, FR-12) — v1

Export and import with preview and rejection of newer schema versions. Full
accessibility audit against `docs/requirements.md` §7.4. Performance measured
against §7.1, before and after any optimisation.

### Phase 8 — Templates (FR-13) — v1.1

Session templates, kept off the logging critical path (D7).
