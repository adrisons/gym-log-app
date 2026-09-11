/**
 * The composition root (constitution Principle V; spec 000 FR-021). The
 * single wiring point — the only file allowed to import across every layer
 * (see eslint.boundaries.js "Composition-root classification" for how that
 * permission is granted).
 *
 * Spec 001 scope: mounts the real logging screen, wired to
 * `InMemoryStorageAdapter` — NOT durable (its own doc comment). This
 * plan's explicit scope boundary (research.md §1) is the
 * application/presentation layers against the storage port, proven
 * against this non-durable stand-in, not a real on-device adapter. The
 * one edit a future persistence spec needs here is swapping this one
 * `StoragePort` instance for a real, feature-detected one (research.md
 * §6) — no application or presentation code changes.
 *
 * Replaces Phase 0's `AppShell` placeholder ("Real screens land in Phases
 * 1–3", its own doc comment) now that a real screen exists.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { LoggingScreen } from './logging/logging-screen';
import { useLoggingSession } from '../application/logging/logging-store';
import { InMemoryStorageAdapter } from '../infrastructure/in-memory-storage-adapter';
// tokens.css is linked directly from index.html (not imported here) so it
// loads before first paint without waiting on the JS bundle.

function applyThemeFromSystemPreference(): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = (isDark: boolean): void => {
    // Only set the attribute for the OS-driven default; an explicit user
    // choice (future Settings toggle, FR-11) would set 'light' | 'dark'
    // directly and this listener should not fight that choice. No such
    // toggle exists yet, so this is the sole source of `data-theme`.
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
  useLoggingSession.getState().configure(new InMemoryStorageAdapter());
  createRoot(root).render(
    <StrictMode>
      <LoggingScreen />
    </StrictMode>,
  );
}

applyThemeFromSystemPreference();
mount();
registerSW({ immediate: true });
