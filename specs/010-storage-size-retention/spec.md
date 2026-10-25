# Feature Specification: Storage Size Display and Old-Data Retention Cleanup

**Feature Branch**: `010-storage-size-retention`

**Created**: 2026-10-24

**Status**: Planned

**Input**: User description: "Storage size display and old-data retention
cleanup in Settings — v1 follow-up to specs/006-settings-data. In Settings →
Data, show the total size occupied by the app's stored data, summarized in
whole-number KB or MB (no decimals, pick the right unit). Also add a 'delete
old data' action: a simple modal lets the user pick a cutoff date — either
from a few preloaded quick options (entries older than 1 year, 6 months, 3
months) or an explicit date — and deletes every stored entry (session)
dated before that cutoff. Keep the UX minimal, as little text as possible."

## Context *(mandatory)*

`specs/006-settings-data` built the Settings → Data section with export,
import, and an all-or-nothing "delete everything" flow (double
confirmation, resets to a fresh install). `specs/009-pwa-installability-and-updates`
later added a storage-status line to the same section
(`getStorageStatus()`, `storage-status-section.tsx` — which adapter is
active and, for the File System Access adapter, its folder/permission
state). Neither tells the user how much space their data actually
occupies, and neither offers a way to trim old training history short of
exporting, deleting everything, and re-importing a hand-edited file — which
is neither simple nor safe. This feature closes both gaps on the same Data
section: a plain-language size readout next to the existing storage-status
line, and a focused "delete old data" action that removes only Sessions
dated before a cutoff the user picks, leaving the exercise catalogue, Settings, and any in-progress logging draft untouched — a lighter,
repeatable alternative to 006's nuclear "delete everything" for someone who
just wants to stop carrying years of old history around.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See how much space my data takes up (Priority: P1)

A user opens Settings → Data and sees, next to the existing storage status,
a plain-language figure for how much space their stored data occupies —
rounded to a whole number of KB or MB, whichever reads better for the
amount.

**Why this priority**: the size readout is the smaller, purely informational
half of this feature and has no dependency on the cleanup flow — it stands
alone as a complete, independently valuable piece of Settings.

**Independent Test**: seed storage with a known amount of data, open
Settings, and confirm the displayed figure is a whole-number KB/MB value
consistent with that amount.

**Acceptance Scenarios**:

1. **Given** a device with some sessions, exercises, and settings stored,
   **When** the user opens Settings → Data, **Then** a size figure is shown
   as a whole number with a KB or MB unit (e.g. "48 KB" or "3 MB"), never a
   decimal.
2. **Given** the stored data's size is at least 1024 KB, **When** the size
   is displayed, **Then** it is shown in MB, not KB.
3. **Given** a freshly installed device with only the seed exercise
   catalogue and no sessions, **When** the user opens Settings → Data,
   **Then** a size figure is still shown (never blank or an error), rounded
   to at least "1 KB" rather than displayed as "0 KB".
4. **Given** the user adds a session, imports data, or deletes old data
   (User Story 2), **When** they return to or stay on the Settings screen,
   **Then** the size figure reflects the change next time it is shown
   (an exact live byte-counter is not required — see Non-Goals).

---

### User Story 2 - Delete training history older than a cutoff (Priority: P1)

A user who wants to stop keeping years of old workouts around opens
Settings → Data → "Delete old data", picks how far back to keep data —
either a preloaded quick option (older than 1 year / 6 months / 3 months)
or a specific date — and confirms. Every session dated before that cutoff
is removed; everything from the cutoff date onward, the exercise catalogue, Settings, and any in-progress logging draft are left exactly
as they were.

**Why this priority**: this is the feature's other independently valuable
half — a repeatable, scoped alternative to 006's all-or-nothing delete,
addressing the same underlying need (storage growing without bound) without
losing recent history.

**Independent Test**: seed storage with sessions on both sides of a known
date, run the flow with that date as the cutoff, and confirm only the
earlier sessions are gone afterward.

**Acceptance Scenarios**:

1. **Given** the user taps "Delete old data", **When** the modal opens,
   **Then** it offers the three preloaded quick options (older than 1 year,
   6 months, 3 months) and a way to enter an explicit date, with no option
   selected or an explicit date required before the delete action is
   enabled.
2. **Given** the user has picked a cutoff (quick option or explicit date),
   **When** the modal shows the delete action, **Then** it also shows how
   many sessions will be removed, so the user isn't confirming blind.
3. **Given** a chosen cutoff matches zero stored sessions, **When** the
   count is shown, **Then** it reads as zero and the delete action is
   disabled (nothing to delete).
4. **Given** the user confirms the delete action, **When** the deletion
   completes, **Then** every session dated before the cutoff is gone, every
   session on or after the cutoff is unchanged, the exercise catalogue, and Settings are unchanged, and a brief success
   confirmation is shown.
5. **Given** the user has an in-progress (not yet submitted) logging draft
   whose own date is before the chosen cutoff, **When** the deletion
   completes, **Then** the draft is left untouched (only already-saved
   Sessions are in scope — see Non-Goals).
