# Feature Specification: Project Scaffolding (Phase 0)

**Feature Branch**: `000-scaffolding`

**Created**: 2026-09-10

**Status**: Draft

**Targets build phase**: Phase 0 — precedes MVP (`docs/requirements.md` §9;
`docs/agent-brief.md` §3 Phase 0)

**Input**: User description: "The Phase 0 deliverable from docs/agent-brief.md §1 and §3 — the documentation scaffolding and the CI/quality gate that MUST exist before any product code. Not a user-facing feature; its users are the developers and agents building the project, and its acceptance criteria are verifiable properties of the repository."

## Context *(mandatory)*

`docs/agent-brief.md` §1 forbids writing product code until the
documentation scaffolding and a working CI gate exist, and §3 makes Phase 0
its own phase with a concrete deliverable: "an empty app that launches, with
a smoke test and a red build on a layer violation." This spec captures that
deliverable as verifiable requirements so it goes through the same
spec → plan → tasks → implement discipline as every other phase
(`AGENTS.md`; constitution, Development Workflow), rather than being
improvised. It produces three governing documents that do not yet exist
(`docs/stack.md`, `docs/architecture.md`, `docs/testing.md`), a CI pipeline
that enforces the constitution's Definition of Done, a mechanically enforced
layer-boundary rule, the shared test doubles every later phase builds on
(including the in-memory fake of the storage port from ADR-0002), and the
light/dark design-token set the constitution requires "from day one"
(Principle V). It deliberately chooses no concrete tool — that is the job of
the `/speckit-plan` that follows this spec, confirmed with the project owner
before it lands (`AGENTS.md`; constitution, Escalation).

## User Scenarios & Testing *(mandatory)*

The "user" here is a developer or agent working in this repository. Each
story is an independently valuable, independently verifiable slice of the
Phase 0 deliverable.

### User Story 1 - Trust the quality gate (Priority: P1)

A developer opens a pull request. Before any human looks at it, an automated
gate runs the type checker, the test suite, and the linter, and blocks the
change if any of the three fails. A green gate means the Definition of Done's
mechanical checks are satisfied; the developer does not have to remember to
run them by hand.

**Why this priority**: `docs/agent-brief.md` §1 — "Do not write product code
until the CI gate exists." Every later phase depends on this gate being
real. Without it there is no floor under any subsequent change.

**Independent Test**: with nothing else built, introduce a deliberate type
error on a branch, open a PR, and confirm the gate reports failure and
blocks merge; remove the error and confirm the gate passes. Repeat for a
failing test and for a lint violation.

**Acceptance Scenarios**:

1. **Given** a branch whose code type-checks, tests, and lints cleanly,
   **When** CI runs, **Then** all three checks report success and the change
   is mergeable.
2. **Given** a branch with a type error, **When** CI runs, **Then** the
   typecheck check fails, the overall gate is red, and the change cannot be
   merged.
3. **Given** a branch with one failing test, **When** CI runs, **Then** the
   test check fails and the gate is red.
4. **Given** a branch with a lint violation, **When** CI runs, **Then** the
   lint check fails and the gate is red.
5. **Given** the same branch, **When** a developer runs the checks locally,
   **Then** the local commands and their pass/fail outcome match what CI
   reports (no "passes locally, fails in CI" gap for these three checks).

---

### User Story 2 - Layer violations break the build (Priority: P1)

A developer writes an import that crosses a layer boundary the wrong way —
for example a `presentation` module importing a persistence type, or a
`domain` module importing from `application`. The build fails and names the
offending import. The developer cannot land the violation, whether it is a
direct import or routed through a barrel/index file.

**Why this priority**: constitution Principle V and
`docs/development-principles.md` §3 are the structural backbone of the whole
codebase. `docs/agent-brief.md` §1 requires this rule to "genuinely fail the
build," verified with a deliberate illegal import — a rule that is only
documented is not a rule.

**Independent Test**: add a deliberate illegal import in each direction the
layer map forbids, once directly and once via a barrel file, and confirm the
build fails each time with a message identifying the boundary crossed;
remove them and confirm the build passes.

