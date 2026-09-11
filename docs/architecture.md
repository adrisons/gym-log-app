# Architecture

The layer map and the dependency-inward rule (constitution Principle V;
`docs/development-principles.md` §3; `docs/agent-brief.md` §2). This
document and `eslint.boundaries.js` (which the enforcement in
`eslint.config.js` is built from) MUST describe the same rule — a test
(`test/boundaries/edge-set.test.ts`) asserts they do, so a change to the
layer map updates both files in the same change (spec 000 FR-023).

## Layers

```
domain          entities, value objects, pure rules (no I/O, no framework)
application     ports, use cases, session state, view models, error policy
  ports         the port interfaces specifically (a named slice, so tests
                and infrastructure can refer to it without pulling in the
                rest of application)
infrastructure  storage adapters (File System Access, IndexedDB), platform APIs
presentation    screens and UI; consumes view models
  design        tokens, primitives, compositions, root
shared          cross-cutting utilities with no business concept
```

Dependencies point inward only. A layer never imports from a layer further
out; `presentation` in particular never imports a persistence type directly.
Every boundary crossing that needs an external capability goes through a
port (constitution Principle IV). Exactly one composition point
(`src/presentation/main.tsx`) wires infrastructure to application — it is
the only file allowed to import across every layer.

## Forbidden-edge table

The enumerable form the enforcement is checked against
(`test/boundaries/edge-set.test.ts`). "From" MUST NOT import "To". Every
pair of element types not listed here, and not an intra-layer import (from
= to, always allowed), is also forbidden by the rule's `default: disallow` —
this table is generated from `eslint.boundaries.js`'s `allowedImports`, not
maintained by hand independently of it.

| From | Allowed to import | Everything else is forbidden |
|---|---|---|
| `domain` | (nothing internal) | `application`, `application-ports`, `infrastructure`, `presentation`, `presentation-design`, `shared`, `composition-root` |
| `application` | `domain`, `application-ports`, `shared` | `infrastructure`, `presentation`, `presentation-design`, `composition-root` |
| `application-ports` | `domain` | `application`, `infrastructure`, `presentation`, `presentation-design`, `shared`, `composition-root` |
| `infrastructure` | `application`, `application-ports`, `domain` | `presentation`, `presentation-design`, `shared`, `composition-root` |
| `presentation` | `application`, `presentation-design` | `application-ports`, `infrastructure`, `domain`, `shared`, `composition-root` |
| `presentation-design` | (nothing internal) | everything else, including the rest of `presentation` |
| `shared` | (nothing internal) | everything else |
| `composition-root` (`src/presentation/main.tsx`) | all layers | — the single wiring point |

`shared` is deliberately not a backdoor between layers: it may import
nothing internal, and that restriction is enforced the same way (direct and
barrel-routed imports both fail) as every other edge.

`application` → `shared` (spec 001, `specs/001-log-a-session/research.md`
§2) is `shared`'s first real consumer — Phase 0 scaffolded the layer empty,
with no edge granted to it yet. `src/application/logging/ids.ts` wraps
`shared/id.ts`'s unbranded `newId()` with `domain`-branded casts.
`application-ports` deliberately does not gain the same edge: the port
states its contract in domain terms alone (ADR-0002), with no reason to
reach into `shared/`.

## Verification

Per spec 000 FR-008: the rule is proven, not just documented, by adding a
deliberate illegal import for each forbidden edge — once as a direct import,
once routed through a barrel (`src/application/index.ts`) — confirming
`npm run lint` fails and names the import, then removing it. Done by hand
during Phase 0 implementation; the observed results are recorded in
`test/boundaries/README.md`.

## Path resolution

`eslint-plugin-boundaries` classifies an import by resolving it to a real
file first (via `eslint-module-utils/resolve`, configured through
`settings['import/resolver']` in `eslint.config.js`, using
`eslint-import-resolver-typescript`). Without a resolver that understands
extensionless TypeScript imports and the `@/*` path alias, an import is
treated as "external" or "unknown" and the rule never evaluates it — this is
why `eslint-plugin-import` + `eslint-import-resolver-typescript` are
installed alongside `eslint-plugin-boundaries` (`docs/stack.md`).

## Composition-root classification

`eslint-plugin-boundaries` element descriptors (`settings['boundaries/elements']`)
match **folders** (path prefixes), not individual files — a descriptor like
`{ type: 'composition-root', pattern: 'src/presentation/main.tsx' }` never
wins over the broader `src/presentation` folder pattern it's nested inside,
so the file would classify as plain `presentation` regardless of descriptor
order, `partialMatch: false`, or `exclusive: true` (confirmed by direct
probe against the plugin's matcher). Because of this, `composition-root` is
**not** one of the `elements` descriptors in `eslint.boundaries.js` at all.
Instead, its "may import everything" policy is granted through a
`boundaries/dependencies` policy keyed on a **file-path selector**
(`from: { file: { path: 'src/presentation/main.tsx' } }`) rather than an
element-type selector — independent of how the file classifies as an
element. `composition-root` still appears in the forbidden-edge table above
and in `allowedImports`/`forbiddenEdges()` purely as the documented/tested
edge-set entry; `eslint.boundaries.js` has the full explanation inline.

## Design tokens

Design tokens (`src/presentation/design/tokens.css` + `tokens.ts`) are the
only source of visual values (constitution Principle V;
`docs/development-principles.md` §5) — no literal colour, radius, duration,
easing, or spacing value appears anywhere else in `src/`. See
`docs/testing.md` for the interactive-element state convention that uses
the Focus ring token, and `docs/design.md` §3.1 for the full token role
list.
