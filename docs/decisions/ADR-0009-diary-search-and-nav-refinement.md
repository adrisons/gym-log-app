# ADR-0009: Diary search-by-exercise, Gmail-style bulk select, and a header nav menu

## Status

Accepted.

## Context

Direct feedback from the project owner, using the deployed app on a phone,
surfaced four interaction problems this ADR addresses together since all
four touch the diary screen's own layout and FR-6's bulk-select mechanism:

1. **Jump-to-date (FR-6/FR-003) is the wrong tool.** In practice the owner
   wants to find sessions that contain a given exercise ("show me every
   bench press session"), not a specific calendar date — the date picker
   requires already knowing when something happened.
2. **"Select sessions" causes a layout jump.** It rendered as an in-flow
   button above the session list; entering bulk-select removed it (FR-024
   replaces the primary logging action with a floating bar), and every row
   below shifted up by that button's own height. The floating FAB/bulk-bar
   swap underneath was already jump-free (both are `position: fixed`) — the
   in-flow button was the one element that wasn't.
3. **The bottom nav sits idle most of the time** and the owner wants it
   gone in favor of a header-based menu, matching how they use the app (get
   in, look at the diary, get out) — a persistent 4-tab bar is more chrome
   than the app's actual navigation habits justify.
4. Diary date stamps used `toLocaleDateString()` (locale- and
   device-dependent, e.g. `9/12/2026`) instead of a fixed, always-legible
   `12 Sep 2026` form.

## Decision

**Diary search (supersedes FR-6/FR-003's jump-to-date, spec 004 FR-003).**
The date `<input type="date">` and its "nearest session" link are replaced
with a plain text field that filters the already-loaded session list by
exercise name — substring and typo-tolerant, reusing FR-7's own matcher
(`shared/fuzzy-match.ts`'s `matchExercise`) against each session's derived
exercise-name list (`diary-summary.ts`'s `mainExerciseNames`, despite the
name already every distinct exercise in the session, not a truncated
"main" subset) rather than introducing a second matching algorithm. A query
with no matching session shows an explicit "no sessions match" state,
consistent with FR-012's search-empty-state precedent. `findNearestSessionDate`
(`diary-grouping.ts`) is removed as dead code — nothing else called it.

**Gmail-style bulk-select (supersedes FR-6/FR-024's entry mechanism).** The
in-flow "Select sessions" button is removed. Each row's leading icon badge
becomes its own `<button>` (a sibling of the row's navigation `<Link>`, not
nested inside it — nesting an interactive control inside an anchor is
invalid HTML and both would otherwise fight over the same click): tapping
it toggles that row's selection and, if bulk-select wasn't already active,
enters it — exactly Gmail's tap-the-avatar-to-select pattern. Deselecting
the last selected row automatically exits bulk-select (no explicit Cancel
needed to get back to the FAB, though Cancel still exists in the floating
bar for the same purpose). A sustained press on a row remains a second way
to enter bulk-select — it costs nothing to keep and some users already
rely on it. Since the icon toggle is a real, always-present `<button>`, it
is keyboard/screen-reader reachable on its own; no separate "arm selection
mode" control is needed for that audience anymore.

**Header hamburger menu (supersedes the bottom nav).** `BottomNav` is
replaced by `HeaderNav`: a slim bar at the top of every `AppShell` route
with a single right-aligned hamburger button that opens a dropdown with
**Diary**, **Insights**, and **Exercises** — deliberately not **Search**.
The owner asked for exactly those three; the standalone exercise-search-by-
catalogue screen (`/search`) stays in the router (nothing reachable from it
today, like a session's own progression links, breaks), it simply loses
its primary-nav entry now that the diary's own new search covers the
"find a session by exercise" need the nav-level Search tab existed for.

**Diary date format.** Diary session rows format `dateTime` as `12 Sep
2026` (day, short month name, full year) instead of
`toLocaleDateString()`'s locale-dependent output. Built from a fixed
month-name table rather than `Intl.DateTimeFormat`: CLDR's short-month
data isn't uniformly 3-letter across locales (`en-GB`'s September is
"Sept", not "Sep"), so no single `Intl` locale reliably produces this
exact shape — the whole point is one legible, unambiguous form regardless
of the viewer's own device locale. Scoped to the diary list only; session
detail's own full date-time header is unchanged.

## Consequences

- `application/diary/diary-search.ts` (new) — `filterSessionsByExerciseName`,
  covered by its own unit tests.
- `application/diary/diary-grouping.ts` loses `findNearestSessionDate` and
  its test block.
- `presentation/design/format-date.ts` (new) — `formatDiaryDate`, covered
  by its own unit test. Lives in `presentation-design`, not `shared`: the
  layer graph (`eslint.boundaries.js`) does not grant `presentation` an
  edge to `shared`, only to `application` and `presentation-design`.
- `presentation/diary/diary-screen.tsx` and `diary.css`: search field
  replaces the jump-to-date label/input; row markup splits the select
  toggle out of the navigation link; the "Select sessions" button and its
  styles are removed.
- `presentation/nav/bottom-nav.{tsx,css}` are removed;
  `presentation/nav/header-nav.{tsx,css}` (new) replace them, wired from
  `app-shell.tsx`. `--bottom-nav-height` (published by the old nav, read by
  `diary.css`'s floating-offset calculation) goes with it — the diary's
  FAB/bulk-bar now clear a fixed bottom offset instead, since there is no
  bottom bar left to clear.
- `docs/requirements.md` FR-6, `docs/design.md` §6, and
  `specs/004-diary-search-progression/spec.md` (FR-003, FR-024, and the
  matching acceptance scenario) are annotated as superseded by this ADR,
  following the precedent ADR-0006/ADR-0007 already set for amending FR
  text in place rather than forking a new spec number for a refinement of
  an already-implemented feature.
- No schema change: everything here is presentation/application-layer
  read/derive/UI behavior. No domain entity, port method, or stored field
  is added, renamed, or removed.
