<!--
Sync Impact Report
Version change: 1.0.0 → 2.0.0
Modified principles:
  - III. Progressive Web App Only → REMOVED. Platform choice is a technical
    decision deferred past this functional-definition stage.
  - IV. Storage as a Hexagonal Port with Two Adapters → renamed and
    generalized to IV. External Dependencies Behind Ports (no adapter
    names, no platform APIs named).
  - VI. Dependency-Inward Layering → unchanged in substance; cross-reference
    to docs/development-principles.md added.
Added sections: none
Removed sections: none (Non-Goals, Development Workflow, Escalation,
  Governance retained)
Templates requiring follow-up: none.
Deferred TODOs: the concrete platform and storage-adapter decisions removed
  from Principle III/IV are deferred to a later technical-planning phase,
  not lost — they are tracked as pending topics for a future `/speckit-plan`
  and its own ADRs.
-->

# gym-log Constitution

## Core Principles

### I. Data Ownership and Recoverability (NON-NEGOTIABLE)
The user's training and body-composition data belongs to the user and lives on
their device. No mandatory account, no v1 backend, no user content sent to
third parties. Everything MUST be exportable in an open, self-describing,
versioned format. Search indexes, progression aggregates, insight caches and
chart data are derived from canonical records (Session, Exercise catalogue,
Body measurement); they MUST be deletable and rebuildable from the canonical
records with no loss. A schema version travels with the data: an older
version auto-migrates and records the migration; a newer version is refused
with nothing written, never read partially.
Rationale: this is the app's reason to exist over a cloud alternative — data
custody and recomputability are the trust contract with the user, not
implementation details to compromise under deadline pressure.

### II. Logging Is the Critical Path (NON-NEGOTIABLE)
Recording a set MUST work immediately: offline, one-handed, with no Save
button, no waiting, no blocking dialog. Every write is optimistic — the UI
updates first, persistence confirms after. Every destructive action on the
logging screen is undoable for at least 5 seconds. Closing the app at any
moment MUST lose nothing already entered. No feature outside this path may
add latency, a network dependency, or a blocking step to it.
Rationale: this is invariant 2 of `docs/requirements.md` and the app's
primary use case (S1: record a complete set in ≤ 3 taps, mid-set, in the
gym). Anything that slows this path defeats the product.

### III. Behavior-Driven Development Before Code
Every functional requirement (FR-1 through FR-12 in `docs/requirements.md`)
starts as one or more Given/When/Then scenarios written in the domain's
ubiquitous language — Session, Block, Exercise entry, Set, Load, Volume,
Effort — never in storage or UI terms. Scenarios are written and agreed
before the implementing code, via the spec-kit `/speckit-specify` →
(optionally `/speckit-clarify`) → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement` flow, not retrofitted afterward. A scenario is written
against the domain's own behavior, independent of how it will eventually be
stored or displayed, so that it stays valid regardless of later technical
choices.
Rationale: decouples "what the app must do" from "how it will be built,"
which is exactly the separation this project is currently working through —
functional definition first, technical planning later.

### IV. External Dependencies Behind Ports
Anything the domain needs from outside itself — persistence, files, platform
capabilities — is expressed as a port: an interface stated in domain terms
(e.g. "save a session," "load sessions in a range"), never in terms of a
specific storage mechanism or external API. Concrete implementations of a
port are chosen later, in technical planning, and MAY differ by environment
without the domain or application code knowing or caring which one is
active; a domain rule or use case containing a capability check for a
specific implementation is a boundary violation. Every port MUST also have
an in-memory fake usable in tests, so behavior can be verified without any
real external dependency.
Rationale: keeps business logic provably independent of any one technology
choice, and keeps this repository's functional definition free of
technology names before those choices are made. See
`docs/development-principles.md` for the full practice this principle
codifies.

### V. Dependency-Inward Layering
Code is organized as `domain` (entities, value objects, pure rules — no I/O,
no framework) → `application` (ports, use cases, session state, view models,
error policy) → `infrastructure` (implementations of the ports) →
`presentation` (screens and UI, consuming view models only). Presentation
MUST NOT import persistence types. Every boundary crossing goes through a
port (Principle IV). Exactly one composition point wires infrastructure to
application. Design tokens are the only source of visual values, defined for
light and dark themes from day one; colours are named by role, never by hue.
Rationale: keeps the domain testable without touching disk or any external
system, and keeps a future change to "how we store data" from ever leaking
into how a screen is built. Elaborated in
`docs/development-principles.md`.

## Non-Goals

The following are explicitly out of scope and refused unless promoted to a
recorded decision (an ADR): a social network (profiles, followers, likes,
sharing); a program prescriber (the app records what was done, it does not
tell the user what to do); a calorie counter or nutrition tracker; a
generative-AI coach (insights are deterministic, explainable computations
per `docs/requirements.md` §5.6 — never generated prose); a cloud service
with multi-device sync in v1; a wearable companion (heart-rate monitors or
other sensors) in v1.

## Development Workflow

No implementation code for a use case is written before it has been through
`/speckit-specify` and, when the spec touches an open decision or a port's
expected behavior, `/speckit-clarify`, followed by `/speckit-plan` and
`/speckit-tasks`; `/speckit-implement` executes only after that chain exists
for the feature in question. Definition of done for every change: typecheck,
tests, and lint pass locally and in CI; every new behaviour has at least one
test and every fix has a regression test that failed before the fix; no
dependency is added that overlaps a concern already covered by an existing
one; no literal visual value appears outside the design tokens; every new
interactive element ships all of its states (rest, hover, pressed,
focus-visible, disabled with a stated reason, loading); a schema or
architecture change ships with its ADR; documentation describing the change
is updated in the same change; no typing escape hatch is added without being
local, loud, and commented with its reason.

## Escalation

The following are stopped and raised to the project owner rather than
decided unilaterally: any outbound network call or telemetry; a feature that
only works online; a change to the persisted format or the storage layout;
a second library for a concern already covered by an existing one; an
insight that cannot be expressed as a deterministic rule; a request that
falls under Non-Goals above; any slowdown of the logging critical path
(Principle II); any concrete technology, platform, or vendor choice — those
belong to a later technical-planning phase and its own ADRs, not to this
functional stage. When this constitution and a concrete request conflict,
the conflict is surfaced, never resolved silently.

## Governance

This constitution supersedes every other project practice on matters of
principle; where a separate "application standard" document is later added
to this repository, it becomes the process authority per `AGENTS.md` and
this constitution is amended to reference it. Amending a principle requires
a recorded rationale in this file's Sync Impact Report and a version bump
following semantic versioning: MAJOR for a backward-incompatible removal or
redefinition of a principle, MINOR for a new principle or materially
expanded guidance, PATCH for clarification or wording fixes. Every
`/speckit-plan` and pull request MUST verify compliance with the Core
Principles above; any necessary complexity or deviation is justified in
writing at the point it is introduced. Runtime development guidance for
day-to-day work lives in `AGENTS.md`, `docs/agent-brief.md`, and
`docs/development-principles.md`.

**Version**: 2.0.0 | **Ratified**: 2026-09-08 | **Last Amended**: 2026-09-08
