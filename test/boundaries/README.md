# Boundary rule verification (spec 000 FR-008)

The layer-boundary rule (`eslint-plugin-boundaries`, configured from
`eslint.boundaries.js`) is proven by deliberately adding an illegal import
for each forbidden edge — direct and routed through a barrel — confirming
`npm run lint` fails and names it, then removing it. This file records that
procedure and the results observed during Phase 0 implementation
(2026-09-10).

`test/boundaries/edge-set.test.ts` is the automated, permanent guard that
`docs/architecture.md` and `eslint.boundaries.js` stay in agreement
(FR-009/SC-003); this file is the manual, one-time proof that the *runtime
enforcement itself* actually rejects a bad import (SC-002), which an
edge-list comparison alone cannot show.

## Procedure

For each case: create the file with the given content, run
`npx eslint <path>`, confirm it reports a `boundaries/dependencies` error
naming the import, then delete the probe file.

## Direct imports (forbidden edges)

| # | From → To | Probe file | Import | Result |
|---|---|---|---|---|
| 1 | `domain` → `application-ports` | `src/domain/__p.ts` | `import type { StoragePort } from '../application/ports/storage-port'` | ✅ FAILED — "no policy allowing dependencies from elements of type 'domain' to elements of type 'application-ports'" |
| 2 | `presentation` → `infrastructure` | `src/presentation/__p.tsx` | `import { INFRASTRUCTURE_LAYER } from '../infrastructure/placeholder'` | ✅ FAILED — same error shape, `presentation` → `infrastructure` |
| 3 | `shared` → `application-ports` | `src/shared/__p.ts` | `import type { StoragePort } from '../application/ports/storage-port'` | ✅ FAILED |
| 4 | `presentation-design` → `application-ports` | `src/presentation/design/__p.ts` | `import type { StoragePort } from '../../application/ports/storage-port'` | ✅ FAILED |

## Barrel-routed imports (same forbidden edges, via `src/application/index.ts`)

| # | From → To | Probe file | Import | Result |
|---|---|---|---|---|
| 5 | `domain` → `application` (barrel) | `src/domain/__p.ts` | `import type { StoragePort } from '../application'` | ✅ FAILED — the barrel path does not bypass the rule |
| 6 | `shared` → `application` (barrel) | `src/shared/__p.ts` | `import type { StoragePort } from '../application'` | ✅ FAILED |

## Legal imports (control — must pass)

| # | From → To | Probe file | Import | Result |
|---|---|---|---|---|
| 7 | `presentation` → `application` (barrel) | `src/presentation/__p.tsx` | `import type { StoragePort } from '../application'` | ✅ PASSED |
| 8 | `infrastructure` → `application-ports` | `src/infrastructure/__p.ts` | `import type { StoragePort } from '../application/ports/storage-port'` | ✅ PASSED |
| 9 | `composition-root` (`src/presentation/main.tsx`) → `domain` + `infrastructure` + `shared` | `src/presentation/main.tsx` | three imports, one per layer | ✅ PASSED (2026-09-11, after the composition-root fix below) |
| 10 | `presentation` (ordinary file, same folder as the composition root) → `infrastructure` | `src/presentation/other.tsx` | `import { CONSTANT } from '../infrastructure/placeholder'` | ✅ FAILED — confirms the composition-root's broad access does not leak to sibling files |

## Notes

- The boundary rule needs a real import resolver to classify an import —
  see `docs/architecture.md` "Path resolution". Without
  `eslint-import-resolver-typescript` configured, every case above silently
  passes (the import is treated as unresolvable/external and the rule never
  evaluates it). This was caught during Phase 0 implementation precisely by
  running this verification and seeing forbidden imports pass — the
  verification step is load-bearing, not a formality.
- Case 2 required a real file at `src/infrastructure/placeholder.ts` to
  import — an import of a non-existent path also resolves to "unknown" and
  is silently skipped, which looks identical to a working rule from the
  command's exit code alone. Always probe against a file that exists.
- Cases 9/10 caught a second real bug (2026-09-11): a
  `composition-root` **element** descriptor for `src/presentation/main.tsx`
  never actually classifies as `composition-root` — element patterns match
  folders, not files, so `main.tsx` always resolved to plain `presentation`
  regardless of descriptor order, `partialMatch: false`, or `exclusive:
  true`. This was invisible until a real probe against `main.tsx` was run
  (case 9 initially FAILED with "no policy allowing... presentation →
  domain/infrastructure/shared"). Fixed by dropping the element descriptor
  for `composition-root` and instead granting its policy via a file-path
  selector (`from: { file: { path: 'src/presentation/main.tsx' } }`) — see
  `docs/architecture.md` "Composition-root classification" and the inline
  comment in `eslint.boundaries.js`.
