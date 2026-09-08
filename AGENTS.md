# Agent instructions

Read, in order:

1. `docs/requirements.md` — what the app does. The domain model, the twelve
   functional requirements, and the computation rules in here are binding.
2. `docs/agent-brief.md` — build phase order and the definition-of-done
   checklist for every change.
3. `docs/handoff.md` — supersedes `docs/agent-brief.md` on the platform
   decision (PWA, not native) and the storage architecture (hexagonal port,
   two adapters). Read this before touching anything platform- or
   storage-related.
4. `docs/decisions/` — read before revisiting any settled decision.

Note: no separate "application standard" document has been supplied to this
project yet. Until one exists, `docs/agent-brief.md` and `docs/handoff.md`
are the process authority. If a standards document is added later, it
overrides everything above on process and quality questions, per
`docs/agent-brief.md` §0.

Two decisions in `docs/decisions/` override anything `docs/requirements.md`
or `docs/agent-brief.md` say about the platform: this is a PWA, not a native
app, and local storage is a hexagonal port with two adapters (File System
Access API, IndexedDB) selected once per device via feature detection at the
composition root — never inside domain or application code.

This project uses spec-kit. Do not write implementation code for a use case
before it has a `/specify` → `/clarify` → `/plan` → `/tasks` cycle behind it.
