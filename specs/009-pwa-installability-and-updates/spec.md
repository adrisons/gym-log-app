# Feature Specification: PWA Installability and Update Lifecycle

**Feature Branch**: `009-pwa-installability-and-updates`

**Created**: 2026-09-16

**Status**: Implemented — merged to `main` via PR #36 (implementation)
and a follow-up CI lint fix (unrelated to feature behavior). See
`tasks.md` for which tasks landed vs. remain manual/CI-only follow-up
(quickstart.md's live-device verification steps, and a dedicated
two-version service-worker + synthetic `beforeinstallprompt` Playwright
spec).

**Input**: User description: "Review whether the specs already cover showing
the user, from Settings, where their data is being stored — on iPhone no
folder/location is ever requested, which turned out to be expected
(ADR-0002: iOS Safari has no File System Access API, so IndexedDB is used
automatically), but there is currently no way for a user on any platform to
see, after the fact, which storage adapter is active or which folder was
chosen. Also add: when the app is opened in a plain browser tab (not
already installed), show a recommendation to install it as a PWA. And once
installed, decide whether an update-detection mechanism is needed so a user
who installed the app is never left running a stale version — note that
`vite.config.ts` already sets `registerType: 'autoUpdate'` with
`registerSW({ immediate: true })` in `src/presentation/main.tsx`, which
silently reloads the page on a new service-worker version with no
user-visible notice or control over timing, which risks interrupting the
logging critical path (Principle II) mid-set." Ground the spec in
`docs/requirements.md` FR-16 and D22, `ADR-0002` (storage adapters), the
constitution's Principle II (logging critical path, non-negotiable) and
Principle IV (external/platform capabilities behind a port), and
`docs/requirements.md` §7.5 ("platform-gated capabilities are requested
inside a user gesture; background code checks permission and never
prompts").

## Context *(mandatory)*

`v1` closed with Settings, export and import (`specs/006-settings-data`,
merged as PR #31): the app is a complete, useful, Strength-only PWA
(`ADR-0002`). Before any further discipline is prioritized (swimming per
`ADR-0006`, or anything after it), `docs/requirements.md` D22 closes that
the app's existing gym-logging experience is polished first — this spec is
the first piece of that polish, and covers three gaps in how the app
behaves as an installable, updatable web app, none of which touch the
domain model or the stored schema:

1. **Storage location is invisible after the fact.** `ADR-0002` picks one
   of two storage adapters per device, once, via feature detection: the
   File System Access adapter (Chromium desktop/Android — data lives in a
   folder the user is asked to choose, lazily, the first time something is
   saved) or the IndexedDB adapter (iOS Safari and anywhere else File
   System Access is unavailable — data lives in browser storage, no folder
   is ever requested, which is correct, expected behavior on iOS, not a
   bug). Neither path is ever shown back to the user: a Chromium user who
   picked a folder weeks ago has no way to recall which one, and no user on
   any platform can confirm which mechanism is even active.
2. **No installation offer.** Nothing in the app currently detects that it
   is running in a plain browser tab (rather than already installed) and
   invites the user to install it, even though `ADR-0002`'s whole
   platform decision (a PWA, not a native app) depends on users actually
   installing it to get the offline, one-handed, app-like experience
   Principle II assumes.
3. **Silent, forced updates.** `vite.config.ts` already registers a service
   worker with `registerType: 'autoUpdate'`, so an installed copy does
   eventually get a new version — this is not a "users get stuck on an old
   version forever" problem. The problem is *how*: today's registration
   applies a new version and reloads the page with no notice and no
   control over timing, which can happen while a set is being logged —
   directly at odds with Principle II ("no feature outside this path may
   add latency ... or a blocking step to it"; "closing the app at any
   moment MUST lose nothing already entered").

All three are read-only or platform-integration concerns, on the same
non-canonical footing as Settings itself (`docs/requirements.md` D14): no
new domain entity, no schema-version bump, and (per constitution Principle
IV) each platform capability involved (the active storage adapter,
`beforeinstallprompt`, the service worker's own update lifecycle) is read
through a port, never called directly from a screen.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Never lose a set to a silent update (Priority: P1)

A user is mid-workout, mid-set, when the app's service worker finishes
downloading a new version in the background. Today, that new version can
be applied and the page reloaded with no warning. Instead, the user
should see a small, non-blocking notice that an update is ready, and
choose when to apply it — never mid-set, never without being asked.

**Why this priority**: this is the one gap that can actively violate
Principle II (NON-NEGOTIABLE) today, not just a missing convenience — an
uncontrolled reload can interrupt the exact moment (recording a set) the
whole product exists to protect.

**Independent Test**: install the app, start filling in the add-set form
without tapping its Confirm control, trigger a new-version deployment, and
confirm: no reload happens while the form is unconfirmed, the update
notice does not appear until that entry is confirmed or cancelled, and
choosing to update from the notice only reloads on the user's own tap
(FR-002, FR-003).

**Acceptance Scenarios**:

1. **Given** an installed copy of the app with no set in progress, **When**
   the service worker finishes downloading a new version, **Then** the
   user sees a non-blocking notice that an update is available, with a
   control to apply it now.
2. **Given** that notice, **When** the user chooses to apply the update,
   **Then** the app reloads with the new version and the notice is gone.
3. **Given** that notice, **When** the user ignores it and keeps using the
   app, **Then** nothing is forced — the current version keeps working
   normally until the user chooses to update or closes and reopens the app
   (which picks up the new version like any normal launch).
4. **Given** the add/edit-set form has at least one field filled in but the
   user has not yet tapped its Confirm control (`SetConfirmControl`,
   `docs/requirements.md` D17/ADR-0010) when a new version finishes
   downloading, **When** the update becomes available, **Then** the notice
   is not shown yet; it appears only once that Confirm/Cancel resolves
   (the set is saved or discarded) — never interrupting or discarding the
   unconfirmed entry.
5. **Given** the app is closed and reopened after a new version was
   published, **When** it launches, **Then** it simply runs the new
   version, the same as any fresh page load — no notice is needed for a
   version that was already picked up at launch.
6. **Given** the user is on the logging screen (`/log`) for any reason,
   confirmed set or not, **When** an update becomes available, **Then**
   the notice is not rendered there at all (FR-018) — it appears once the
   user navigates to another screen.

---

### User Story 2 - See where your data actually lives (Priority: P2)

A user opens Settings and can see, in plain language, what storage
mechanism their data is on this device and, when applicable, which folder
they chose.

**Why this priority**: directly closes the trust gap that prompted this
spec (a user with no idea why one device asked for a folder and another
didn't) and is one of Invariant 1's ("data belongs to the user") practical
promises — but it is a display of existing state, not a live safety risk
the way User Story 1 is.

**Independent Test**: on a device using each adapter (or simulating both),
open Settings and confirm the storage section states the active mechanism
in plain language and, for the folder-based adapter, the chosen folder's
name — independently of whether User Story 1 or 3 exist yet.

**Acceptance Scenarios**:

1. **Given** a device where the File System Access adapter is active,
   **When** the user opens Settings, **Then** they see that their data is
   stored in a folder on their device, and the name of the folder they
   chose.
2. **Given** a device where the IndexedDB adapter is active (e.g. iOS
   Safari), **When** the user opens Settings, **Then** they see that their
   data is stored in the browser/app's own storage on this device, with no
   folder to name — worded so this reads as expected behavior, not a
   missing feature or an error.
3. **Given** the File System Access adapter is active but its stored
   permission to the chosen folder has been revoked or needs
   re-confirmation, **When** the user opens Settings, **Then** the storage
   section says so plainly (e.g. that access needs to be reconfirmed) and
   offers a control to re-request that permission (FR-017), rather than
   silently showing stale or incorrect information with no way to fix it.
4. **Given** the File System Access adapter is active but no folder has
   been chosen yet (nothing has been saved since install), **When** the
   user opens Settings, **Then** the storage section states that a folder
   will be chosen the first time something is saved, rather than showing a
   blank or error-like value.

---

### User Story 3 - Be invited to install, not left guessing (Priority: P3)

A user who opens the app in an ordinary browser tab, on a platform where
installing is possible, sees an invitation to install it — and never sees
that invitation again once they've installed it or dismissed it for good.

**Why this priority**: grows the number of users who get the installed,
offline, app-like experience the product is designed around, but nobody's
data or in-progress work is at risk if this ships last — unlike User
Stories 1 and 2, it is a pure acquisition/onboarding improvement.

**Independent Test**: open the app in a plain browser tab on a platform
that supports installation, confirm the install invitation appears; dismiss
it permanently, reopen the app, and confirm it does not reappear;
separately, open an already-installed copy and confirm no invitation is
ever shown there.

**Acceptance Scenarios**:

1. **Given** the app is opened in a plain browser tab, not already
   installed, on a browser that supports a native install flow, **When**
   the app loads, **Then** the user sees an invitation to install it that,
   when accepted, triggers that browser's own install flow from the tap
   that accepted it.
2. **Given** the app is opened in a plain browser tab on a browser with no
   native install flow (e.g. iOS Safari), **When** the app loads, **Then**
   the user sees an invitation that instead explains, in that browser's own
   terms, how to add the app to their home screen.
3. **Given** the app is already installed and running in its own standalone
   window, **When** it loads, **Then** no install invitation is ever shown.
4. **Given** the install invitation, **When** the user dismisses it
   permanently, **Then** it is not shown again on that device, on later
   visits, even across app restarts.
5. **Given** the install invitation was dismissed only for now (not
   permanently) — if the chosen design offers that distinction — **When**
   the user opens the app again in a later, separate visit, **Then** the
   invitation may be shown again, never within the same visit it was just
   dismissed from.

---

### Edge Cases

- What happens if the browser's own install flow fails or is cancelled by
  the user partway through (User Story 3)? → Treated as a decline: no
  error shown, the invitation may be offered again on a later visit exactly
  as any other dismissal.
- What happens if the app is open in two tabs/windows at once and an update
  is found (User Story 1)? → Each open instance independently shows its own
  update notice and independently decides when to apply it; applying the
  update in one instance never silently reloads the other.
- What happens if there is no network connection when the app would
  normally check for an update? → No update is found, no notice is shown,
  no error is surfaced — identical to there being no update at all.
- What happens if the install invitation (User Story 3) is shown and the
  user starts a set before responding to it? → The invitation never blocks
  or overlays the logging screen's fields or controls (Principle II); it is
  dismissible without interacting with it further.
- What happens on a device/browser that supports neither the File System
  Access API nor exposes any way to distinguish "installed" from "browser
  tab" (a rare or non-standard browser)? → The storage section (User Story
  2) still states the mechanism in use (IndexedDB, since that's the
  fallback adapter — `ADR-0002`); the install invitation (User Story 3)
  simply never fires, the same as any other platform judged unable to
  install, rather than guessing or erroring.
- What happens the very first time the app is ever opened (fresh install,
  no service worker registered yet)? → No update notice is possible yet
  (there is nothing to update from); the storage section still reflects
  whichever adapter this session selected; the install invitation may
  apply if running in a plain tab.
- What happens if the File System Access adapter is active but the user has
  not yet saved anything, so no folder has been chosen yet (the folder
  picker is asked lazily, on first save)? → The storage section states that
  a folder will be chosen automatically the first time something is saved,
  rather than showing a blank, broken, or error-like folder name (FR-007).
- What happens to the logging critical path itself — not just the Settings
  screen — when File System Access permission has been revoked (e.g. the
  user removed the app's folder access from browser settings)? → Unchanged
  by this spec: `specs/003-persistence` (FR-012a) already defines that a
  write on the logging path surfaces a distinguishable `StorageError` for
  "permission lost," and explicitly left the user-facing re-permission flow
  itself as "presentation-layer work for a future spec" (spec 003
  Non-Goals). This spec is that future spec for the re-permission flow
  (FR-017) and adds Settings-level visibility (FR-009) — but does not
  redefine how the logging path itself surfaces or retries the error,
  which stays spec 003's own responsibility.

## Non-Goals *(mandatory)*

- **Changing which storage adapter is chosen.** `ADR-0002`'s runtime,
  feature-detected choice between the two adapters is unchanged; this spec
  only displays the outcome of that existing choice. There is no UI to
  force, switch, or override the adapter.
- **A folder-picker "change storage location" control.** Moving data
  between adapters or to a *different* folder is already covered by
  export/import (`specs/006-settings-data`, FR-12); this spec does not add
  a second way to relocate data. This is distinct from FR-017 below, which
  only re-requests permission for the *same*, already-chosen folder — it
  never lets the user pick a different one.
- **A changelog, release notes, or version-history UI.** The update notice
  (User Story 1) says an update is available and lets the user apply it —
  it does not describe what changed.
- **Native app store distribution.** `ADR-0002` already closed D2 on a PWA,
  no App Store/Play Store; this spec doesn't reopen that.
- **Install analytics, install prompts tuned by A/B testing, or re-engagement
  campaigns.** The install invitation is a single, straightforward offer
  with a permanent dismiss — not a growth/marketing feature.
- **A new schema version.** None of the three capabilities here touch a
  canonical entity (`docs/requirements.md` §3.1); the one new piece of
  state this spec introduces (whether the install invitation was
  permanently dismissed) is Settings-shaped, non-canonical, additive state
  on the same D14-exempt footing as an existing Settings field — no version
  bump, no migration — even though (FR-016) it is kept out of the portable
  `Settings` record itself.
- **Changing the update mechanism's underlying technology.** Whether the
  service worker keeps `autoUpdate`-style registration or moves to a
  prompt-driven one is a `/speckit-plan` decision; this spec only fixes the
  user-facing contract (never a silent forced reload during an in-progress
  set) that whichever mechanism is chosen must satisfy.

## Requirements *(mandatory)*

### Functional Requirements

**Update lifecycle (User Story 1)**

- **FR-001**: When the app has downloaded a new version in the background,
  the system MUST tell the user via a non-blocking notice rather than
  applying it silently.
- **FR-002**: The system MUST NOT reload or otherwise apply a downloaded
  update while the add/edit-set form has at least one field entered and its
  Confirm control (`SetConfirmControl`, `docs/requirements.md`
  D17/ADR-0010) has not yet been tapped — Principle II (NON-NEGOTIABLE).
  This is the transient, per-form "unconfirmed entry" state, distinct from
  and narrower than `specs/001-log-a-session` FR-024's durable, per-session
  pending draft; it applies equally whether the form is adding a new set or
  editing an already-recorded one (D17).
- **FR-003**: The user MUST be able to apply an available update on demand
  from the notice, at which point the app reloads to the new version.
- **FR-004**: Declining or ignoring the update notice MUST leave the
  current version fully functional; the user is never forced to update in
  order to keep using the app.
- **FR-005**: A version already current at launch time MUST NOT trigger an
  update notice — the notice exists only for a version that becomes
  available while the app is already open.

**Storage location visibility (User Story 2)**

- **FR-006**: The Settings screen MUST state, in plain language, which
  storage mechanism (`ADR-0002`'s two adapters) is active on the current
  device.
- **FR-007**: When the File System Access adapter is active, the Settings
  screen MUST also state the name of the folder the user chose, when that
  information is available.
- **FR-008**: When the IndexedDB adapter is active, the Settings screen
  MUST make clear that this is expected behavior for this device/browser,
  not a missing capability or a failure to ask for a location.
- **FR-009**: If the app's stored permission for the chosen folder has been
  revoked or needs re-confirmation, the Settings screen MUST state this
  plainly rather than showing stale or assumed information.

**Install invitation (User Story 3)**

- **FR-010**: When the app is running in a plain browser tab (not already
  installed/standalone) on a platform able to support installation, the
  system MUST offer to install it.
- **FR-011**: On a browser exposing a native install flow, accepting the
  offer MUST trigger that native flow from the same user gesture that
  accepted it (`docs/requirements.md` §7.5: platform-gated capabilities are
  requested inside a user gesture).
- **FR-012**: On a browser with no native install flow (e.g. iOS Safari),
  the offer MUST instead present that browser's own manual installation
  steps.
- **FR-013**: The system MUST NOT show the install offer to a user already
  running the installed, standalone copy.
- **FR-014**: A user MUST be able to dismiss the install offer permanently;
  once dismissed this way, it MUST NOT be shown again on that device.
- **FR-015**: The install offer MUST NOT block or overlay any control on
  the logging screen (Principle II).

**Cross-cutting**

- **FR-016**: The install-offer-dismissed preference (Key Entities) MUST
  NOT be included in the export/import interchange file
  (`specs/006-settings-data` FR-007/FR-010/FR-011): it is device-local, so
  importing a file produced on a different device MUST NOT overwrite or
  reveal this device's own dismissal state, and exporting from this device
  MUST NOT leak it either. It is stored separately from the portable
  `Settings` record `specs/006-settings-data` defines, even though both are
  Settings-shaped, non-canonical, D14-exempt state.
- **FR-017**: When the File System Access adapter's permission for the
  already-chosen folder has been revoked (`specs/003-persistence` FR-012a),
  the Settings storage section MUST offer a control that re-requests that
  same permission, from a user gesture (`docs/requirements.md` §7.5); this
  closes `specs/003-persistence`'s own Non-Goals item ("a user-facing
  re-permission flow ... is presentation-layer work for a future spec").
  It MUST NOT offer to choose a different folder (see Non-Goals).
- **FR-018**: Neither the update notice (FR-001) nor the install offer
  (FR-010) MUST ever render while the active screen is the logging screen
  (`/log`) — not merely non-blocking there, but not shown there at all.
  Both are deferred until the user is on any other screen.

### Key Entities *(include if feature involves data)*

- **Storage status.** Read-only, derived state describing which of
  `ADR-0002`'s two adapters is active on this device and, where
  applicable, the chosen folder's display name (or that none has been
  chosen yet, if the File System Access adapter is active but nothing has
  been saved) and whether its permission is still valid. Not persisted
  by this feature — recomputed from the existing adapter/handle the
  composition root already holds.
- **Update availability.** Transient, non-persisted state reflecting
  whether the running service worker has a newer version ready to apply.
  Cleared once the update is applied or the app is reloaded/reopened.
- **Install-offer preference.** One new, small, non-canonical, per-device
  setting: whether the user has permanently dismissed the install offer.
  Additive, Settings-*shaped* state on the same D14-exempt footing as an
  existing Settings field, but — per FR-016 — stored and kept separate from
  the portable `Settings` record itself, so it is never carried by
  export/import.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Zero instances, across every tested scenario, of the app
  reloading or losing an in-progress, unconfirmed set as a result of an
  update being applied (User Story 1, FR-002) — verified by deliberately
  triggering an update while a set is mid-entry.
- **SC-002**: A user can state, after opening Settings once, in their own
  words, where their data is stored on their current device (a folder name,
  or "in the browser/app's own storage") — verified manually across both
  adapters.
- **SC-003**: 100% of first visits in a plain browser tab, on a platform
  able to install the app, result in the install offer being shown exactly
  once per visit; 0% of visits to an already-installed, standalone copy
  show it.
- **SC-004**: Once a user permanently dismisses the install offer, it does
  not reappear in any later visit on that device.
- **SC-005**: An update notice never appears for a version that was already
  current when the app launched — it only appears for a version that
  becomes available during an already-open session.
- **SC-006**: A user whose File System Access permission has been revoked
  can, from Settings alone, restore full read/write access to their
  existing data folder without exporting/re-importing or losing any data —
  verified by revoking permission, then using FR-017's control to restore
  it.

## Assumptions

- **"Actively being logged" (FR-002) means the add/edit-set form's own
  transient, per-form, unconfirmed-entry state — not
  `specs/001-log-a-session` FR-024's pending draft.** FR-024 is a coarser,
  durable, per-*session* concept (persists across an app close, true for
  most of a workout's duration once any exercise has been added); the state
  FR-002 actually needs to protect is the narrow, few-seconds, per-*form*
  window between the user filling in a field and tapping Confirm
  (`docs/requirements.md` D17/ADR-0010's `SetConfirmControl`), which is
  never itself persisted. Gating update-deferral on FR-024 instead would
  block updates for nearly the whole time the app is open on `/log`; gating
  it on the Confirm-control state is both the behavior Principle II is
  actually protecting and the one FR-018 can reason about precisely
  (deferred only while `/log` has an unconfirmed form, not for the route's
  entire lifetime).
- **A "visit" (FR-014, SC-003) is one browser tab/window's lifetime**, from
  load until it is closed, reloaded, or navigated away from the app's
  origin — not a durable, cross-tab, or cross-session concept, and not
  itself persisted; only the *permanent* dismissal (FR-014) survives across
  visits.
- **The install offer is shown at most once per visit, not on every
  navigation within the app.** Repeating it on every screen change within
  the same open tab would be intrusive; "dismissed for now" (as opposed to
  permanently, FR-014) may still reappear on a later, separate visit — the
  exact non-permanent re-offer cadence (e.g. next visit vs. after N days)
  is left to `/speckit-plan`, since it doesn't change this spec's
  observable guarantees (never shown twice in one visit, never shown once
  installed, never shown again once permanently dismissed).
- **The update check runs periodically while the app stays open, not only
  at launch.** A training session can run long enough that a purely
  launch-time check would rarely ever fire; the exact check interval is a
  technical/`/speckit-plan` detail, not a user-facing behavior this spec
  needs to pin down.
- **"Folder name" (FR-007) is whatever display name the platform itself
  reports for the chosen directory** (e.g. via the File System Access API's
  own handle), not a name this feature invents or lets the user edit.
- **No *background* permission request is added by this feature.**
  Storage-location display (User Story 2) only reads state the existing
  adapter already holds; it never itself triggers a folder picker or a
  permission prompt outside a user gesture. FR-017's re-permission control
  is the one deliberate exception, and it is not a background prompt: it
  only requests permission from an explicit tap on that control, matching
  `docs/requirements.md` §7.5's own rule ("platform-gated capabilities are
  requested inside a user gesture; background code checks permission and
  never prompts").
- **This feature ships before swimming (`ADR-0006`) or any other new
  discipline**, per `docs/requirements.md` D22 — recorded here for
  traceability, not re-decided by this spec.
