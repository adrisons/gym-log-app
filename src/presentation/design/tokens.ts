/**
 * Typed accessor for the design tokens declared in `tokens.css`. Keep this
 * union in sync with that file's custom-property names — it is the
 * enumerated set FR-019 ("every token present") is checked against, and
 * `test/unit/tokens.test.ts` verifies both files agree.
 */

export type TokenName =
  | '--color-canvas'
  | '--color-surface'
  | '--color-surface-raised'
  | '--color-foreground'
  | '--color-foreground-muted'
  | '--color-foreground-subtle'
  | '--color-border'
  | '--color-border-strong'
  | '--color-accent'
  | '--color-accent-foreground'
  | '--color-focus-ring'
  | '--color-danger'
  | '--color-warning'
  | '--color-success'
  | '--radius-sm'
  | '--radius-md'
  | '--radius-lg'
  | '--radius-pill'
  | '--duration-instant'
  | '--duration-short'
  | '--duration-medium'
  | '--duration-reward'
  | '--easing-standard'
  | '--easing-decelerate'
  | '--easing-accelerate'
  | '--space-1'
  | '--space-2'
  | '--space-3'
  | '--space-4'
  | '--space-5'
  | '--space-6'
  | '--font-ui'
  | '--font-mono';

/**
 * Returns a `var(--token-name)` reference for use in inline styles or
 * CSS-in-JS. Prefer a CSS class bound to a custom property where possible;
 * this exists for the cases (inline `style` props) where a class isn't.
 */
export function token(name: TokenName): string {
  return `var(${name})`;
}

/**
 * `--duration-reward`'s value (tokens.css), mirrored here as a plain
 * number so `SessionSavedToast` can time its own dismissal off it. CSS
 * custom properties aren't otherwise readable from JS without a runtime
 * `getComputedStyle` round-trip (unreliable under jsdom, and irrelevant
 * overhead in a real browser for a single fixed value) — `test/unit/
 * tokens.test.ts` cross-checks this literal against tokens.css's own
 * `--duration-reward` declaration, so the two can't silently drift apart.
 */
export const REWARD_ANIMATION_MS = 1800;
