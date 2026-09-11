# Phase 0 Data Model

Phase 0 introduces **no domain entity and no persisted schema** — those are
Phase 1 and Phase 2. What it does define is two structural artifacts the
later phases build on: the storage **port interface** and the **design-token
set**. Both are recorded here so `/speckit-tasks` has a concrete target.

## 1. Storage port interface (`application/ports/storage-port.ts`)

A first version, written in domain terms per ADR-0002. **Phase 1 owns it and
may reshape it** as the domain takes form — Phase 0 only needs a real
interface so the in-memory fake (FR-014) and the integration harness
(FR-016) have something to satisfy and wire.

Shape (illustrative — exact method set is refined in Phase 1 against the
`docs/requirements.md` §3 entities):

| Operation | Intent (domain terms) | Notes |
|---|---|---|
| `saveSession(session)` | persist a training session and its blocks/entries/sets | optimistic-write friendly (Principle II) |
| `getSession(id)` | load one session by identity | |
| `listSessions(range)` | load sessions whose date-time falls in a range | range is a value object, not SQL |
| `deleteSession(id)` | remove a session | |
| `saveExercise(exercise)` / `getExercise(id)` / `listExercises()` | catalogue reads/writes | catalogue itself is Phase 1 |
| `getSchemaVersion()` / `setSchemaVersion(v)` | the version that travels with the data (`docs/requirements.md` §6) | migrate/refuse logic is Phase 2 |
| `exportAll()` / `importAll(payload)` | the interchange format (FR-12) | Phase 7; interface placeholder only |

Rules the interface must respect (from the constitution and ADR-0002):

- Stated in **domain vocabulary**, never storage vocabulary — no "table",
  "row", "transaction", "IndexedDB", "file handle" in the interface.
- No method returns or accepts an infrastructure type.
- The interface lives in `application/`; `domain/` does not import it,
  `infrastructure/` implements it, `presentation/` never sees it.
- Every method is exercised by the in-memory fake in a Phase 0 test
  (`test/unit/storage-port-fake.test.ts`).

**In-memory fake** (`test/support/in-memory-storage.ts`): a `Map`-backed
implementation of the same interface. No real storage API. Deterministic.
Resettable between tests. This is the third implementation named in
ADR-0002 (alongside the two Phase 2 adapters).

## 2. Design-token set (`presentation/design/tokens.css` + `tokens.ts`)

The complete expected set (FR-018/FR-019). A token **missing** from this
list is the failure; a token present with a provisional value is fine.

### Colour roles (from `docs/design.md` §3.1) — defined for light and dark

| Token role | Purpose |
|---|---|
| `--color-canvas` | app background, lowest layer |
| `--color-surface` | panels, cards |
| `--color-surface-raised` | the active input row, raised surfaces |
| `--color-foreground` | primary text |
| `--color-foreground-muted` | secondary text (still meets contrast) |
| `--color-foreground-subtle` | tertiary text |
| `--color-border` | hairline dividers |
| `--color-border-strong` | region dividers |
| `--color-accent` | primary action / current selection |
| `--color-accent-foreground` | text/icon on accent |
| `--color-focus-ring` | focus indication only (serves the focus-visible state, FR-024) |
| `--color-danger` | status only, paired with icon/word |
| `--color-warning` | status only, paired with icon/word |
| `--color-success` | status only, paired with icon/word |

No `--color-encouragement` / `--color-alarm` — body-composition figures use
the neutral roles only (`docs/design.md` §3.1; `docs/requirements.md` FR-10).

### Non-colour token categories (from `docs/design.md` §1.2)

| Category | Contents (names; values may be provisional) |
|---|---|
| Radii | `--radius-sm`, `--radius-md`, `--radius-lg` — gentle rounding on interactive surfaces (`docs/design.md` §1.2) |
| Durations | `--duration-instant`, `--duration-short`, `--duration-medium` — named categories, not magic numbers (`docs/design.md` rule 2) |
| Easings | `--easing-standard`, `--easing-decelerate`, `--easing-accelerate` — named behaviours |
| Spacing | `--space-1` … `--space-6` (or a named scale) — spacing roles, not literals (`docs/development-principles.md` §5) |

### Theme mechanism

- `:root` carries the light values.
- Dark values under `@media (prefers-color-scheme: dark)` **and** a
  `:root[data-theme="dark"]` override, so an explicit user choice (a future
  Settings toggle, FR-11) and the OS default both work, per `docs/design.md`
  §3.2 ("both themes first-class, defined together").
- `tokens.ts` exports the token **names** as a typed union so
  (a) FR-019's "every token present" is checkable against the union, and
  (b) a lint rule can flag any hex/rgb/hsl literal outside `tokens.css`
  (SC-007).

## 3. Layer graph (for `docs/architecture.md` and the boundary config)

Forbidden-edge table (FR-009) — the enforced config must reject exactly
this set:

| From | May import | MUST NOT import |
|---|---|---|
| `domain` | (nothing internal) | `application`, `infrastructure`, `presentation`, `shared` |
| `application` | `domain` | `infrastructure`, `presentation` |
| `infrastructure` | `application`, `domain` | `presentation` |
| `presentation` | `application`, `presentation/design` | `infrastructure`, `domain` internals* |
| `presentation/design` | (nothing internal) | `application`, `infrastructure`, `domain` |
| `shared` | (nothing internal) | `domain`, `application`, `infrastructure`, `presentation` |
| composition root (`presentation/main.tsx`) | all layers | — (the single wiring point, Principle V) |

\* `presentation` consumes view models the application layer exposes; it
does not reach into `domain` entity internals. The exact allowance
(view-model types only) is finalized with Phase 1.

The check comparing the enforced edge set to this table lives in
`test/boundaries/` (FR-009, SC-003).
