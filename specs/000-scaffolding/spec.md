# Feature Specification: Project Scaffolding (Phase 0)

**Feature Branch**: `000-scaffolding`

**Created**: 2026-09-10

**Status**: Implemented — merged to `main` via PR #3, PR #4

**Targets build phase**: Phase 0 — the scaffolding phase that precedes MVP
(`docs/agent-brief.md` §3 Phase 0; MVP scope is `docs/requirements.md` §9)

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

1. **Given** the `application`-layer storage port interface (FR-013,
   written per ADR-0002), **When** a test imports the in-memory fake,
   **Then** the fake satisfies that interface and needs no real File System
   Access API or IndexedDB.
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

1. **Given** the concern list (PWA framework, build tool / bundler, state,
   service worker / offline precache, storage helper for the File System
   Access API, storage helper for IndexedDB, charts, navigation, test
   runner, lint, formatting), **When** a developer reads `docs/stack.md`,
   **Then** each concern names exactly one tool or an explicit "none, …" —
   none missing, none with two.
2. **Given** `docs/stack.md`, **When** a developer looks for the boundary,
   **Then** it contains an explicit list of what may not be added without an
   ADR.
3. **Given** ADR-0002 (one storage port, two adapters — File System Access
   API and IndexedDB), **When** a developer reads the storage section of
   `docs/stack.md`, **Then** it names helper libraries only (or "none,
   hand-written"), is consistent with ADR-0002, and does not imply the
   adapter code is built in Phase 0.
4. **Given** concerns a later phase needs but Phase 0 does not (date/time
   handling, fuzzy search), **When** a developer reads `docs/stack.md`,
   **Then** each is listed with an explicit "deferred to the Phase N spec"
   note rather than omitted.

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
5. **Given** `docs/design.md` §3.1, **When** a developer inspects the
   design-token module, **Then** it defines every colour role in that
   section's canonical set (Canvas; Surface / surface-raised; Foreground /
   foreground-muted / foreground-subtle; Border / border-strong; Accent /
   accent-foreground; Focus ring; Danger / warning / success) for both
   themes, plus a token category for radii, durations, easings, and spacing
   (`docs/design.md` §1.2) — no role or category absent.
6. **Given** the constitution's Definition-of-Done rule that every
   interactive element ships all of its states, **When** a developer reads
   `docs/testing.md` (or `docs/architecture.md`), **Then** the six required
   states (rest, hover, pressed, focus-visible, disabled-with-reason,
   loading) are stated as a convention every later phase's interactive
   elements must follow, and the Focus ring token exists to support the
   focus-visible state.

---

### Edge Cases

- **CI gate on the default branch itself**: the gate runs on pull requests
  into the default branch AND on pushes to it, and the default branch is
  configured to require the gate's checks to pass before a merge, so a red
  gate actually blocks the merge and a direct-push bypass is still caught.
- **A check tool is missing or misconfigured in CI** (e.g. the linter is not
  installed on the runner): this is a red gate, not a silently-skipped
  check — an absent check is treated as a failing check.
- **The test job collects zero tests** (a misconfigured runner, a broken
  glob): treated as a failing check, not a pass — the same silent-pass
  failure mode as a missing tool.
- **The boundary rule has a gap** (a forbidden import path it does not
  catch): the Phase 0 verification deliberately tries each forbidden
  direction, direct and via a barrel, precisely to find such a gap before
  product code relies on the rule.
- **`shared` layer imports**: `shared` holds cross-cutting utilities with no
  business concept (`docs/agent-brief.md` §2); the boundary rule must define
  what `shared` may import (nothing from `domain`, `application`,
  `infrastructure`, or `presentation`) so it cannot become a backdoor
  between layers, and that restriction is enforced through a barrel/index
  path as well as a direct one.
- **The design sub-layer**: `presentation/design/` (tokens, primitives,
  compositions, root — `docs/agent-brief.md` §2) is where the design-token
  module lives. `docs/architecture.md` records it as a sub-layer of
  `presentation`, and the boundary rule governs it: `design/` may be
  imported by the rest of `presentation` but must not import from
  `application`, `infrastructure`, or `domain`.
- **A concern in `docs/stack.md` legitimately needs no tool** (e.g. the
  project decides navigation is handled without a dedicated library): the
  entry is still explicit — "none, handled by X" — never blank.
- **A concern is known but deferred to a later phase** (date/time handling,
  fuzzy search): `docs/stack.md` lists it with an explicit "deferred to the
  spec for Phase N" note rather than omitting it, so a later addition is a
  filled-in reservation, not a surprise escalation.
