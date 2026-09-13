/**
 * Shared reduced-motion check (docs/design.md §4.3) — components that
 * drive their own one-shot animation lifecycle from JS (not just a CSS
 * `@media (prefers-reduced-motion: reduce)` rule) need this to skip
 * waiting on an animation/transition event that a reduced-motion user's
 * browser will never fire.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}
