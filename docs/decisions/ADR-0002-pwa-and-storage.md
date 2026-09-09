# ADR-0002: Platform is a PWA, with a dual storage adapter behind one port

**Date:** 2026-09-09
**Status:** Accepted

## Context

D2 (`docs/requirements.md` §8) originally assumed a native cross-platform app
(iOS and Android from one shared codebase). That path was reconsidered: native
distribution requires Apple/Google publishing costs and review processes,
which conflict with the project's small, personal-tool scope.

Whatever the platform, invariant 1 (`docs/requirements.md` §1.2 — data stays
on the user's device) and invariant 2 (logging always works, offline,
one-handed) must hold. On the web, the most direct way to give the user their
data "as files they can locate and inspect" is the File System Access API —
but it does not exist on iOS Safari, which this app must support.

## Decision

- **Platform:** a Progressive Web App. One web codebase, installable on
  mobile and desktop, no App Store / Play Store distribution, no native shell.
  Installable and usable offline after first load (service worker precaching
  the app shell).
- **Storage:** a single storage port, defined in the application layer in
  domain terms (save a session, load sessions in a range, etc.), with two
  infrastructure adapters:
  - `FileSystemStorageAdapter` — File System Access API, used where the
    browser supports it (Chromium desktop and Android). Data lives as files
    the user can locate and inspect.
  - `IndexedDbStorageAdapter` — used automatically where File System Access
    is unavailable, notably iOS Safari. Full feature parity with the other
    adapter; not a degraded tier.
  - The choice is made once per device, at runtime, via feature detection, in
    exactly one place (the composition root) — never a user-facing setting,
    never a build flag, never a branch inside domain or application code.
  - Both adapters are tested against one shared contract test suite written
    against the port's interface. An in-memory fake of the same port is the
    third, test-only implementation, used to exercise everything above the
    storage layer without any real adapter involved.
- The schema/versioning rules in `docs/requirements.md` §6 apply identically
  regardless of which adapter is active. Export/import (FR-12) produces and
  accepts the same interchange format from either adapter — a session
  exported from an IndexedDB device must import cleanly into a
  File-System-Access device, and vice versa.
- This is the concrete, storage-specific application of the general
  ports-and-layering discipline already required by
  `docs/development-principles.md` §2–§3 — not a separate architecture.
- Each functional requirement (`docs/requirements.md` FR-1 through FR-12)
  starts life as Given/When/Then scenarios in the domain's own vocabulary
  (§3 of `docs/requirements.md`), written and agreed before the implementing
  code, exercised against the in-memory fake so the same scenario is
  adapter-agnostic and later runnable unmodified against either real adapter.

## Consequences

**Positive**

- No app-store review process or publishing cost.
- iOS Safari users get full functionality, not a reduced tier.
- The storage port makes "does this adapter satisfy the contract" a single
  question asked once, not once per adapter.
- A scenario like "logging a set persists it and survives a reload" is
  written once and proves true for both adapters.

**Negative**

- No File System Access API on iOS Safari means no "it's literally a folder
  you can open" for a large share of mobile users — mitigated by keeping
  IndexedDB at full parity and by export/import (FR-12) as the portable
  interchange path.
- Two adapters to build and maintain against one contract, instead of one
  storage implementation.
- Web platform constraints (no true background execution, more limited
  storage-permission model) apply where a native app would not have them.

**Neutral**

- D2 (`docs/requirements.md` §8) is closed by this ADR: PWA, not native
  cross-platform.
- The concrete PWA framework, build tool, and any IndexedDB/File-System-Access
  helper libraries are deferred to the technical-planning phase
  (`/speckit-plan`) and its own stack document — this ADR fixes the platform
  and the storage architecture, not the toolchain.
