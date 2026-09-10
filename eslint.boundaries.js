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
 *   application          — ports, use cases, view models. May import: domain.
 *   application-ports    — the port interfaces (a slice of application, called out
 *                          so tests and infra can name it). Same rules as application.
 *   infrastructure       — port implementations. May import: application(-ports), domain.
 *   presentation         — screens/UI consuming view models. May import: application(-ports),
 *                          presentation-design.
 *   presentation-design  — design tokens & primitives. Imports nothing internal.
 *   shared               — cross-cutting utilities with no business concept.
 *                          Imports nothing internal.
 *   composition-root     — the single wiring point (src/presentation/main.tsx).
 *                          May import: everything.
 */

/**
 * Element descriptors for `settings['boundaries/elements']`. Order matters:
 * the composition root (a single file) and the design sub-layer are matched
 * before the broader `presentation` pattern; `ports` before the broader
 * `application` pattern.
 *
 * @type {{ type: string, pattern: string | string[], mode?: 'file' | 'folder' }[]}
 */
export const elements = [
  { type: 'composition-root', pattern: 'src/presentation/main.tsx' },
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
  application: ['application-ports', 'domain'],
  'application-ports': ['domain'],
  infrastructure: ['application', 'application-ports', 'domain'],
  presentation: ['application', 'application-ports', 'presentation-design'],
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

const allTypes = elements.map((e) => e.type);

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
 * source type listing the target types it may import; the rule's
 * `default: 'disallow'` forbids the rest. Intra-layer imports (from === to)
 * are permitted by the plugin without an explicit policy.
 *
 * @returns {{ from: { element: { type: string } }, allow: { to: { element: { type: string } } }[] }[]}
 */
export function dependencyPolicies() {
  return allTypes
    .filter((from) => (allowedImports[from] ?? []).length > 0)
    .map((from) => ({
      from: { element: { type: from } },
      allow: (allowedImports[from] ?? []).map((to) => ({
        to: { element: { type: to } },
      })),
    }));
}