6. **Given** the delete action fails partway (e.g. a write error), **When**
   the user is shown the outcome, **Then** the message is explicit that the
   deletion may be incomplete, consistent with how 006's delete-everything
   flow already reports a failed reset.

### Edge Cases

- A cutoff date in the future (after every stored session) is allowed and
  simply matches every session — the count (Scenario 2) makes this
  visible before the user confirms, rather than the system silently
  refusing a valid, if unusual, input.
- Re-running the flow with the same or an earlier cutoff after an earlier
  cleanup already ran is a normal, repeatable action, not a special case —
  it just finds fewer (possibly zero) matching sessions.
- The size readout (User Story 1) and the deletion (User Story 2) must stay
  consistent with each other: deleting old data is reflected in the size
  the next time it is shown (Acceptance Scenario 1.4).
- A session logged earlier the same calendar day as the chosen cutoff is
  kept, not deleted, regardless of its time of day — the cutoff is always
  the start of the chosen day, not a timestamp (see FR-009a). A user
  picking "today" as an explicit date therefore deletes nothing logged
  today, only strictly earlier days.
- While the explicit-date field holds no complete, valid date yet (e.g. the
  user is mid-typing), the modal has no cutoff to count against: it MUST
  show no count (not a stale count from a previous selection) and the
  delete action stays disabled, the same disabled state as having chosen
  nothing at all (FR-008).

## Non-Goals *(mandatory)*

- Re-litigating 006's existing "delete everything" flow, its double
  confirmation, or its fresh-install reset semantics — this feature adds a
  second, narrower deletion path alongside it, and does not change it.
- A live, continuously-updating byte counter — the size readout
  (User Story 1) is a snapshot computed when Settings is opened or
  refreshed, not a background process watching storage for changes; this
  keeps the feature to a simple on-demand read, consistent with how the
  rest of this Data section (export, storage status) already only
  computes its figures when the screen asks.
- An exact, OS-reported disk/quota figure. See Assumptions for what the
  displayed size actually measures.
- Deleting anything other than Sessions by date — the exercise catalogue, Settings, and the pending logging draft are never touched by
  this feature, regardless of their own dates, matching this spec's
  "entries" scope (the user-facing term for stored training history) as
  distinct from configuration/catalogue data.
- Designing the underlying atomic bulk-delete capability itself. This spec
  requires that confirming "Delete old data" is all-or-nothing across every
  matched Session (FR-010), which today's `StoragePort` cannot express
  (`deleteSession` is single-record; `resetToFreshInstall`/`importBulk` are
  whole-collection operations, not a filtered delete) — the same kind of
  gap 006 itself flagged as its own open dependency rather than assumed
  away. The concrete port addition is a `/speckit-plan` decision, not
  fixed here.
- Undo for the scoped delete-old-data action. Like every other destructive
  action already in this Data section (merge, delete-everything), it is
  irreversible once confirmed; a successful toast with a 5-second undo
  window (the pattern used for other deletions in this app, per
  `docs/design.md`) is out of scope for a bulk removal of this kind, the
  same reasoning 006 already applied to its own merge/delete-everything
  flows.
- Any export/import changes. 006's export/import mechanism is unaffected;
  a session removed by this feature is simply absent from a later export,
  the same as if the user had never recorded it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Settings → Data MUST show the total size occupied by the
  device's stored data, as a whole number with a KB or MB unit, with no
  decimal places.
- **FR-002**: The unit (KB vs. MB) MUST be chosen from the data's exact
  underlying size, before any rounding — MB once that exact size is 1024 KB
  (1,048,576 bytes) or more, KB below that. Rounding (FR-003) is applied
  only after the unit is chosen, so a value that rounds up to "1024 KB" is
  never shown — it is shown as "1 MB" instead.
- **FR-003**: Within whichever unit FR-002 chose, the displayed number MUST
  round to the nearest whole unit, and MUST show at least "1 KB" for any
  device holding more than zero bytes of stored data, never "0 KB" (a
  defensive floor — in practice there is always at least a seed exercise
  catalogue and these Settings themselves stored, so the figure measured is
  never literally empty).
- **FR-004**: The size figure MUST be recomputed whenever the Settings
  screen's Data section is shown, so it reflects additions, imports, and
  deletions made since the last time it was computed (not required to
  update live while the screen stays open and another screen changes the
  data — see Non-Goals).
- **FR-005**: Settings → Data MUST offer a "Delete old data" action,
  separate from 006's existing "Delete everything" action.
- **FR-006**: The "Delete old data" action MUST open a modal offering a
  cutoff date, choosable either from three preloaded quick options (entries
  older than 1 year, older than 6 months, older than 3 months) or an
  explicit date field.
- **FR-006a**: Each quick option's cutoff MUST be computed as "today's date,
  minus that many calendar years/months," evaluated in the device's local
  timezone. Where that arithmetic lands on a day that doesn't exist in the
  target month (e.g. 6 months before August 31, or 1 year before a leap
  day), it MUST clamp to the last valid day of that target month, the
  common calendar-arithmetic convention, rather than overflowing into the
  following month.
