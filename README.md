# gym-log

A personal training diary. Log a session — blocks, exercises, sets, load,
effort — in a few taps, and see your progression and trend-based insights
over time.

## Principles

- **Your data stays on your device.** No account, no backend, nothing sent
  anywhere. Everything is exportable in an open format.
- **Logging always works, instantly, offline.** No Save button, no waiting.
- **Insights are computed, not generated.** Every trend shown is a
  deterministic calculation over your own data, documented in
  `docs/requirements.md`.

## Status

Early. This repository currently defines *what* the app does — the domain
model, functional requirements, and design criteria. Concrete technology and
platform choices come later, in a dedicated technical-planning phase, and
follow a spec-driven workflow (see `.specify/`) starting from the logging
critical path.

## Documentation

- [`docs/requirements.md`](docs/requirements.md) — what the app does
- [`docs/design.md`](docs/design.md) — visual and interaction design criteria
- [`docs/development-principles.md`](docs/development-principles.md) — general engineering practices, independent of technology
- [`docs/agent-brief.md`](docs/agent-brief.md) — build order and definition of done
- [`docs/handoff.md`](docs/handoff.md) — background on the project's process; its concrete platform/architecture mandates are currently deferred (see the note at its top)
- `docs/decisions/` — architecture decision records
