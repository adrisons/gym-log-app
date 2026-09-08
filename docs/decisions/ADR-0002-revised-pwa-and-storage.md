# ADR-0002-revised: PWA platform and dual-adapter storage

**Date:** 2026-09-08
**Status:** Accepted — supersedes [ADR-0002](./ADR-0002-cross-platform-native.md)

## Context

ADR-0002 committed to a native cross-platform app (shared codebase, iOS and
Android). Before implementation started, that decision was reconsidered to
avoid Apple/Google publishing costs and app-store review processes.

The alternative — a Progressive Web App — is fully viable against
`docs/requirements.md` invariant 1 ("the data belongs to the user and lives
on their device") and invariant 2 (logging always works, offline, in a few
taps), provided offline installability and local data ownership are
preserved without a native shell.

The one platform gap a PWA introduces: the File System Access API, the most
direct way to give a user "your data is a folder of files you can open," is
not implemented in iOS Safari. A single storage strategy cannot serve every
device without either dropping that transparency everywhere, or leaving iOS
users with a degraded experience — both unacceptable under invariant 1's
"full-featured everywhere" spirit.

## Decision

1. **Platform:** the app is a Progressive Web App — a single web codebase,
   installable on mobile and desktop, with no native shell and no app-store
   distribution. It must be fully installable and usable offline after
   first load, via a service worker precaching the app shell (see
   `adrisons/private-notes` ADR-012 for a working precedent of this pattern).

2. **Storage:** a dual-adapter strategy behind one hexagonal port —
   - `FileSystemStorageAdapter` (File System Access API) where the browser
     supports it (Chromium desktop and Android).
   - `IndexedDbStorageAdapter` (IndexedDB) everywhere else, notably iOS
     Safari — with full feature parity, not a degraded tier.
   - The adapter is chosen once per device via feature detection, entirely
     inside the composition root. It is never a user-facing setting, never
     a build flag, and never visible as a choice in the UI.
   - Both adapters honour the same schema-versioning rules as
     `docs/requirements.md` §6 (migrate on older version, refuse on newer,
     derived data rebuildable) and the same interchange format for
     export/import (FR-12), so data round-trips cleanly between a
     File-System-Access device and an IndexedDB device.

This mandates a hexagonal (ports and adapters) architecture for storage:
the application layer defines the storage port in domain terms; domain and
application code stay unaware of which adapter is active; both adapters are
verified against one shared contract test suite; in-memory fakes of the
same port back all tests above the storage layer. Full detail in
`docs/handoff.md` §3.

## Consequences

**Positive**

- No app-store review, no publishing cost, one deployable artifact.
- iOS users get full feature parity via IndexedDB, not a lesser experience.
- The hexagonal port makes "does this adapter satisfy the contract"
  answerable once, for both adapters, and keeps business logic entirely
  free of platform branching.

**Negative**

- No File System Access API on iOS Safari means no "it's literally a
  folder of files" transparency for iOS users — mitigated by keeping
  export/import (FR-12) as the universal, format-identical escape hatch.
- Two storage adapters to build, test, and keep behaviourally identical,
  instead of one.
- PWA installability and offline behavior vary more across browsers than a
  native shell would; requires careful service-worker testing per platform.

**Neutral**

- The concrete PWA framework, build tool, and storage-adapter libraries are
  deferred to the `/plan` step of the spec-kit workflow, per
  `docs/agent-brief.md`'s "one tool per concern" rule.
