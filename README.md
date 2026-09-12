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

Phases 0–5 complete (`docs/agent-brief.md` §3): stack chosen and layer
boundaries mechanically enforced (Phase 0); the domain model, value
objects and every computation rule tested without touching disk (Phase
1); durable storage on both real adapters — IndexedDB and File System
Access, chosen automatically per device (Phase 2); the logging screen —
blocks, sets, load, effort, undo, catalogue management (Phase 3); a
diary/history screen, exercise search, and a per-exercise progression
screen with e1RM/tonnage charts and honest degradation for non-numeric
loads (Phase 4); and an Insights screen — six deterministic global-
conclusion cards (per-exercise progress, aggregate progress by movement
pattern/muscle group, recent records, detected plateau, consistency,
push/pull balance), each traceable to its own data and never shown below
its data-sufficiency threshold (Phase 5). See `specs/` for each
phase's spec, plan and tasks. Phase 6 (Body composition) is next.

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

`npm test` runs `test:unit` then `test:e2e`. CI runs these same commands on
every PR behind a single required `ci-gate` job (`.github/workflows/ci.yml`)
that fails if any of them fails — or is skipped. Branch-protection
enforcement that blocks merging a red `ci-gate` requires a GitHub plan this
private repo does not currently have (GitHub Pro, or making the repo
public); until upgraded, treat a green `ci-gate` as a merge prerequisite by
convention rather than a platform-enforced one.

## Deployment

Every push to `main` (a PR merge or a direct push) builds and publishes the
app to GitHub Pages via `.github/workflows/deploy.yml`, at
`https://<owner>.github.io/gym-log-app/`. GitHub Pages serves a project repo
from that subpath, not the domain root, so the build sets
`GITHUB_PAGES=true`, which switches `vite.config.ts`'s `base` (and the PWA
manifest's `start_url`/`scope`/icon paths) to `/gym-log-app/`; every other
build (dev server, `preview`, CI's own `test:e2e`) stays at `/`.

One-time repo setup this workflow depends on: **Settings → Pages → Build
and deployment → Source → "GitHub Actions"** — not done automatically by
pushing this workflow file.

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
