// @ts-check
/**
 * Single source of truth for the dependency-inward layer graph.
 *
 * `eslint.config.js` builds the `boundaries/dependencies` rule from this,
 * and `test/boundaries/edge-set.test.ts` asserts the forbidden-edge set
 * derived here equals the table in `docs/architecture.md`. Change this file
 * and `docs/architecture.md` together, and nothing else, when the layer map
 * changes (constitution Definition of Done; spec FR-023).
 *
 * Layer map (constitution Principle V; docs/agent-brief.md §2):
 *   domain              — entities, value objects, pure rules. Imports nothing internal.
 *   application          — ports, use cases, view models. May import: domain, shared.
 *   application-ports    — the port interfaces (a slice of application, called out
 *                          so tests and infra can name it). May import: domain only —
 *                          narrower than application (spec 001: the port stays a pure
 *                          domain-terms interface, with no dependency on shared utilities
 *                          an adapter or use case might use).
 *   infrastructure       — port implementations. May import: application(-ports), domain.
 *   presentation         — screens/UI consuming view models. May import: application(-ports),
 *                          presentation-design.
 *   presentation-design  — design tokens & primitives. Imports nothing internal.
 *   shared               — cross-cutting utilities with no business concept.
 *                          Imports nothing internal.
 *   composition-root     — the single wiring point (src/presentation/main.tsx).
 *                          May import: everything.
 *
 * `application` → `shared` added by spec 001 (`src/application/logging/ids.ts`
 * wraps `shared/id.ts`'s unbranded `newId()` with domain-branded casts) —
 * the first real consumer `shared/` has had since it was scaffolded empty
 * in Phase 0. `application-ports` deliberately does NOT gain the same
 * edge: `storage-port.ts` states its contract in domain terms alone, with
 * no reason to reach into `shared/`.
 *
 * `composition-root` is NOT one of the `elements` descriptors below:
 * eslint-plugin-boundaries' element patterns match folders (path prefixes),
 * not individual files — a `pattern: 'src/presentation/main.tsx'` descriptor
 * never wins over the broader `src/presentation` folder pattern it's nested
 * inside, so `main.tsx` would classify as plain `presentation` regardless
 * (confirmed by direct probe; `exclusive`/`partialMatch: false` do not
 * change this, since the mismatch is that a *folder* matcher never yields
 * to a more specific *file* pattern nested inside it). Instead,
 * `dependencyPolicies()` below grants `main.tsx` its "may import everything"
 * policy via a file-path selector (`from: { file: { path } }`), independent
 * of element classification. `composition-root` stays in `allowedImports`
 * and `forbiddenEdges()` purely as the documented/tested edge-set entry
 * (docs/architecture.md, test/boundaries/edge-set.test.ts).
 *
 * COMPOSITION_ROOT_PATH is that same file's path (Micromatch pattern).
 */
export const COMPOSITION_ROOT_PATH = 'src/presentation/main.tsx';

/**
 * Element descriptors for `settings['boundaries/elements']`. Order matters:
 * the design sub-layer is matched before the broader `presentation`
 * pattern; `ports` before the broader `application` pattern.
 *
 * @type {{ type: string, pattern: string | string[] }[]}
 */
export const elements = [
  { type: 'presentation-design', pattern: 'src/presentation/design' },
  { type: 'presentation', pattern: 'src/presentation' },
  { type: 'application-ports', pattern: 'src/application/ports' },
  { type: 'application', pattern: 'src/application' },
  { type: 'infrastructure', pattern: 'src/infrastructure' },
  { type: 'domain', pattern: 'src/domain' },
  { type: 'shared', pattern: 'src/shared' },
];

/**
 * What each element type is ALLOWED to import (in addition to its own type —
 * intra-layer imports are always allowed). Anything not listed is forbidden
 * by the rule's `default: 'disallow'`.
 *
 * @type {Record<string, string[]>}
 */
