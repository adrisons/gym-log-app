# Quickstart: Diary, Search and Progression

How to validate this feature end-to-end once implemented. See
`contracts/screen-contracts.md` for the full scenario list and
`data-model.md` for the derivation functions referenced below.

## Prerequisites

- `npm install` (`react-router-dom` and `recharts` are already
  `dependencies` entries — no new install needed).
- `npm run dev` for manual verification in a browser, or
  `npm run build && npm run preview` / Playwright's `webServer` for the
  automated e2e pass.

## Automated validation

```sh
# Unit: pure derivation logic (search, e1RM/tonnage/best-working-set/series,
# diary summary/grouping) — the bulk of this spec's coverage
npm run test:unit -- test/unit/application/diary
npm run test:unit -- test/unit/application/search
npm run test:unit -- test/unit/application/progression

# Component: the three new screens against InMemoryStorageAdapter
npm run test:unit -- test/unit/presentation/diary
npm run test:unit -- test/unit/presentation/search
npm run test:unit -- test/unit/presentation/progression

# e2e: composition-root routing + the existing smoke suite, extended
npx playwright test test/e2e/shell-smoke.spec.ts

# Full suite (unit + integration + e2e + boundaries), same as CI
npm run test:unit
npm run test:e2e
```

Expected outcome: every scenario in `contracts/screen-contracts.md`
passes; the search benchmark test confirms sub-100ms results against a
500-exercise fixture catalogue (FR-010); `LoggingScreen`'s own existing
tests are unaffected by the new router wiring.

## Manual validation (browser)

1. `npm run dev`, open the app, log two or three sessions across at least
   two different months, using a mix of `Weight`, `Bodyweight` (with and
   without added load), and `Band`/`FreeText` loads across a couple of
   different exercises (reuse the existing logging screen).
2. Navigate to the diary screen:
   - Confirm sessions are grouped by month, most recent first, each with
     an accurate one-line summary (FR-6).
   - Tap a session; confirm its detail view shows every block/exercise/
     set, and that editing a set there persists (reload the page and
     re-open it to confirm).
   - Use jump-to-date to a date between two logged sessions; confirm it
     lands on the nearer one.
3. Navigate to exercise search:
   - Search an exercise's exact name, a typo'd version, and its alias (if
     one exists); confirm each returns it.
   - Search something nonexistent; confirm the explicit empty state.
4. Open a `Weight`-logged exercise's progression screen:
   - Confirm the list shows one row per session with the right best set.
   - Switch the chart metric across all four options; confirm the values
     change plausibly (spot-check one e1RM value by hand against the
     Epley formula).
   - Switch the range selector; confirm the chart's plotted points change
     while the list does not.
   - Confirm the heaviest session is marked as a personal record in both
     the list and chart.
5. Open a `Band`/`FreeText`-only exercise's progression screen:
   - Confirm no estimated-1RM option is offered, and the one-sentence
     explanation is shown.
   - Confirm the metrics that do apply (tonnage-as-reps, reps at a fixed
     load) are still offered and populated.
6. Confirm the logging screen (`/`) still works exactly as before this
   change — log a set, confirm the tap count and offline behavior are
   unaffected by the new router wrapping the composition root.