- **FR-007**: The modal MUST show how many stored sessions are dated before
  the currently chosen cutoff before the user can confirm deletion, updating
  as the cutoff selection changes. While no cutoff is yet resolvable (e.g.
  an incomplete explicit date), no count is shown and the delete action
  stays disabled (FR-008) — never a stale count left over from a previous
  selection.
- **FR-008**: The modal's delete action MUST be disabled until a cutoff is
  chosen, and MUST stay disabled (or otherwise prevent a no-op confirm) when
  the count of matching sessions is zero.
- **FR-009**: Confirming the delete action MUST remove every stored Session
  whose own date is strictly before the chosen cutoff, and MUST NOT modify
  any session dated on or after the cutoff, the exercise catalogue, Settings, or the pending logging draft.
- **FR-009a**: The cutoff (from either a quick option or an explicit date)
  denotes the start of that calendar day in the device's local timezone — a
  Session is only deleted when its own `dateTime` falls entirely before
  that instant, regardless of what time of day it was logged. A session
  logged on the cutoff's own day is always kept (matching Edge Cases).
- **FR-010**: The deletion MUST be all-or-nothing for the matched sessions —
  either every matched session is removed, or (on failure) the user is told
  plainly that the deletion may be incomplete, mirroring 006 FR-016's
  existing failure-reporting convention for delete-everything.
- **FR-011**: A successful deletion MUST surface a brief confirmation (e.g.
  how many sessions were removed), and the modal MUST close back to the Data
  section.
- **FR-012**: Text in the "Delete old data" modal MUST be minimal: a cutoff
  chooser, a count, a confirm action, and a cancel action — no additional
  explanatory copy beyond what FR-007 and FR-011 already require.

### Key Entities

- **Stored data size**: a derived, read-only figure — the total size of
  everything the device's `StoragePort` currently holds (Sessions, the
  Exercise catalogue, Settings, and the pending logging draft if any — the
  same scope `StoragePort.resetToFreshInstall`'s own doc comment currently
  describes for 006's "delete everything"), expressed to the user as a
  whole-number KB/MB amount. Not persisted; recomputed on demand (FR-004).
- **Retention cutoff**: a single date, supplied by the user (via a quick
  option or an explicit date) for one run of the "Delete old data" action.
  Not persisted past that one action — reopening the modal later starts
  with no cutoff chosen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can read how much space their data occupies from
  Settings in under 5 seconds, with no extra tap beyond opening Settings.
- **SC-002**: A user can remove training history older than a chosen cutoff
  in 3 taps or fewer after opening the "Delete old data" modal (choose a
  quick option or date, confirm, done) for the common quick-option case.
- **SC-003**: 100% of sessions dated on or after the chosen cutoff survive
  a "Delete old data" run unchanged, verified by the independent test for
  User Story 2.
- **SC-004**: The size figure shown after adding or removing data matches
  the actual change in stored data's size the next time Settings is opened,
  with no stale figure persisting across a full app reload.

## Assumptions

- "The app's stored data" (FR-001) means every record the `StoragePort`
  holds on this device — Sessions, the Exercise catalogue, Settings, and
  the pending logging draft — matching `resetToFreshInstall`'s own current
  scope exactly (006's "delete everything"), not just Sessions. Only the
  *deletion* in User Story 2 is scoped to Sessions by date; the *size
  readout* in User Story 1 covers everything stored.
- The displayed size is an approximation, not a literal OS/browser-reported
  disk or quota figure — reasonable because the two storage adapters
  (ADR-0002) do not expose a uniform, exact "bytes on disk" figure to the
  application layer the same way across both the File System Access and
  IndexedDB adapters. This matches how `specs/009-pwa-installability-and-updates`
  already treats the adjacent `getStorageStatus()` readout as a derived,
  best-effort description rather than a guarantee. The specific computation
  (how the approximation is derived from the stored records) is a
  `/speckit-plan` decision, not fixed here.
- 1 KB = 1024 bytes and 1 MB = 1024 KB (binary units), consistent with how
  operating systems and browsers most commonly present storage figures to
  end users.
- "Entries" (the user-facing term for what gets deleted by cutoff date) are
  Sessions keyed by their own `dateTime` (the workout's own date, already
  the single date field a Session carries) — not when the record was saved
  or last edited.
- A single, clearly worded confirmation inside the "Delete old data" modal
  (FR-007's count plus FR-011's result) is sufficient for this scoped,
  date-bounded action — unlike 006's "delete everything," which keeps its
  existing double confirmation because it is total and resets the whole
  device. This keeps the UX minimal per the feature's own ask while still
  stating plainly, once, what is about to happen and how much it affects.
- The exercise catalogue, Settings, and the pending logging
  draft are never touched by the scoped deletion regardless of any date
  they might individually carry, since none of them is "training history"
  in the sense the user means by "entries" — only Sessions are.
