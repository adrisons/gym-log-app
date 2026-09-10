# Phase 0 Quickstart — verifying the scaffolding is done

Run these after `/speckit-implement` to confirm every Phase 0 requirement
holds. Each step maps to FRs / success criteria in [spec.md](./spec.md).

## Prerequisites

- Node 20 LTS, a clean clone, no prior `node_modules`.

## 1. The app launches from a clean clone (FR-020, SC-006)

```
npm ci
npm run dev        # documented start command
```

Expected: the dev server starts and serves a placeholder view with no
error. The placeholder contains no domain entity, no persistence call, no
logging screen — only the shell. (SC-006: only the commands written in
`README.md` were needed; no undocumented step.)

## 2. The quality gate (FR-001..FR-004, SC-001)

```
npm run typecheck   # tsc --noEmit
npm test            # vitest run + the Playwright shell smoke
npm run lint        # eslint . (incl. boundaries) + prettier --check
```

Expected: all three pass locally, and CI runs the **same** commands
(FR-003). Then, once per check, break it deliberately on a branch, open a
PR, and confirm the CI gate goes red and the PR is not mergeable
(branch-protection required checks, FR-002); fix it and confirm green
(SC-001, 3/3).

Also confirm: a test job that collects zero tests reports red, not green
(FR-004) — e.g. temporarily point the test glob at nothing.

## 3. Layer boundary breaks the build (FR-005..FR-009, SC-002, SC-003)

For each forbidden edge in [data-model.md](./data-model.md) §3, add the
illegal import and confirm `npm run lint` fails naming it. Do it twice:

- once as a **direct** import
  (`import { StoragePort } from '../application/ports/storage-port'` inside
  a `presentation/` file);
- once **through the barrel**
  (`import { StoragePort } from '../application'` where
  `src/application/index.ts` re-exports it).

Both must fail (FR-006). Repeat for a `shared/` file importing from
`domain/` directly and via barrel (FR-007). Remove them all and confirm
lint is green (SC-002).

Then run the edge-set check (`test/boundaries/`) that compares the enforced
`eslint-plugin-boundaries` matrix against the forbidden-edge table in
`docs/architecture.md` — expected: zero difference (FR-009, SC-003).

## 4. Shared test doubles + integration harness (FR-013..FR-016, SC-005)

```
npm test -- test/unit/storage-port-fake.test.ts
npm test -- test/integration/harness.test.ts
```

Expected: the first round-trips a value through the in-memory fake of the
`StoragePort` with no real storage API (FR-014); the second drives a
save-then-read through the integration harness's standard wiring (FR-016).
Both green. Confirm the fake and harness are imported from `test/support/`
— the one documented location (FR-015).

## 5. Design tokens, light and dark (FR-018, FR-019, FR-022, SC-007)

- Open `src/presentation/design/tokens.css`: confirm every role and
  category in [data-model.md](./data-model.md) §2 is present for both
  themes (a provisional value is fine; an absent token is not — FR-019).
- Render the placeholder in a light context and a dark context (OS setting
  or `data-theme="dark"` on `<html>`): it takes all visual values from
  tokens in both (FR-022).
- `grep -RInE '#[0-9a-fA-F]{3,8}|rgb\(|hsl\(' src/ --exclude-dir=design`
  returns nothing (SC-007).

## 6. The three docs exist and are complete (FR-009..FR-012, FR-017, FR-024, SC-004, SC-008)

- `docs/stack.md`: one tool (or explicit "none, …" / "deferred to Phase N")
  for every concern in FR-010; the "not without an ADR" list is present;
  the storage section names helper libraries only and is consistent with
  ADR-0002 (SC-004).
- `docs/architecture.md`: the layer map incl. `presentation/design/`, and
  the forbidden-edge table that the boundary config is checked against.
- `docs/testing.md`: the test pyramid, the shared doubles and their
  location, "how a test is written here", and the six-state
  interactive-element convention with the focus-ring token note (FR-024).
- Checklist review confirms each doc covers its FRs (SC-008).

## Done

All six sections pass ⇒ Phase 0 deliverable met ("an empty app that
launches, with a smoke test and a red build on a layer violation" —
`docs/agent-brief.md` §3) ⇒ proceed to Phase 1 (domain and ports).
