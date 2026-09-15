/**
 * Theme application (spec 006 FR-001/003). Shared between the composition
 * root's OS-preference listener (`main.tsx`) and `ThemeSection` so both
 * apply `document.documentElement.dataset.theme` the same way: `'system'`
 * resolves to whatever the OS currently prefers; `'light'`/`'dark'` are
 * set directly as an explicit override.
 */

export function currentSystemPreference(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function applyTheme(theme: 'light' | 'dark' | 'system'): void {
  document.documentElement.dataset.theme =
    theme === 'system' ? currentSystemPreference() : theme;
}
