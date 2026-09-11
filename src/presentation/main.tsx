/**
 * The composition root (constitution Principle V; spec 000 FR-021). The
 * single wiring point — the only file allowed to import across every layer
 * (see eslint.boundaries.js "Composition-root classification" for how that
 * permission is granted).
 *
 * Spec 003 (Persistence): wires a real, feature-detected `StoragePort`
 * adapter (FR-004) — `FileSystemStorageAdapter` where the File System
 * Access API is available, `IndexedDbStorageAdapter` otherwise (notably
 * iOS Safari). `InMemoryStorageAdapter` (spec 001's stand-in) remains in
 * the codebase as the test-only fake (ADR-0002's third implementation)
 * but is no longer wired here.
 *
 * `FileSystemStorageAdapter`'s directory handle is never acquired here at
 * mount time — `getHandle` below only calls `showDirectoryPicker()` the
 * first time the adapter actually needs it (its own `#ensureDirectoryHandle`,
 * spec 003 research.md §2), which is the first real storage write. Every
 * write on the logging critical path already originates from a user
 * gesture (a tap confirming a set, `logging-store.ts`), so no dialog is
 * shown at app-open time (FR-004a) — `mount()` itself calls `configure()`
 * synchronously with an adapter instance, never awaiting a picker.
 *
 * Replaces Phase 0's `AppShell` placeholder ("Real screens land in Phases
 * 1–3", its own doc comment) now that a real screen exists.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { LoggingScreen } from './logging/logging-screen';
import { useLoggingSession } from '../application/logging/logging-store';
import type { StoragePort } from '../application/ports/storage-port';
import { IndexedDbStorageAdapter } from '../infrastructure/indexed-db-storage-adapter';
import { FileSystemStorageAdapter } from '../infrastructure/file-system-storage-adapter';
import { selectAdapterClass } from '../infrastructure/select-adapter';
// tokens.css is linked directly from index.html (not imported here) so it
// loads before first paint without waiting on the JS bundle.

function createStorageAdapter(): StoragePort {
  const hasFileSystemAccess = 'showDirectoryPicker' in window;
  const kind = selectAdapterClass(hasFileSystemAccess);
  if (kind === 'file-system') {
    return new FileSystemStorageAdapter(() =>
      window.showDirectoryPicker({ id: 'gym-log', mode: 'readwrite' }),
    );
  }
  return new IndexedDbStorageAdapter();
}

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
  useLoggingSession.getState().configure(createStorageAdapter());
  createRoot(root).render(
    <StrictMode>
      <LoggingScreen />
    </StrictMode>,
  );
}

applyThemeFromSystemPreference();
mount();
registerSW({ immediate: true });
