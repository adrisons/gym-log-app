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

Early. Platform and architecture are decided (a PWA with a two-adapter
storage port — see ADR-0002); the concrete framework and adapter libraries
are not yet, and are chosen through a spec-driven workflow (see `.specify/`)
starting from the logging critical path.

## Documentation

- [`docs/requirements.md`](docs/requirements.md) — what the app does
- [`docs/design.md`](docs/design.md) — visual and interaction design criteria
- [`docs/development-principles.md`](docs/development-principles.md) — general engineering practices, independent of technology
- [`docs/agent-brief.md`](docs/agent-brief.md) — build phase order and pre-code scaffolding
- [`.specify/memory/constitution.md`](.specify/memory/constitution.md) — core principles, workflow, definition of done
- `docs/decisions/` — architecture decision records