**Acceptance Scenarios**:

1. **Given** the layer map in `docs/architecture.md`, **When** a
   `presentation` module imports an `infrastructure` or persistence type,
   **Then** the build fails and the error identifies the illegal import.
2. **Given** a `domain` module that imports from `application` or
   `infrastructure`, **When** the build runs, **Then** it fails for the same
   reason.
3. **Given** an illegal import routed through a barrel/index file rather than
   a direct path, **When** the build runs, **Then** it still fails — the
   barrel path does not bypass the rule.
4. **Given** a legal import (a layer importing only from a layer further in,
   through a port where a boundary is crossed), **When** the build runs,
   **Then** it passes.
5. **Given** the enforced rule, **When** a developer reads
   `docs/architecture.md`, **Then** the documented layer map and the
   mechanically enforced rule are the same rule — no drift between prose and
   configuration.

---

### User Story 3 - Build on the shared test doubles (Priority: P1)

A developer writing a test for a later phase needs to exercise a use case
without touching disk. They import the in-memory fake of the storage port
(the one port already fixed by ADR-0002) and the other shared doubles from a
single known location, and use the integration-test harness for tests that
wire several pieces together. They do not each invent their own fake.

**Why this priority**: `docs/agent-brief.md` §2–§3 and constitution
Principle IV — "Every port MUST also have an in-memory fake usable in
tests." Phases 1–3 are written against these doubles; they have to exist and
be shared before that work starts.

**Independent Test**: with no domain code yet, write a throwaway test that
imports the in-memory storage-port fake, stores and reads back a placeholder
value through the port interface, and runs green under the project's test
runner; run a second throwaway test through the integration harness.

**Acceptance Scenarios**:

1. **Given** the storage port interface from ADR-0002, **When** a test
   imports the in-memory fake, **Then** the fake satisfies that interface
   and needs no real File System Access API or IndexedDB.
2. **Given** the shared doubles, **When** a developer looks for them,
   **Then** they are in one documented location, not scattered or
   duplicated per test file.
3. **Given** the integration-test harness, **When** a developer writes an
   integration test, **Then** the harness provides the standard wiring
   (composition point with fakes substituted) without each test rebuilding
   it.
4. **Given** `docs/testing.md`, **When** a developer reads it, **Then** it
   states the test pyramid, names the shared doubles and where they live,
   and shows how a test is written in this project.

---

### User Story 4 - The stack is decided and bounded (Priority: P1)

A developer or agent needs to know which tool this project uses for a given
concern — the PWA framework, state management, each of the two storage
adapters, charts, navigation, the test runner, lint, formatting — and,
equally, what may not be added without a recorded decision. They read one
document and get an unambiguous answer.

**Why this priority**: `docs/agent-brief.md` §1 lists `docs/stack.md` as a
required Phase 0 artifact. Constitution "one dependency per concern" and the
Escalation list depend on there being a single written record of what is
already chosen, so a second tool for a covered concern is visibly an
escalation.

**Independent Test**: for every concern in the list, `docs/stack.md` names
exactly one tool and no concern is left blank; the document also carries an
explicit "not without an ADR" list. A reviewer can check both properties by
reading the file.

**Acceptance Scenarios**:

1. **Given** the concern list (PWA framework, state, storage adapter A,
   storage adapter B, charts, navigation, test runner, lint, formatting),
   **When** a developer reads `docs/stack.md`, **Then** each concern names
   exactly one tool — none missing, none with two.
2. **Given** `docs/stack.md`, **When** a developer looks for the boundary,
   **Then** it contains an explicit list of what may not be added without an
   ADR.
3. **Given** ADR-0002 (one storage port, two adapters — File System Access
   API and IndexedDB), **When** a developer reads the storage section of
   `docs/stack.md`, **Then** it is consistent with ADR-0002 and does not
   contradict it.
4. **Given** the constitution's rule that concrete technology choices are
   confirmed with the project owner, **When** `docs/stack.md` is filled in,
   **Then** the choices it records were confirmed with the owner before
   landing (recorded in the `/speckit-plan` for this spec).

---

