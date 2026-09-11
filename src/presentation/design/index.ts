// Public entry point for the design-token module. Re-exports the typed
// accessor only — tokens.css is imported directly wherever the CSS custom
// properties need to be loaded (currently index.html), not through here.
export type { TokenName } from './tokens';
export { token } from './tokens';
