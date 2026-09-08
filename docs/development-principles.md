# Development principles

General engineering practices this project follows, independent of any
concrete technology choice. These are practices, not decisions — they say
*how* to structure code once a technical plan exists, never *which*
platform, framework, or storage mechanism to use. Technology choices belong
to `/speckit-plan` and their own ADRs, at a later phase than this document.

Binding for agents: read this before proposing or reviewing any code
structure, before writing a `/speckit-plan`, and before implementing tasks.

## 1. Separate domain from implementation

The rules that define what the application *is* — what a Session, a Set, a
Load, an Effort mean, and what is true about them (`docs/requirements.md`
§3, §5) — must be expressible and testable without any framework, database,
file system, or network call in the picture. If a rule cannot be tested by
constructing plain values and asserting on the result, it has picked up an
implementation dependency it does not need.

Practically: domain logic lives in code that imports nothing from a UI
framework, a storage library, or a platform API. It is the innermost layer;
everything else depends on it, and it depends on nothing.

## 2. Put every external dependency behind a port

Anything the domain or application needs from outside itself — persisting
data, reading a file, calling a platform capability — is expressed first as
an interface stated in domain terms (what is needed), not in terms of a
specific mechanism (how it happens to be provided today). The concrete
implementation is written against that interface, not the other way around.

This buys three things:

- **The domain stays technology-agnostic.** Swapping what is behind a port
  never requires touching the code that uses it.
- **Everything above a port is testable with a fake.** An in-memory
  implementation of the same interface, built for tests, exercises every
  use case and every scenario without any real external system involved.
- **A capability check for "which implementation is active" never appears
  outside the one place that chooses it.** If a rule, a use case, or a view
  needs to branch on which concrete implementation is behind a port, the
  port's boundary has leaked. The choice of implementation is made in
  exactly one place — the point where the application is assembled — and
  nowhere else.

This is the general shape sometimes called "ports and adapters": the
application defines what it needs; adapters satisfy that need. It applies
to any external dependency, not just storage — a notification mechanism, a
file export target, a device capability, are all candidates for the same
treatment when the time comes to build them.

## 3. Layer dependencies in one direction only

Code is organized in layers, and dependencies point inward only:

```
domain  ←  application  ←  infrastructure
              ↑
        presentation
```

- **Domain**: entities, value objects, pure rules. No I/O, no framework.
- **Application**: use cases, ports (see §2), orchestration, view-facing
  logic.
- **Infrastructure**: concrete implementations of the ports defined by the
  application layer.
- **Presentation**: what the user sees and interacts with. It consumes
  view-level output from the application layer and never reaches past it
  into infrastructure or domain internals directly.

A layer never imports from a layer further out. Presentation in particular
never imports a persistence type directly — it only ever sees what the
application layer chooses to expose to it.

## 4. Keep derived data rebuildable

Anything computed from canonical records — a search index, an aggregate, a
cached chart series — must be safely deletable and reconstructable from
those canonical records alone, with no information loss. This is what makes
a derived-data bug a non-emergency: delete it and rebuild it. Treat any
derived structure that cannot be regenerated this way as a design mistake to
fix, not a constraint to work around.

## 5. Values behind names, not literals

Visual and numeric constants that express a design decision (a color, a
spacing value, a timing) are named and centralized, never hardcoded at the
point of use. A literal value repeated at its use site is a sign the
decision it encodes has not actually been made — see `docs/design.md`.

## 6. One dependency per concern

Before adding a library or external tool, check whether an existing one
already covers the same concern. Two answers to the same problem are a
maintenance cost with no offsetting benefit; prefer extending what is
already used, or writing a small local helper, over introducing a second
option. A second library for a concern already covered by an existing one
is escalated, not decided unilaterally (see the project constitution's
Escalation section).

## 7. Write the behavior before the code that implements it

A feature's expected behavior — described as concrete scenarios in the
domain's own language — is written and agreed before its implementing code.
This keeps "what must be true" separate from "how it happens to be built
today," and gives every later technical choice something stable to be
verified against.

## 8. Prefer deleting code to adding it

When a rule, a component, or a dependency is no longer needed, remove it
completely rather than leaving it disabled, commented out, or aliased for
backward compatibility. An unused code path is not a safety net; it is a
question a future reader has to answer for no benefit.
