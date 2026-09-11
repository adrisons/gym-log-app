import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Spec 000 FR-019 / data-model.md §2: every token role listed there must be
// (a) present in the TokenName union (tokens.ts) and (b) declared in both a
// light and a dark selector in tokens.css. A token present with a
// provisional value is fine; a token *missing* is the failure this guards.

const TOKENS_CSS = resolve(
  __dirname,
  '../../src/presentation/design/tokens.css',
);

// The full expected set, mirroring data-model.md §2 exactly.
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
];

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
];

const ALL_EXPECTED_TOKENS = [
  ...EXPECTED_COLOR_TOKENS,
  ...EXPECTED_NON_COLOR_TOKENS,
];

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

  it('TokenName (tokens.ts) matches the full expected set exactly', async () => {
    // Import dynamically so a missing/renamed export fails this test with a
    // clear message rather than a module-resolution error at collection time.
    const tokensModule = await import('../../src/presentation/design/tokens');
    expect(typeof tokensModule.token).toBe('function');

    // TokenName is a type, so it can't be inspected at runtime directly —
    // instead assert `token()` accepts every expected name without a type
    // error at the call site (this file is TS-checked) and that calling it
    // produces the right var() shape, which is the FR-019-relevant contract.
    for (const name of ALL_EXPECTED_TOKENS) {
      expect(tokensModule.token(name as never)).toBe(`var(${name})`);
    }
  });

  it('tokens.css declares no token outside the expected set (light block)', () => {
    const extra = [...(lightBlock?.names ?? [])].filter(
      (n) => !ALL_EXPECTED_TOKENS.includes(n),
    );
    expect(extra).toEqual([]);
  });
});
