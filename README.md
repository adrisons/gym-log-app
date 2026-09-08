# gym-log

A personal training diary, installable as a PWA on mobile and desktop. Log a
gym session — blocks, exercises, sets, load, effort — in a few taps, and see
your progression and trend-based insights over time.

## Principles

- **Your data stays on your device.** No account, no backend, nothing sent
  anywhere. Data lives as local files via the File System Access API where the
  browser supports it, or in IndexedDB otherwise (notably iOS Safari) — the
  app picks automatically and both are full-featured.
- **Logging always works, instantly, offline.** No Save button, no waiting.
- **Insights are computed, not generated.** Every trend shown is a
  deterministic calculation over your own data, documented in
  `docs/requirements.md`.

## Status

Early. Requirements and architecture are defined; implementation follows a
spec-driven workflow (see `.specify/`) starting from the logging critical path.

## Documentation

- [`docs/requirements.md`](docs/requirements.md) — what the app does
- [`docs/agent-brief.md`](docs/agent-brief.md) — build order and definition of done
- [`docs/handoff.md`](docs/handoff.md) — PWA platform decision and hexagonal/BDD architecture mandate (supersedes the native-app decision in `agent-brief.md`)
- `docs/decisions/` — architecture decision records