- **Design tokens exist but a value is undecided**: a token may carry a
  provisional value, but every role and category in the expected set
  (`docs/design.md` §3.1 roles + radii/durations/easings/spacing) is named
  and present; a missing token, not a provisional value, is the failure.
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
  are Phase 1 — no real domain logic here. Phase 0 DOES write the storage
  **port interface** in the `application` layer, stated in domain terms
  per ADR-0002 (e.g. save a session, load sessions in a range), because
  the in-memory fake (FR-014) and the integration harness (FR-016) need a
  concrete interface to satisfy and wire. Phase 1 owns that interface
  thereafter and MAY reshape it as the domain takes form; Phase 0 only
  establishes a first version and its fake.
- **Any real storage adapter.** The `infrastructure` adapters for the File
  System Access API and for IndexedDB, the schema version, and
  migrate/refuse behaviour are Phase 2. Phase 0 delivers only the port
  interface, its in-memory fake, and the shared contract's test
  scaffolding. In `docs/stack.md`, the storage entries name any helper
  *library* per adapter (or "none, hand-written") — they do not imply the
  adapter code is built in Phase 0.
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

- **FR-001**: The repository MUST provide a CI pipeline that runs a type
  check, the test suite, and a lint check on every pull request and on every
  push to the default branch. The gate is green only if all three checks are
  green ("combined"); it is red if any one of them is red.
- **FR-002**: The default branch MUST be configured to require the gate's
  three checks to pass before a change can be merged, so a red gate actually
  blocks the merge (not merely reports).
- **FR-003**: The type check, test, and lint commands MUST be documented (in
  `README.md` or a doc it links). CI MUST invoke those same documented
  commands — not merely the same tools — so a developer running them locally
  gets the same pass/fail outcome CI does, with no "passes locally, fails in
  CI" gap for these three checks.
- **FR-004**: A missing or misconfigured check tool in CI, or a test run
  that collects zero tests, MUST surface as a failing gate, never as a
  skipped or silently-passing check.
- **FR-005**: The repository MUST enforce the dependency-inward layer rule
  (constitution Principle V; `docs/development-principles.md` §3)
  mechanically, such that an import from an outer layer into code that
  should not see it fails the build.
- **FR-006**: The layer rule MUST catch a forbidden import whether it is
  written as a direct path or routed through a barrel/index file.
- **FR-007**: The layer rule MUST define and enforce what the `shared` layer
  may import (nothing from `domain`, `application`, `infrastructure`, or
  `presentation`), and that restriction MUST hold through a barrel/index
  path as well as a direct import, the same as FR-006.
- **FR-008**: Phase 0 completion MUST be verified by adding a deliberate
  illegal import for each forbidden direction — direct and via a barrel —
  confirming the build fails for each, and then removing them.
- **FR-009**: The repository MUST contain `docs/architecture.md` stating the
  layer map (`domain` / `application` / `infrastructure` / `presentation`,
  with `presentation/design/` as a sub-layer, plus `shared`) and the
  dependency-inward rule. The document MUST list the forbidden import edges
  in a fixed, enumerable form (e.g. a table: source layer → forbidden
  target), and the enforced configuration MUST cover exactly that set — a
  test or check compares the enforced edges against the documented set and
  fails on any difference.
- **FR-010**: The repository MUST contain `docs/stack.md` naming exactly one
  tool for each of: PWA framework, build tool / bundler, state management,
  service worker / offline app-shell precache, storage helper for the File
  System Access API, storage helper for IndexedDB, charts, navigation, test
  runner, lint, and formatting — with no concern left blank (an explicit
  "none, hand-written" or "none, handled by X" is permitted; a blank is
  not). Concerns known to be needed by a later phase but not Phase 0
  (date/time handling, fuzzy search) MUST be listed with an explicit
  "deferred to the Phase N spec" note rather than omitted.
- **FR-011**: `docs/stack.md` MUST contain an explicit list of additions
  that require an ADR before they may be introduced (constitution,
  Escalation; "one dependency per concern").
- **FR-012**: `docs/stack.md` MUST be consistent with ADR-0002 (one storage
  port; two adapters — File System Access API and IndexedDB — selected at
  runtime). The storage entries name helper libraries only; the adapter
  code itself is Phase 2.
- **FR-013**: The repository MUST provide the `application`-layer storage
  **port interface**, expressed in domain terms per ADR-0002 (e.g. save a
  session, load sessions in a date range). It is a first version that
  Phase 1 owns and may reshape; Phase 0 does not add domain logic behind
  it.
- **FR-014**: The repository MUST provide an in-memory fake that satisfies
  the FR-013 port interface, usable in tests with no real File System Access
  API or IndexedDB.
- **FR-015**: The shared test doubles MUST live in one documented location
  and be importable from there; tests MUST NOT need to define their own copy
  of a shared double.
- **FR-016**: The repository MUST provide an integration-test harness that
  supplies the standard composition wiring (with fakes substituted) so an
  integration test does not rebuild it.
- **FR-017**: The repository MUST contain `docs/testing.md` describing the
  test pyramid, naming the shared doubles and their location, and showing
  how a test is written in this project.