export const allowedImports = {
  domain: [],
  application: ['application-ports', 'domain', 'shared'],
  'application-ports': ['domain'],
  infrastructure: ['application', 'application-ports', 'domain'],
  // NOT application-ports: presentation must never see a persistence type
  // (StoragePort et al.) directly — only application's use cases/view
  // models, which is what actually calls the port. See the port contract's
  // own JSDoc (src/application/ports/storage-port.ts) and
  // docs/development-principles.md.
  presentation: ['application', 'presentation-design'],
  'presentation-design': [],
  shared: [],
  'composition-root': [
    'domain',
    'application',
    'application-ports',
    'infrastructure',
    'presentation',
    'presentation-design',
    'shared',
  ],
};

// Derived from allowedImports, not `elements`: composition-root is a
// documented/tested type (edge-set table, forbidden-edge set) but is not an
// `elements` descriptor — see the note on COMPOSITION_ROOT_PATH above.
const allTypes = Object.keys(allowedImports);

/**
 * The forbidden-edge set: every (from, to) pair that is NOT allowed
 * (excluding from === to, which is always allowed). This is what
 * `test/boundaries/edge-set.test.ts` compares against docs/architecture.md.
 *
 * @returns {{ from: string, to: string }[]}
 */
export function forbiddenEdges() {
  /** @type {{ from: string, to: string }[]} */
  const edges = [];
  for (const from of allTypes) {
    const allowed = new Set([from, ...(allowedImports[from] ?? [])]);
    for (const to of allTypes) {
      if (!allowed.has(to)) edges.push({ from, to });
    }
  }
  return edges;
}

/**
 * `policies` for the `boundaries/dependencies` rule. One allow-policy per
 * source type listing the target types it may import (its own type plus
 * `allowedImports[type]`); the rule's `default: 'disallow'` forbids the
 * rest. The rule runs with `checkInternals: true` (eslint.config.js) so
 * that same-element ("internal") dependencies are policy-checked too — that
 * is what lets the final disallow entry below actually fire for a
 * `presentation` sibling importing the composition root; without
 * `checkInternals`, the plugin would skip that pair before policies ever
 * run, because both files classify as the same element type. This also
 * means every type's own-type target must now be listed explicitly (it is
 * no longer given for free).
 *
 * `composition-root` is not an `elements` descriptor (see the note above),
 * so its policy is keyed on a file-path selector matching
 * COMPOSITION_ROOT_PATH exactly instead of an element type — this is what
 * actually grants src/presentation/main.tsx its "may import everything"
 * permission, independent of how that file classifies as an element
 * (it classifies as plain `presentation`).
 *
 * The final entry is a universal disallow (no `from`, applies to every
 * source) blocking any import of COMPOSITION_ROOT_PATH — the composition
 * root may be the app's entry point only, never a module another file
 * (including a `presentation` sibling) pulls in for its exports; doing so
 * would run its mount/service-worker side effects. It is listed last so it
 * overrides the `presentation` self-import allow above for this one
 * target file (policies are evaluated in order and the last match wins).
 *
 * @returns {({ from: { element: { type: string } }, allow: { to: { element: { type: string } } }[] } | { from: { file: { path: string } }, allow: { to: { element: { type: string } } }[] } | { disallow: { to: { file: { path: string } } } })[]}
 */
export function dependencyPolicies() {
  /** @type {({ from: { element: { type: string } }, allow: { to: { element: { type: string } } }[] } | { from: { file: { path: string } }, allow: { to: { element: { type: string } } }[] })[]} */
  const allowPolicies = allTypes.map((from) => ({
    from:
      from === 'composition-root'
        ? { file: { path: COMPOSITION_ROOT_PATH } }
        : { element: { type: from } },
    allow: [from, ...(allowedImports[from] ?? [])].map((to) => ({
      to: { element: { type: to } },
    })),
  }));

  return [
    ...allowPolicies,
    { disallow: { to: { file: { path: COMPOSITION_ROOT_PATH } } } },
  ];
}
