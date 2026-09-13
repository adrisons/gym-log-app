# Quickstart: verifying "Log a Session"

How to confirm this phase is done, once implemented. Prerequisites: Node
per `.nvmrc`, `npm install` run at the repo root.

## Automated checks (what CI runs)

```sh
npm run typecheck
npm run test        # Vitest: unit + integration, against InMemoryStorage
npm run lint         # includes the boundary rule
npx playwright test  # e2e smoke, incl. the logging draft round-trip
```

All four green is the baseline bar (constitution Definition of Done). Every
FR-001..FR-026 acceptance scenario in spec.md should be traceable to at
least one test named after it — `docs/testing.md`'s convention.

## Manual scenarios (spec.md's own Acceptance Scenarios, condensed)

Run the dev server (`npm run dev`), open the app on a narrow (phone-width)
viewport first, then a wide one, in both light and dark theme:

1. **Cold start, no draft**: open the app → logging form opens directly to
   an empty, unsaved active draft dated "now" (editable), no picker, no
   dialog, no recovery banner (US1-1). _(Amended by ADR-0008: nothing is
   persisted yet at this point — closing right away leaves no draft
   behind.)_
2. **Log a set fast**: add an exercise, enter a load + rep count, confirm →
   appears instantly, no Save control anywhere, no spinner (US1-7, SC-001:
   count taps — repeating the previous set should be ≤ 3 taps once one set
   exists).
3. **Leave and return** — *not yet a literal browser-reload check with
   today's build*: `InMemoryStorageAdapter` (`src/infrastructure/`) is
   explicitly non-durable (research.md §1) — state lives only in that
   page load's JS heap, so an actual `page.reload()` loses it today,
   correctly, and is not something to expect to pass until the follow-up
   persistence spec lands. What *is* verified now: enter a set and confirm
   (via `test/integration/logging-flow.test.ts` and
   `test/unit/storage-port-fake.test.ts`) that `storage.getDraft()`
   reflects it immediately after — the application/port contract for
   "every change is persisted automatically" (FR-003/FR-024) holds; only
   the on-device durability of the adapter itself (SC-003/SC-007) is
   pending.
4. **Double-tap guard**: on a pre-filled set, tap confirm twice within
   about a second → only one set recorded (US1-9, FR-025).
5. **Blocks**: create two blocks, name one, leave one unnamed (shows as
   "Block 2", never "Untitled"), add exercises to each, move one exercise
   between blocks (US2-1..3).
6. **Delete + undo**: delete a block with sets in it → 5-second undo
   restores the whole block with its sets (US2-4, FR-023). Let the window
   expire once to confirm it becomes permanent.
7. **Every load type**: for one exercise, record a set as Weight, Band
   (from your own label list), Bodyweight (with a +/− component), Free
   text (autocompleting from a prior value), and None-with-a-Volume — each
   reads back correctly (US3, spec.md Acceptance Scenarios 1–6).
8. **Effort**: record effort on one set as a 1–5 tap, confirm the word
   label always shows next to the number, never a bare digit (US3-8,
   ADR-0003).
9. **Catalogue search**: search by a deliberate typo and by an alias → the
   intended exercise appears in the first 3 results (US4-1, SC-004).
10. **Rename collision → merge offer**: rename an exercise to a name
    already in use → app offers merge, not silent rejection or a
    duplicate; decline once (rename cancels, original name kept) and
    accept once elsewhere (merge applies, survivor keeps its own defaults,
    loser's name becomes an alias, its sets reassign) (US4-2..4, FR-022).
11. **Delete with history**: try deleting a catalogue exercise that has
    logged sets → confirmation dialog offers merge as an alternative;
    confirm the delete anyway → cascade removes its entries/sets too
    (US4-6, FR-018).
12. **Register a workout, then recover an abandoned one** (ADR-0008): log a
    set, then press "Log workout" → it appears in the diary immediately, no
    dialog, and the form resets to a fresh empty draft (US1-10). Separately,
    log a set, leave without pressing "Log workout" (close the tab or
    navigate to the diary), then reopen the logging form → a "Recover"/
    "Discard" banner offers the abandoned draft at the top of the screen;
    adding a new block/exercise/set is unavailable until you choose one
    (US1-2, FR-028); "Recover" fills the form with the earlier input,
    "Discard" removes it permanently. Reopening the form a second time
    with no draft ever registered nor discarded shows the same banner
    again, however many days have passed — there is no automatic
    day-based promotion any more.

## What "done" does not yet mean

Per `research.md` §1: this phase's automated and manual checks all run
against `InMemoryStorage`. `docs/requirements.md` invariant 2 ("closing the
app at any moment loses nothing") is proven at the `StoragePort` contract
level here, not yet against a real on-device adapter — that lands with the
follow-up persistence spec this plan recommends. Don't report SC-003/SC-007
as verified against a production build until that spec ships and this
quickstart is re-run against it.
