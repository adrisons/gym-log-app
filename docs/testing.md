# Testing

The test pyramid, the shared doubles, and how a test is written here (spec
000 FR-017).

## The pyramid

- **Most tests: unit, via Vitest** (`test/unit/`). Domain rules, value
  objects, and application-layer logic tested with plain values and
  assertions — no framework, no I/O (`docs/development-principles.md` §1).
- **Fewer tests: integration, via the harness** (`test/integration/`). A
  test that wires several pieces together (a use case against a fake
  storage port, for instance) uses `createHarness()` from `test/support/`
  rather than assembling the wiring itself.
- **Fewest tests: end-to-end / smoke, via Playwright** (`test/e2e/`). Real
  browser, real DOM, real service-worker registration — things jsdom cannot
  verify. Runs in both Chromium and WebKit (the iOS Safari path,
  ADR-0002).
- **Boundary verification** (`test/boundaries/`) is its own category:
  `edge-set.test.ts` is a permanent automated guard that
  `docs/architecture.md` and `eslint.boundaries.js` stay in agreement;
  `README.md` in the same directory records the one-time manual proof that
  the enforcement actually rejects a bad import.

## Shared test doubles

Everything reusable across tests lives in `test/support/` and is
re-exported from `test/support/index.ts` — the one documented location
(FR-015). Import from there, not from an individual double's file:

```ts
import { InMemoryStorage, createHarness } from '../support';
```

Currently available:

- **`InMemoryStorage`** — the in-memory fake of the `StoragePort`
  (`src/application/ports/storage-port.ts`). Deterministic, `Map`-backed,
  has `reset()` for isolation between tests, needs no real File System
  Access API or IndexedDB.
- **`createHarness()`** — the standard composition wiring with fakes
  substituted (currently just `{ storage }`; grows as later phases add use
  cases and view-model stores).

A test does not define its own copy of a double that already exists here.
If a phase needs a new shared fake, it is added to `test/support/` and
re-exported from `index.ts`.

## How a test is written here

1. **Arrange** with plain values (for unit tests) or `createHarness()` (for
   integration tests) — never a real adapter, never a real browser API in a
   unit or integration test.
2. **Act** by calling the function/method under test.
3. **Assert** on the result. For DOM/component tests, query by accessible
   role or label (`@testing-library/react`'s `getByRole`, `getByLabelText`)
   — never by CSS class or test-id where an accessible query exists. This
   pushes tests toward the same a11y contract the product needs
   (`docs/requirements.md` §7.4).
4. A new behaviour ships with at least one test that fails without the
   change and passes with it; a bug fix ships with a regression test that
   failed before the fix (constitution, Definition of Done).

Run everything locally the same way CI does — see `README.md`
"Development".

## Interactive-element states (constitution Definition of Done)

Every interactive element, once one exists (Phase 3 is the first),
**MUST** ship all six of its states before it is considered done:

1. **Rest** — the default, unfocused, unpressed state.
2. **Hover** — pointer-over feedback (a no-op on touch-only devices; never
   the only way to reveal something essential, per `docs/requirements.md`
   §7.4).
3. **Pressed** — active/tap feedback.
4. **Focus-visible** — a visible focus indicator for keyboard/assistive
   navigation, using the `--color-focus-ring` design token
   (`src/presentation/design/`) and never suppressed.
5. **Disabled, with a stated reason** — a disabled control is never bare;
   the reason it is disabled is available to the user (a label, a tooltip,
   or adjacent text — never silence).
6. **Loading** — feedback for an in-flight action, consistent with
   invariant 2 (logging always works, nothing blocks silently).

Phase 0 builds no interactive element itself — this convention is recorded
now so every later phase's components are checked against it from their
first PR, and so the Focus-ring token (`docs/architecture.md` "Design
tokens") has a stated purpose before anything consumes it.
