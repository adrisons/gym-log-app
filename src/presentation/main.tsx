/**
 * The composition root (constitution Principle V; spec 000 FR-021). The
 * single wiring point — the only file allowed to import across every layer
 * (see eslint.boundaries.js "Composition-root classification" for how that
 * permission is granted). Phase 0 scope: mount the placeholder shell,
 * register the service worker, and wire the theme attribute from the OS
 * preference. No domain/application wiring yet — there is none until
 * Phase 1.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { AppShell } from './app-shell';
// tokens.css is linked directly from index.html (not imported here) so it
// loads before first paint without waiting on the JS bundle.

function applyThemeFromSystemPreference(): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = (isDark: boolean): void => {
    // Only set the attribute for the OS-driven default; an explicit user
    // choice (future Settings toggle, FR-11) would set 'light' | 'dark'
    // directly and this listener should not fight that choice. Phase 0 has
    // no such toggle yet, so this is the sole source of `data-theme`.
    document.documentElement.dataset.theme = isDark ? 'dark' : 'light';
  };
  apply(media.matches);
  media.addEventListener('change', (event) => apply(event.matches));
}

function mount(): void {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('#root element not found in index.html');
  }
  createRoot(root).render(
    <StrictMode>
      <AppShell />
    </StrictMode>,
  );
}

applyThemeFromSystemPreference();
mount();
registerSW({ immediate: true });