### User Story 5 - The empty app launches (Priority: P2)

A developer clones the repository, installs dependencies, and runs the app.
It starts and shows a placeholder — no real screens, no domain logic — and a
smoke test confirms it comes up. This is the skeleton that Phase 3's logging
screen will later be built into.

**Why this priority**: `docs/agent-brief.md` §3 Phase 0 deliverable — "an
empty app that launches, with a smoke test." Needed so Phase 3 has
somewhere to attach UI, but nothing in Phases 1–2 depends on the app
launching, so it ranks below the gate, the boundary rule, and the doubles.

**Independent Test**: from a clean clone, run the documented setup and start
commands and confirm the app serves a placeholder; run the smoke test and
confirm it passes.

**Acceptance Scenarios**:

1. **Given** a clean clone and the `README.md` setup steps, **When** a
   developer runs the start command, **Then** the app launches and serves a
   placeholder view with no error.
2. **Given** the running app, **When** the smoke test runs, **Then** it
   confirms the app renders its entry point and passes.
3. **Given** the placeholder app, **When** a developer inspects it, **Then**
   it contains no domain entity, no persistence call, and no logging screen
   — only the shell.
4. **Given** the design-token module, **When** the placeholder renders in a
   light-theme and a dark-theme context, **Then** it takes its visual
   values from the tokens in both, with no literal colour at the use site
   (constitution Principle V; `docs/development-principles.md` §5).

---

### Edge Cases

- **CI gate on the default branch itself**: the gate runs on pull requests
  into the default branch; a push directly to the default branch that
  bypasses a PR is out of normal flow, but the gate configuration should
  still run on the default branch so a bypass is caught after the fact.
- **A check tool is missing or misconfigured in CI** (e.g. the linter is not
  installed on the runner): this is a red gate, not a silently-skipped
  check — an absent check is treated as a failing check.
- **The boundary rule has a gap** (a forbidden import path it does not
  catch): the Phase 0 verification deliberately tries each forbidden
  direction, direct and via a barrel, precisely to find such a gap before
  product code relies on the rule.
- **`shared` layer imports**: `shared` holds cross-cutting utilities with no
  business concept (`docs/agent-brief.md` §2); the boundary rule must define
  what `shared` may import (nothing from `domain`, `application`,
  `infrastructure`, or `presentation`) so it cannot become a backdoor
  between layers.
- **A concern in `docs/stack.md` legitimately needs no tool** (e.g. the
  project decides navigation is handled without a dedicated library): the
  entry is still explicit — "none, handled by X" — never blank.
- **Design tokens exist but a value is undecided**: a token may carry a
  provisional value, but every token in the set is named and present; a
  missing token, not a provisional value, is the failure.
- **`docs/architecture.md` and the enforced rule drift apart later**: any
  change to the layer map updates both the document and the enforcement
  configuration in the same change (constitution, Definition of Done —
  "documentation describing the change is updated in the same change").

## Non-Goals *(mandatory)*

- **Choosing the concrete tools.** This spec requires that `docs/stack.md`
  exist and be complete and bounded; which framework, state library,
  adapter library, chart library, test runner, linter, or formatter it
  names is decided in the `/speckit-plan` that follows, and confirmed with
  the project owner first (`AGENTS.md`; constitution, Escalation). No tool,
  framework, or vendor name belongs in this spec.
- **Any domain entity, value object, or rule.** Session, Block, Set, Load,
  Volume, Effort and the computation rules (`docs/requirements.md` §3, §5)
  are Phase 1. Phase 0 defines the port interface shape only insofar as
  ADR-0002 already fixes it, and builds its in-memory fake — no real domain
  logic.
- **Any real storage adapter.** The File System Access API and IndexedDB
  adapters, the schema version, and migrate/refuse behaviour are Phase 2.
  Phase 0 delivers only the in-memory fake and the shared contract's
  test scaffolding.
- **Any screen or UI beyond a placeholder.** The logging screen and every
  other screen are Phase 3+. Phase 0's app is an empty shell.
- **The seed catalogue contents.** ADR-0005's seed exercise list is a later
  phase; nothing about it is built here.
