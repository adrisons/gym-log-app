import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { token } from '../../src/presentation/design/tokens';
import type { TokenName } from '../../src/presentation/design/tokens';

// Spec 000 FR-019 / data-model.md §2: every token role listed there must be
// (a) present in the TokenName union (tokens.ts) and (b) declared in both a
// light and a dark selector in tokens.css. A token present with a
// provisional value is fine; a token *missing* is the failure this guards.

const TOKENS_CSS = resolve(
  __dirname,
  '../../src/presentation/design/tokens.css',
);

// The full expected set, mirroring data-model.md §2 exactly. `as const`
// gives each entry a literal type (not widened to `string`) so the
// compile-time equality assertion against TokenName below is meaningful.
const EXPECTED_COLOR_TOKENS = [
  '--color-canvas',
  '--color-surface',
  '--color-surface-raised',
  '--color-foreground',
  '--color-foreground-muted',
  '--color-foreground-subtle',
  '--color-border',
  '--color-border-strong',
  '--color-accent',
  '--color-accent-foreground',
  '--color-focus-ring',
  '--color-danger',
  '--color-warning',
  '--color-success',
] as const;

const EXPECTED_NON_COLOR_TOKENS = [
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--duration-instant',
  '--duration-short',
  '--duration-medium',
  '--easing-standard',
  '--easing-decelerate',
  '--easing-accelerate',
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--space-5',
  '--space-6',
] as const;

// Typography tokens — docs/design.md §1.2. Unlike color, these don't vary
// by theme, so they're expected in the light :root block only, never
// duplicated into the dark/light-override blocks below.
const EXPECTED_TYPE_TOKENS = ['--font-ui', '--font-mono'] as const;

const ALL_EXPECTED_TOKENS: readonly string[] = [
  ...EXPECTED_COLOR_TOKENS,
  ...EXPECTED_NON_COLOR_TOKENS,
  ...EXPECTED_TYPE_TOKENS,
];

/** The literal union of every name in the fixture above, for the
 * compile-time equality assertion against TokenName. */
type ExpectedTokenName =
  | (typeof EXPECTED_COLOR_TOKENS)[number]
  | (typeof EXPECTED_NON_COLOR_TOKENS)[number]
  | (typeof EXPECTED_TYPE_TOKENS)[number];

/**
 * Compile-time bidirectional type equality: true only if A and B have
 * exactly the same members (neither is a strict subset of the other).
 * Standard distributive-conditional trick — see
 * https://github.com/Microsoft/TypeScript/issues/27024#issuecomment-421529650.
 */
type TypesAreEqual<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

// If TokenName and ExpectedTokenName ever diverge (a token added to one but
// not the other), this line fails to typecheck — `npm run typecheck` is
// part of the mandatory CI gate, so a mismatch cannot land unnoticed even
// though this line makes no runtime assertion by itself.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _tokenNameMatchesFixture: TypesAreEqual<TokenName, ExpectedTokenName> =
  true;

/**
 * Splits tokens.css into its selector blocks (`:root { ... }`,
 * `@media (prefers-color-scheme: dark) { :root { ... } }`,
 * `:root[data-theme="dark"] { ... }`) and returns the set of custom
 * property names declared inside each top-level `:root`-ish block.
 */
function parseSelectorBlocks(
  css: string,
): { selector: string; names: Set<string> }[] {
  const blocks: { selector: string; names: Set<string> }[] = [];
  // Match `:root ... { ... }` and `@media (...) { :root { ... } }` blocks by
  // finding each `:root` occurrence and its immediately following brace body
  // (nested one level for the @media case).
  const rootRegex = /:root(\[data-theme=['"](\w+)['"]\])?\s*\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = rootRegex.exec(css)) !== null) {
    const themeAttr = match[2];
    const selector = themeAttr ? `:root[data-theme="${themeAttr}"]` : ':root';
    const body = match[3] ?? '';
    const names = new Set(
      [...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] as string),
    );
    blocks.push({ selector, names });
  }

  // The dark-media block wraps its own `:root { ... }` — capture it
  // separately so it's distinguishable from the plain light :root.
  const darkMediaMatch = css.match(
    /@media \(prefers-color-scheme:\s*dark\)\s*\{\s*:root\s*\{([^{}]*)\}\s*\}/,
  );
  if (darkMediaMatch) {
    const body = darkMediaMatch[1] ?? '';
    const names = new Set(
      [...body.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1] as string),
    );
    blocks.push({
      selector: '@media (prefers-color-scheme: dark) :root',
      names,
    });
  }

  return blocks;
}

describe('design tokens', () => {
  const css = readFileSync(TOKENS_CSS, 'utf-8');
  const blocks = parseSelectorBlocks(css);

  const lightBlock = blocks.find((b) => b.selector === ':root');
  const darkMediaBlock = blocks.find(
    (b) => b.selector === '@media (prefers-color-scheme: dark) :root',
  );
  const darkOverrideBlock = blocks.find(
    (b) => b.selector === ':root[data-theme="dark"]',
  );

  it('finds a light (:root), a dark-media, and a dark-override block', () => {
    expect(lightBlock).toBeDefined();
    expect(darkMediaBlock).toBeDefined();
    expect(darkOverrideBlock).toBeDefined();
  });

  it.each(ALL_EXPECTED_TOKENS)(
    '%s is declared in the light :root block',
    (name) => {
      expect(lightBlock?.names.has(name)).toBe(true);
    },
  );

  it.each(EXPECTED_COLOR_TOKENS)(
    '%s is declared under @media (prefers-color-scheme: dark)',
    (name) => {
      expect(darkMediaBlock?.names.has(name)).toBe(true);
    },
  );

  it.each(EXPECTED_COLOR_TOKENS)(
    '%s is declared under :root[data-theme="dark"]',
    (name) => {
      expect(darkOverrideBlock?.names.has(name)).toBe(true);
    },
  );

  it('TokenName (tokens.ts) matches the full expected set exactly', () => {
    // The real compile-time check is _tokenNameMatchesFixture above (fails
    // typecheck on any divergence, in either direction). This is the
    // runtime companion: every literal fixture value is passed to token()
    // typed as ExpectedTokenName — if TokenName were missing one, this
    // wouldn't compile — and the var() shape is verified for each.
    for (const name of [
      ...EXPECTED_COLOR_TOKENS,
      ...EXPECTED_NON_COLOR_TOKENS,
    ] satisfies readonly ExpectedTokenName[]) {
      expect(token(name)).toBe(`var(${name})`);
    }
  });

  it('tokens.css declares no token outside the expected set (light block)', () => {
    const extra = [...(lightBlock?.names ?? [])].filter(
      (n) => !ALL_EXPECTED_TOKENS.includes(n),
    );
    expect(extra).toEqual([]);
  });
});
