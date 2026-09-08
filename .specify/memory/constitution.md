<!--
Sync Impact Report
Version change: none → 1.0.0 (initial ratification)
Modified principles: n/a (first version)
Added sections: Core Principles (I–VI), Non-Goals, Development Workflow, Escalation, Governance
Removed sections: none
Templates requiring follow-up: none — plan-template.md, spec-template.md, tasks-template.md,
  checklist-template.md read this file at runtime and need no edits for this ratification.
Deferred TODOs: none. RATIFICATION_DATE set to the date this constitution was authored, since no
  earlier constitution existed for this repository.
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

### III. Progressive Web App Only
The application is a single web codebase, installable as a PWA on mobile and
desktop, with no native shell, no app-store distribution, and no
platform-specific binaries. It MUST be fully installable and usable offline
after first load via a service worker precaching the app shell. This
supersedes any native cross-platform framing found elsewhere in project
history (see `docs/decisions/ADR-0002-revised-pwa-and-storage.md`).
Rationale: avoids app-store publishing cost and review process while still
satisfying the offline, one-handed, always-works requirement of Principle II.

### IV. Storage as a Hexagonal Port with Two Adapters
The application layer defines exactly one storage port, expressed in domain
terms (save a session, load sessions in a range, etc.), never in terms of
files or database records. Two production adapters implement that port —
`FileSystemStorageAdapter` (File System Access API, Chromium desktop and
Android) and `IndexedDbStorageAdapter` (IndexedDB, required for iOS Safari,
with full feature parity, never a degraded tier) — plus in-memory fakes used
by every test above the storage layer. Adapter selection happens by feature
detection in exactly one place, the composition root, never inside domain or
application code and never duplicated at multiple call sites; a use case, a
view model, or a domain rule containing a capability check for the active
adapter is a boundary violation. Both adapters MUST be verified against one
shared contract test suite, so "does this adapter satisfy the port" is
answered once for both. The adapter choice is never a user-facing setting or
build flag — it is automatic.
Rationale: keeps business logic completely unaware of which browser storage
API is behind it, and gives iOS (IndexedDB-only) and desktop/Android
(File System Access-capable) users one identical, testable feature set.

### V. Behavior-Driven Development Before Code
Every functional requirement (FR-1 through FR-12 in `docs/requirements.md`)
starts as one or more Given/When/Then scenarios written in the domain's
ubiquitous language — Session, Block, Exercise entry, Set, Load, Volume,
Effort — never in storage or UI terms. Scenarios are written and agreed
before the implementing code, via the spec-kit `/speckit-specify` →
(optionally `/speckit-clarify`) → `/speckit-plan` → `/speckit-tasks` →
`/speckit-implement` flow, not retrofitted afterward. A scenario exercises
the application layer through its ports using the in-memory storage fake, so
it is adapter-agnostic and MUST be runnable unmodified against either real
adapter as proof both satisfy the same behavior.
Rationale: makes the two-adapter storage split (Principle IV) pay off
concretely — "logging a set persists it and survives a reload" is written
once and holds for both a File-System-Access user and an iOS IndexedDB user.

### VI. Dependency-Inward Layering
Code is organized as `domain` (entities, value objects, pure rules — no I/O,
no framework) → `application` (ports, use cases, session state, view models,
error policy) → `infrastructure` (storage, files, platform APIs implementing
the ports) → `presentation` (screens and UI, consuming view models only).
Presentation MUST NOT import persistence types. Every boundary crossing goes
through a port. Exactly one composition point wires infrastructure to
application. Design tokens are the only source of visual values, defined for
light and dark themes from day one; colours are named by role, never by hue.
Rationale: keeps the domain testable without touching disk or a browser API,
and keeps a change to "how we store data" (Principle IV) from ever leaking
into how a screen is built.

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
`/speckit-specify` and, when the spec touches the storage port or an open
decision, `/speckit-clarify`, followed by `/speckit-plan` and
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
(Principle II). When this constitution and a concrete request conflict, the
conflict is surfaced, never resolved silently.

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
day-to-day work lives in `AGENTS.md` and `docs/agent-brief.md`.

**Version**: 1.0.0 | **Ratified**: 2026-09-08 | **Last Amended**: 2026-09-08