- **FR-018**: The repository MUST provide a design-token module, present
  from the first commit of the app shell (constitution Principle V), that
  defines — for both a light and a dark theme — every colour role in
  `docs/design.md` §3.1's canonical set (Canvas; Surface / surface-raised;
  Foreground / foreground-muted / foreground-subtle; Border / border-strong;
  Accent / accent-foreground; Focus ring; Danger / warning / success), plus
  a token category for radii, durations, easings, and spacing
  (`docs/design.md` §1.2). Colours are consumed by role name, never by hue.
- **FR-019**: Every role and category in the FR-018 expected set MUST be
  named and present in the module; a token MAY carry a provisional value,
  but no role or category may be absent. This expected set is the check for
  "a token is missing".
- **FR-020**: The repository MUST provide an app shell that launches via a
  documented start command and serves a placeholder view, containing no
  domain entity, no persistence call, and no screen beyond the placeholder.
- **FR-021**: The repository MUST provide a smoke test that confirms the app
  shell renders its entry point; it MUST run under the test runner named in
  `docs/stack.md` and be part of the CI test check. The CI test job MUST
  therefore never be a zero-test run in Phase 0.
- **FR-022**: The placeholder view MUST take its visual values from the
  design tokens in both light and dark contexts, with no literal colour at
  the use site (`docs/development-principles.md` §5).
- **FR-023**: Any later change to the layer map MUST update both
  `docs/architecture.md` (including its forbidden-edge list, FR-009) and the
  enforcement configuration in the same change (constitution, Definition of
  Done).
- **FR-024**: `docs/testing.md` (or `docs/architecture.md`) MUST state, as a
  convention every later phase follows, that each interactive element ships
  all six of its states — rest, hover, pressed, focus-visible,
  disabled-with-a-stated-reason, loading (constitution, Definition of Done)
  — and note that the Focus ring token (FR-018) exists to serve the
  focus-visible state. Phase 0 builds no interactive element itself.

### Key Entities *(artifacts this spec governs)*

- **`docs/stack.md`**: the single record of one-tool-per-concern plus the
  "not without an ADR" boundary. Consistent with ADR-0002 on storage.
- **`docs/architecture.md`**: the layer map (`domain` / `application` /
  `infrastructure` / `presentation` with `presentation/design/` sub-layer,
  plus `shared`), the dependency-inward rule, and an enumerable
  forbidden-edge list kept in lockstep with the enforced configuration.
- **Storage port interface** (`application` layer): a first version of the
  domain-term persistence interface per ADR-0002; owned by Phase 1
  thereafter.
- **`docs/testing.md`**: the test pyramid, the shared doubles and their
  location, and the "how a test is written here" guide.
- **CI pipeline definition**: runs typecheck + test + lint on every PR and
  every push to the default branch; green only if all three are green; red
  on any failure, missing tool, or zero-test run; the default branch
  requires these checks so a red gate blocks the merge.
- **Boundary-lint configuration**: mechanical enforcement of the layer map,
  including barrel-path coverage and the `shared`-layer import rule.
- **In-memory storage-port fake**: satisfies the ADR-0002 port interface;
  the test-only implementation used by Phases 1–3.
- **Integration-test harness**: the standard composition wiring with fakes
  substituted, reusable across integration tests.
- **Design-token module**: every `docs/design.md` §3.1 colour role plus
  radii/durations/easings/spacing categories, light and dark, roles not
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
- **SC-003**: The forbidden-edge list in `docs/architecture.md` and the set
  of edges the enforcement configuration actually rejects are identical — a
  check compares them and reports zero difference.
- **SC-004**: `docs/stack.md` names exactly one tool (or an explicit "none,
  …" / "deferred to Phase N") for 100% of the listed concerns — 0 blank, 0
  doubled — and contains the "not without an ADR" list.
- **SC-005**: A test can store and read back a value through the in-memory
  fake of the FR-013 port with no real storage API present, and a second
  test runs through the integration harness — both green under the project
  test runner.
- **SC-006**: A clean clone plus only the commands written in the setup doc
  is sufficient to launch the app to a placeholder and pass the smoke test —
  no undocumented step is required (verified by following the doc verbatim).
- **SC-007**: The placeholder renders correctly in both light and dark theme
  contexts drawing only on design tokens; a grep for literal colour values
  outside the token module returns nothing, and every FR-018 role/category
  is present in the module.
- **SC-008**: `docs/stack.md`, `docs/architecture.md`, and `docs/testing.md`
  all exist and each covers the content required by its FRs (FR-009..FR-012,
  FR-017, FR-024) — verified by a checklist review.

## Assumptions

- **`/speckit-plan` chooses the tools.** This spec assumes the immediately
  following `/speckit-plan` selects every concrete tool for `docs/stack.md`.
  Per `AGENTS.md` and the constitution's Escalation section, each of those
  choices MUST be confirmed with the project owner before the plan's tasks
  are implemented, and that confirmation MUST be recorded in the plan (this
  is a constraint on the plan phase, not a property of this spec that can be
  checked at spec time).
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
