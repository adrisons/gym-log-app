# ADR-0005: Ship a seed exercise catalogue

**Date:** 2026-09-09
**Status:** Accepted

## Context

FR-1 (`docs/requirements.md` §4) surfaces the exercise catalogue ordered by
"most-used and most-recently-used first". On a brand-new install there is no
usage history and no catalogue, so that ordering has nothing to rank and the
first session forces the user to hand-create every exercise before they can
log a set — friction squarely on the critical path (invariant 2).

The alternatives considered were: an empty catalogue with only a "create
exercise" action; an empty state that lists nothing until history exists; or
shipping a starter set of common exercises.

## Decision

The app ships with a **seed catalogue** of common strength-training
exercises, present from first launch. There is no true empty state: opening
the exercise field on a fresh install shows the seed entries, and the
"create exercise" action is always available alongside them.

Seed entries are ordinary catalogue exercises once installed:

- The user can rename, merge, and delete them like any other entry; the app
  does not protect or re-create them.
- They carry the same fields as a user-created exercise (canonical name,
  aliases, movement pattern, muscle groups, default load type, unilateral
  flag, discipline = `Strength`).
- They are seeded once, at install / first run. The app does not re-seed on
  later launches, and does not reconcile a user's edits against the seed
  list.

The exact contents of the seed list (which exercises, their patterns and
muscle groups, their aliases) are an application-data concern, not a domain
decision, and can change between app versions without a schema migration —
existing installs keep whatever catalogue they already have.

## Consequences

**Positive**

- The first session works with zero catalogue setup: the common case (squat,
  bench, deadlift, row, press, …) is one search away.
- The "most-used / most-recent first" ordering (FR-1, FR-7) has real data to
  rank from day one.
- No special-casing in the catalogue model — a seed entry and a
  user-created entry are the same kind of thing.

**Negative**

- A user who wants a clean slate must delete seed entries they will not use.
- The seed list is opinionated; it will not match every training style.
  Mitigated by full editability and by "create exercise" always being
  present.

**Neutral**

- Export/import (FR-12): an exported file contains whatever catalogue the
  install has (seed entries included, as edited). Import does not treat seed
  entries specially.
- "Does not re-seed on later launches" (above) describes ordinary app
  launches, not a deliberate user-invoked reset: `specs/006-settings-data`
  FR-16 (delete-everything) is a distinct, explicit user action that
  intentionally restores the seed set as part of returning the device to
  a fresh-install state — not a launch-time re-seed this ADR argued
  against, and not a case this ADR anticipated when it was written.
- The seed contents live in the app bundle, versioned with the app, not in
  the persisted schema — so revising the list is a normal app change, not a
  §6 migration.
- Recorded as decision D9 in `docs/requirements.md` §8.
