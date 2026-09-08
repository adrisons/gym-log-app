# Agent brief: build the application

Hand this to the AI agent together with `requirements.md` and the application
standard. It defines the order of work, what is not negotiable, and what the
agent must escalate instead of deciding.

---

## 0. Working contract

You are the agent building this application. You work from three documents:

1. **The application standard** — how things are built. It overrides everything
   else.
2. **`requirements.md`** — what the application does.
3. **The repository's ADRs** — why it is the way it is.

Contract rules:

- When the standard and a concrete request conflict, **stop and surface the
  conflict**. Do not resolve it silently.
- Do not invent technologies. If the stack is undecided, propose an ADR and wait.
- Do not expand scope. The non-goals in §1.3 of the requirements are binding; a
  good idea outside scope is written down as a proposal, not implemented.
- One concern per commit; short imperative messages referencing the ADR or
  requirement involved.
- Prefer deleting code to adding it, and a local helper to a new dependency.

---

## 1. Before the first line of code

Three decisions are already closed and go straight into ADRs:

- **ADR-0001** — project language: English for code, identifiers, comments,
  commits and docs. No mixing.
- **ADR-0002** — cross-platform: one shared codebase targeting iOS and Android.
  The framework itself is still to be proposed and approved.
- **ADR-0003** — effort: RPE 1–10 in half-point steps as the stored canonical
  value; RIR available as an input mode, converted on entry.

Close D4–D7 with the project owner, then build the documentation scaffolding:

- `docs/decisions/` with one ADR per closed decision. Format: context, decision,
  consequences (positive, negative, neutral), date.
- `docs/stack.md`: one tool per concern (framework, state, storage, charts,
  navigation, tests, lint, formatting) plus an explicit list of what may not be
  added without an ADR.
- `docs/architecture.md`: the layer map and the dependency-inward rule.
- `docs/design.md`: visual criteria, colour roles, scales.
- `docs/testing.md`: the pyramid, shared doubles, how a test is written here.
- `README.md` for setup and usage, kept separate from the above.

**Do not write product code until the CI gate exists** (typecheck + tests +
lint) and the layer-boundary rule genuinely fails on an illegal import. Verify
it with a deliberate illegal import that must break the build, and check the
barrel-import path too.

---

## 2. Layers

Names are indicative; the boundaries and the direction of dependencies are what
bind.

```
src/
  domain/          entities, value objects, pure rules (no I/O, no framework)
  application/     ports, use cases, session state, view models, error policy
  infrastructure/  storage, files, platform APIs — implements the ports
  presentation/    screens and UI; consumes view models
    design/        tokens, primitives, compositions, root
  shared/          cross-cutting utilities with no business concept
docs/
```

- Presentation never imports persistence types.
- A single composition point wires infrastructure to the application.
- Every boundary crossing goes through a port.

---

## 3. Order of work

Each phase ends with typecheck, tests and lint green, and with the affected
documentation updated. Do not start a phase before closing the previous one.

### Phase 0 — Scaffolding

Repository, stack, design tokens (light and dark), CI gate, boundary rules,
shared test doubles, integration harness. No screens.

**Deliverable:** an empty app that launches, with a smoke test and a red build on
a layer violation.

### Phase 1 — Domain and ports

Entities, value objects (Load, Volume, Effort), the rules in §3.3 and every
computation in §5 of the requirements, with exhaustive unit tests. Ports defined
and in-memory fakes working. No real I/O, no UI.

**Deliverable:** complete business rules, tested without touching disk.

### Phase 2 — Persistence

Port implementations, schema version, migrate/refuse behaviour, launch
reconciliation and regeneration of derived data. Integration tests against real
storage, including a simulated migration.

### Phase 3 — Logging (FR-1 to FR-5)

The critical path first. Optimistic UI, deferred persistence, undo, numeric
keypad, duplicate-previous-set. Measure and record the number of taps needed to
log a set.

### Phase 4 — Diary, search and progression (FR-6 to FR-8)

Derived, rebuildable search index. Chart with metric and range selectors. Honest
degradation for non-numeric loads.

### Phase 5 — Insights (FR-9)

Deterministic rules from §5 only, with their sufficiency thresholds. Every card
type ships tests covering the case with data, the case just below the threshold,
and the case with no data. Incremental recomputation, off the interaction path.

### Phase 6 — Body composition (FR-10)

Logging, derived kg values, charts with moving average. Neutral tone: no targets,
no alarms.

### Phase 7 — Settings, data, closing (FR-11, FR-12)

Export and import with preview and rejection of newer schema versions. Full
accessibility audit against §7.4. Performance measured against §7.1, before and
after any optimisation.

---

## 4. Definition of done, per change

Before calling any change finished, confirm:

- [ ] Typecheck, tests and lint pass locally and in CI.
- [ ] Every new behaviour has at least one test; every fix has a test that failed
      before and passes now.
- [ ] No dependency has slipped in that overlaps one already present.
- [ ] No literal visual value outside the tokens.
- [ ] New interactive elements ship every state: rest, hover, pressed,
      focus-visible, disabled with a reason, loading.
- [ ] Every animation names an exact duration token and an exact easing token.
- [ ] Reviewed on both platforms and in both themes.
- [ ] Schema or architecture change → ADR written.
- [ ] Documents describing what you changed are updated in the same change.
- [ ] No typing escape hatches; if one was unavoidable, it is local, loud and
      commented with its reason.

---

## 5. What to escalate instead of deciding

Stop and ask when you hit:

- Anything involving an outbound call or telemetry.
- A feature that only works online.
- A change to the persisted format or the storage layout.
- A second library for a concern already covered.
- An insight that cannot be expressed as a deterministic rule.
- A request that falls under the non-goals.
- Any slowdown of the logging path.

---

## 6. Kick-off prompt, ready to copy

> You are going to build a cross-platform mobile training-diary app (iOS and
> Android, one codebase). Attached are three documents: the application standard
> (how it is built), the functional requirements (what it does) and this brief
> (in what order, and what you do not get to decide).
>
> Three decisions are already closed and go into ADRs: English as the single
> project language for every artifact; cross-platform from a shared codebase;
> RPE 1–10 in half-point steps as the stored effort value, with RIR as an input
> mode.
>
> Start with Phase 0. Before writing a line of product code:
>
> 1. Give me your recommendation for decisions D4–D7 in the requirements, with
>    reasoning and the consequences of each option.
> 2. Propose the stack document: one tool per concern — starting with the
>    cross-platform framework — plus the list of what is forbidden without an
>    ADR.
> 3. Wait for my approval before creating the repository.
>
> Do not expand scope, do not invent technologies, and do not break any of the
> three invariants. If anything I ask conflicts with the standard, stop and tell
> me instead of resolving it yourself.
