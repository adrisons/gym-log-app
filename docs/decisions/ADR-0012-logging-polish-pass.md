# ADR-0012: "Log workout" stays visible-but-disabled, a none-load set summary shows no dash, the screen title moves into the navbar, and Cancel is available when adding a set

## Status

Accepted.

## Context

Four small, unrelated fixes and refinements were requested together in one
design-review pass, gathered here rather than as four separate ADRs for the
same reason ADR-0010/ADR-0011 already gather their own multi-item passes:

1. **"Log workout" show/hide read as buggy.** `LoggingScreen`'s primary
   "Log workout" button was conditionally rendered at all — present only
   once `draftHasContent(draft)` was true and no pending-draft banner was
   unresolved, absent otherwise. In practice this meant the button was
   simply missing on a freshly-opened form (nothing entered yet) and
   appeared abruptly once the first exercise was added — reported as
   erratic/buggy behavior, not as an intentional gating, especially since
   `SetRow`'s own Confirm control (FR-019) already established the
   opposite convention in this same app: stay visible, `disabled` until
   ready, never removed from the page.
2. **A `none`-kind load showed a dash.** `formatLoad`'s `'none'` case
   returns `'—'`, correct for a fixed-column tabular view (the progression
   list) where every row needs a value per column, but `toSetSummaryViewModel`
   always included that string as `loadLabel`, so a set logged under a
   None-load template (e.g. an unweighted mobility drill) showed a "—" in
   its summary indistinguishable from an actually-missing value — nothing
   was missing; there was simply no load field for that template to begin
   with (ADR-0010's own reasoning for why Confirm doesn't require one).
3. **Space wanted back from repeated per-screen headings.** Every
   `AppShell`-routed screen (Diary, Session detail, Search, Progression,
   Insights, Exercises) rendered its own `<h1>` as the first thing in its
   `<main>`, in addition to `HeaderNav`'s own slim header row directly
   above it — two header-shaped rows stacked, on every screen, for
   content that could live in one.
4. **Adding a set was a one-way door.** `ExerciseSetList`'s add-set form
   already supported a Cancel button (`SetRow`'s `onCancel` prop) but only
   wired it up for the *edit* mode; opening the ordinary "add a new set"
   form (via "+ Add set", or an entry's own default-open state) had no way
   back to the "+ Add set" button short of filling in a value or navigating
   away.

## Decision

### 1. "Log workout" is always rendered, `disabled` when not ready

`LoggingScreen` renders the button unconditionally now; `disabled={!!pendingDraft
|| !draftHasContent(draft)}` replaces the surrounding `{condition && (...)}`.
This matches `SetRow`'s own Confirm control and FR-019's "unavailable" wording
one level up (FR-027 amended to describe this explicitly, rather than "there
must be no such action"). At the time of this ADR, no other screen in this
codebase had an equivalent save/commit button to reconcile —
`SessionDetailScreen` had none, persisting every change automatically. _(ADR-0017
supersedes this: `SessionDetailScreen` gained its own explicit "Save
session"/"Discard changes" pair, and the "every change persists
automatically" framing above was never spec 004 FR-005's own requirement —
only spec 001 FR-1's, which is scoped to the logging screen this fix
actually covers.)_

### 2. `loadLabel` is omitted, not "—", for a `none`-kind load

`toSetSummaryViewModel` (`application/logging/view-models.ts`) now computes
`loadLabel` as `undefined` when `set.load.kind === 'none'`, following the
same optional-field pattern `effortLabel` already used — `SetSummaryViewModel.loadLabel`
becomes `string | undefined`. `ExerciseSetList` renders it conditionally
(`{vm.loadLabel && <span>...</span>}`), and the set row's overflow-menu
accessible label drops the load segment entirely when absent rather than
interpolating `undefined`. `formatLoad` itself is unchanged (`'none'` still
formats as `'—'` for progression-list.tsx's own fixed-column table, a
different, genuinely tabular context where every column needs a value to
stay aligned) — this fix is scoped to the free-flowing set-summary list,
not to `formatLoad`'s general contract.

### 3. The screen title moves into the navbar, left of the menu

A new `presentation/nav/screen-title.tsx` exports a `ScreenTitleProvider`
(wraps `AppShell`'s content, alongside `HeaderNav`) and a `useSetScreenTitle(title)`
hook each `AppShell`-routed screen calls once, unconditionally, near the top
of its component (before any early return — Rules of Hooks), in place of its
own `<h1>`. `HeaderNav` reads the current title via `useScreenTitle()` and
renders it as an `<h1 className="header-nav__title">` to the left of the
hamburger button — `useSetScreenTitle` uses `useLayoutEffect`, not a plain
effect, so the new screen's title is in place before the browser paints
(React unmounts/mounts across a route change rather than re-rendering one
persistent component, so a plain effect would let the previous screen's
title flash for one frame first). `LoggingShell` (the `/log` route) has no
`HeaderNav` at all (ADR-0009) and is never wrapped in this provider —
`LoggingScreen` keeps its own `<h1>Log a session</h1>` unchanged.
`docs/design.md` §6 amended: the header's hamburger button is the only
fixed right-aligned element now, not the whole header.

### 4. Cancel is offered when adding a set too, not only when editing

`ExerciseSetList` now passes `onCancel={closeForm}` to `SetRow`
unconditionally, instead of only `{...(form === 'edit' ? { onCancel: closeForm } : {})}`.
Cancelling the add form (even for an exercise entry with zero sets logged,
where the form opens by default) returns to the `'closed'` state, which
renders the "+ Add set" button regardless of how many sets the entry
currently has — opening the form is no longer a commitment to entering a
value.

## Consequences

- `SetSummaryViewModel.loadLabel` becomes optional
  (`application/logging/view-models.ts`); any other consumer of that type
  would need the same conditional-render treatment `ExerciseSetList`
  already got — there is currently no other consumer.
- `docs/requirements.md` FR-3 (two new bullets: Cancel-in-add-mode, no
  dash for a none-kind load) and `specs/001-log-a-session/spec.md`
  FR-027/User Story 1 Acceptance Scenario 10 (visible-but-disabled,
  replacing "no such action") are annotated as amended by this ADR,
  following the precedent already set by ADR-0006/.../ADR-0011 for
  amending FR text in place. `docs/design.md` §6 is amended for the
  navbar title.
- No schema change: every fix here is presentation/application-layer
  behavior only — no `StoragePort` method, domain type, or persisted
  field is touched by any of the four items.