- **Recreating existing docs.** `docs/design.md`, `docs/requirements.md`,
  `docs/development-principles.md`, `docs/agent-brief.md`, and the
  constitution already exist and are authoritative; Phase 0 adds three new
  docs and does not rewrite these.
- **Full accessibility, performance, and offline audits.** Those are done
  against `docs/requirements.md` §7 in later phases (§7.4 audit in Phase 7).
  Phase 0 only establishes that design tokens and light/dark theming exist.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The repository MUST provide a CI pipeline that runs, on every
  pull request, a type check, the test suite, and a lint check, and reports
  a combined failure if any of the three fails.
- **FR-002**: A pull request whose combined gate is failing MUST NOT be
  mergeable into the default branch; a passing gate is a precondition for
  merge.
- **FR-003**: The type check, test, and lint commands MUST be runnable
  locally with the same result they produce in CI, and MUST be documented
  (in `README.md` or a doc it links) so a developer can run them without
  reading the CI configuration.
- **FR-004**: A missing or misconfigured check tool in CI MUST surface as a
  failing gate, never as a skipped or silently-passing check.
- **FR-005**: The repository MUST enforce the dependency-inward layer rule
  (constitution Principle V; `docs/development-principles.md` §3)
  mechanically, such that an import from an outer layer into code that
  should not see it fails the build.
- **FR-006**: The layer rule MUST catch a forbidden import whether it is
  written as a direct path or routed through a barrel/index file.
- **FR-007**: The layer rule MUST define and enforce what the `shared` layer
  may import (nothing from `domain`, `application`, `infrastructure`, or
  `presentation`).
- **FR-008**: Phase 0 completion MUST be verified by adding a deliberate
  illegal import for each forbidden direction — direct and via a barrel —
  confirming the build fails for each, and then removing them.
- **FR-009**: The repository MUST contain `docs/architecture.md` stating the
  layer map (`domain` / `application` / `infrastructure` / `presentation` /
  `shared`) and the dependency-inward rule, and the enforced configuration
  MUST match that document.
- **FR-010**: The repository MUST contain `docs/stack.md` naming exactly one
  tool for each of: PWA framework, state management, storage adapter for the
  File System Access API, storage adapter for IndexedDB, charts, navigation,
  test runner, lint, and formatting — with no concern left blank (an
  explicit "none, handled by X" is permitted; a blank is not).
- **FR-011**: `docs/stack.md` MUST contain an explicit list of additions
  that require an ADR before they may be introduced (constitution,
  Escalation; "one dependency per concern").
- **FR-012**: `docs/stack.md` MUST be consistent with ADR-0002 (one storage
  port; two adapters — File System Access API and IndexedDB — selected at
  runtime).
- **FR-013**: The technology choices recorded in `docs/stack.md` MUST have
  been confirmed with the project owner before landing, and that
  confirmation MUST be traceable (recorded in the `/speckit-plan` for this
  spec).
- **FR-014**: The repository MUST provide an in-memory fake of the storage
  port defined by ADR-0002, satisfying the same interface, usable in tests
  with no real File System Access API or IndexedDB.
- **FR-015**: The shared test doubles MUST live in one documented location
  and be importable from there; tests MUST NOT need to define their own copy
  of a shared double.
- **FR-016**: The repository MUST provide an integration-test harness that
  supplies the standard composition wiring (with fakes substituted) so an
  integration test does not rebuild it.
- **FR-017**: The repository MUST contain `docs/testing.md` describing the
  test pyramid, naming the shared doubles and their location, and showing
  how a test is written in this project.
- **FR-018**: The repository MUST provide a design-token module defining
  tokens for both a light and a dark theme, present from the first commit of
  the app shell (constitution Principle V); colours MUST be named by role,
  not by hue.
- **FR-019**: Every token in the design-token set MUST be named and present;
  a token MAY carry a provisional value, but no token may be absent.
- **FR-020**: The repository MUST provide an app shell that launches via a
  documented start command and serves a placeholder view, containing no
  domain entity, no persistence call, and no screen beyond the placeholder.
