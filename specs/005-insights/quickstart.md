# Quickstart: Insights

How to validate this feature end-to-end once implemented. See
`contracts/screen-contracts.md` for the full scenario list and
`data-model.md` for the derivation functions referenced below.

## Prerequisites

- `npm install` (no new dependencies — this feature adds no
  `package.json` entry).
- `npm run dev` for manual verification in a browser, or
  `npm run build && npm run preview` / Playwright's `webServer` for the
  automated e2e pass.

## Automated validation

```sh
# Unit: pure derivation logic — the bulk of this spec's coverage
npm run test:unit -- test/unit/application/insights

# Component: the Insights screen against InMemoryStorageAdapter
npm run test:unit -- test/unit/presentation/insights

# Performance check (research.md §1): confirm the naive full-recompute
# approach actually satisfies docs/requirements.md §7.1's "never blocks
# the interaction path" at a realistic data volume before considering any
# memoization — include this as an explicit assertion in
# build-insights.test.ts (e.g. a few hundred sessions, assert wall-clock
# time is well under a human-perceptible delay).

# e2e: composition-root routing, extended
npx playwright test test/e2e/shell-smoke.spec.ts

# Full suite (unit + integration + e2e + boundaries), same as CI
npm run test:unit
npm run test:e2e
```

Expected outcome: every scenario in `contracts/screen-contracts.md`
passes; the performance assertion confirms the naive recompute is fast
enough at realistic data volumes without any caching; `LoggingScreen`'s
own existing tests are unaffected.

## Manual validation (browser)

1. `npm run dev`, and using the existing logging screen, log:
   - One exercise across 6+ sessions spanning 3+ weeks with increasing
     load (for per-exercise progress).
   - A second exercise sharing a movement pattern or muscle group with
     the first, also across 6+ sessions with increasing load (for
     aggregate progress).
   - A session that beats or ties an exercise's best-ever load, reps, or
     tonnage (for recent records).
   - An exercise with 6+ sessions over a short span at essentially the
     same load (for detected plateau).
   - Sessions spread across at least 4 distinct weeks, with at least one
     week skipped (for consistency).
   - 20+ working sets across exercises whose movement patterns include
     recognizable push/pull keywords (e.g. "push," "pull," "row,"
     "press") — for push/pull balance.
2. Navigate to `/insights` (via the diary screen's new link):
   - Confirm a per-exercise progress card appears for the qualifying
     exercise, with a plausible percentage change; tap it and confirm it
     opens that exercise's progression screen.
   - Confirm an aggregate progress card appears for the shared
     pattern/group, listing both contributing exercises.
   - Confirm a recent-records entry appears for the record-setting
     session.
   - Confirm a plateau card appears for the flat exercise.
   - Confirm a consistency card reports the correct trained/total week
     count.
   - Confirm a push/pull balance card reports a plausible split.
3. Confirm every card type that has nothing to show (e.g. before logging
   enough data, or for a card type with no qualifying subject) shows an
   explanation rather than an empty gap.
4. Confirm the logging screen (`/`) still works exactly as before this
   change.
