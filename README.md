# gym-log

A personal training diary, installable as a Progressive Web App on mobile and
desktop. Log a session — blocks, exercises, sets, load, effort — in a few
taps, and see your progression and trend-based insights over time.

## Principles

- **Your data stays on your device.** No mandatory account, local-first by
  default, nothing sent anywhere. Data lives as local files via the File
  System Access API where the browser supports it, or in IndexedDB otherwise
  (notably iOS Safari) — the app picks automatically and both are
  full-featured. Everything is exportable in an open format.
- **Logging always works, instantly, offline.** No Save button, no waiting.
- **Insights are computed, not generated.** Every trend shown is a
  deterministic calculation over your own data, documented in
  `docs/requirements.md`.

## Status

Phase 0 (scaffolding) in progress: stack chosen (`docs/stack.md`), layer
boundary mechanically enforced, storage port interface + in-memory fake in
place. No domain logic, no real storage adapter, no screens yet — see
`docs/agent-brief.md` §3 for the phase order.

## Development

Requires Node 24 (see `.nvmrc`; `nvm use` if you have nvm).

```sh
npm ci            # install
npm run dev       # start the dev server
```

The quality gate — run these locally exactly as CI does (`.github/workflows/ci.yml`):

```sh
npm run typecheck              # tsc --noEmit
npm run lint                   # eslint . + prettier --check .
npm run check:no-color-literals
npm run test:unit              # vitest run --passWithNoTests=false
npm run test:e2e               # playwright test
```

`npm test` runs `test:unit` then `test:e2e`. A pull request cannot merge
unless all four checks are green (branch protection on the default branch
requires the CI workflow's jobs).

## Documentation

- [`docs/requirements.md`](docs/requirements.md) — what the app does
- [`docs/design.md`](docs/design.md) — visual and interaction design criteria
- [`docs/development-principles.md`](docs/development-principles.md) — general engineering practices, independent of technology
- [`docs/agent-brief.md`](docs/agent-brief.md) — build phase order and pre-code scaffolding
- [`docs/stack.md`](docs/stack.md) — one tool per concern, and what needs an ADR to change
- [`docs/architecture.md`](docs/architecture.md) — the layer map and the dependency-inward rule
- [`docs/testing.md`](docs/testing.md) — the test pyramid, shared doubles, how a test is written here
- [`.specify/memory/constitution.md`](.specify/memory/constitution.md) — core principles, workflow, definition of done
- `docs/decisions/` — architecture decision records