- **FR-021**: The repository MUST provide a smoke test that confirms the app
  shell renders its entry point, and that smoke test MUST run under the same
  test runner named in `docs/stack.md` and be part of the CI test check.
- **FR-022**: The placeholder view MUST take its visual values from the
  design tokens in both light and dark contexts, with no literal colour at
  the use site (`docs/development-principles.md` §5).
- **FR-023**: Any later change to the layer map MUST update both
  `docs/architecture.md` and the enforcement configuration in the same
  change (constitution, Definition of Done).

### Key Entities *(artifacts this spec governs)*

- **`docs/stack.md`**: the single record of one-tool-per-concern plus the
  "not without an ADR" boundary. Consistent with ADR-0002 on storage.
- **`docs/architecture.md`**: the layer map and dependency-inward rule, in
  prose, kept in lockstep with the enforced configuration.
- **`docs/testing.md`**: the test pyramid, the shared doubles and their
  location, and the "how a test is written here" guide.
- **CI pipeline definition**: runs typecheck + test + lint on every PR;
  combined red on any failure or missing tool; blocks merge when red.
- **Boundary-lint configuration**: mechanical enforcement of the layer map,
  including barrel-path coverage and the `shared`-layer import rule.
- **In-memory storage-port fake**: satisfies the ADR-0002 port interface;
  the test-only implementation used by Phases 1–3.
- **Integration-test harness**: the standard composition wiring with fakes
  substituted, reusable across integration tests.
- **Design-token module**: named tokens for light and dark themes, roles not
  hues, complete set from day one.
- **App shell + smoke test**: an empty launching app and a test that
  confirms it comes up; the attach point for Phase 3.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For each of the three checks (typecheck, test, lint), a
  deliberately broken branch produces a red CI gate and a blocked merge, and
  a fixed branch produces a green gate — verified once per check (3/3).
- **SC-002**: A deliberate illegal import fails the build in 100% of the
  forbidden directions tried, tested both as a direct import and via a
  barrel file, and a legal import passes.
- **SC-003**: The layer map in `docs/architecture.md` and the enforced
  configuration describe the same rule, verified by inspection with zero
  discrepancies.
- **SC-004**: `docs/stack.md` names exactly one tool for 100% of the listed
  concerns (0 blank, 0 doubled) and contains the "not without an ADR" list.
- **SC-005**: A test can store and read back a value through the in-memory
  storage-port fake with no real storage API present, and a second test runs
  through the integration harness — both green under the project test
  runner.
- **SC-006**: From a clean clone, following only the documented setup and
  start commands, the app launches and serves a placeholder, and the smoke
  test passes — reproduced by someone who did not set up the repository.
- **SC-007**: The placeholder renders correctly in both light and dark theme
  contexts drawing only on design tokens; a grep for literal colour values
  outside the token module returns nothing.
- **SC-008**: `docs/stack.md`, `docs/architecture.md`, and `docs/testing.md`
  all exist and each covers the content required by its FRs — verified by a
  checklist review.

## Assumptions

- **`/speckit-plan` chooses the tools.** This spec assumes the immediately
  following `/speckit-plan` selects every concrete tool for `docs/stack.md`
  and that those choices are confirmed with the project owner before the
  plan's tasks are implemented (`AGENTS.md`; constitution, Escalation).
- **Default branch and PR flow.** The project uses a pull-request workflow
  into a default branch (trunk-based development, per the
  `commit-and-pr-conventions` skill); the CI gate attaches to that flow.
- **ADR-0002 is binding and stable.** The platform (PWA) and the storage
  architecture (one port, two adapters) are fixed; Phase 0 builds the port
  fake against that decision without reopening it.
- **One test runner.** A single test runner (named in `docs/stack.md`) runs
  unit, integration, and smoke tests; the CI test check invokes it.
- **The app shell is throwaway-thin.** The placeholder view exists only to
  prove the shell launches and themes correctly; it is expected to be
  replaced, not extended, when Phase 3 begins.
- **Hosting/deployment is out of scope for Phase 0.** "The app launches"
  means locally from a clean clone; a deploy target is not required by this
  spec.
