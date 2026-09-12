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
 *
 * Spec 004 (Diary, search and progression): adds `react-router-dom`
 * routes for the diary/history, search, and progression screens
 * (research.md §3) alongside the logging screen at `/`. Routing is
 * introduced only here, at the composition boundary — `LoggingScreen`
 * itself, and `configure()`'s call before the router renders, are
 * unchanged (constitution Principle II: no added latency/step on the
 * logging critical path).
 *
 * `BrowserRouter`'s `basename` is `import.meta.env.BASE_URL` — Vite sets
 * this to whatever `vite.config.ts`'s `base` resolves to (`/` normally,
 * `/gym-log-app/` under the GitHub Pages build). Without it, `Routes`
 * matches against the raw pathname the browser reports, which on Pages'
 * subpath deployment is `/gym-log-app/...`, not `/...` — none of the
 * routes below would ever match and the whole app would render nothing
 * (a blank page, `.github/workflows/deploy.yml`'s deployed build).
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { LoggingScreen } from './logging/logging-screen';
import { DiaryScreen } from './diary/diary-screen';
import { SessionDetailScreen } from './diary/session-detail-screen';
import { ExerciseSearchScreen } from './search/exercise-search-screen';
import { ProgressionScreen } from './progression/progression-screen';
import { InsightsScreen } from './insights/insights-screen';
import { useLoggingSession } from '../application/logging/logging-store';
import { useStorageAccess } from '../application/storage-access';
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
  const storage = createStorageAdapter();
  useLoggingSession.getState().configure(storage);
  useStorageAccess.getState().configure(storage);
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<LoggingScreen />} />
          <Route path="/diary" element={<DiaryScreen />} />
          <Route path="/diary/:sessionId" element={<SessionDetailScreen />} />
          <Route path="/search" element={<ExerciseSearchScreen />} />
          <Route
            path="/exercises/:exerciseId/progression"
            element={<ProgressionScreen />}
          />
          <Route path="/insights" element={<InsightsScreen />} />
        </Routes>
      </BrowserRouter>
    </StrictMode>,
  );
}

applyThemeFromSystemPreference();
mount();
registerSW({ immediate: true });
