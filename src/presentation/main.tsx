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
 * (research.md §3) alongside the logging screen. `/` redirects to
 * `/diary` — the diary is the app's home; the logging form lives at
 * `/log`, reached from a floating action there rather than a nav tab
 * (`docs/requirements.md` FR-1's design-refinement update), in its own
 * `LoggingShell` (no `HeaderNav`, ADR-0009). Routing is introduced only here, at
 * the composition boundary — `LoggingScreen` itself, and `configure()`'s
 * call before the router renders, are unchanged (constitution Principle
 * II: no added latency/step on the logging critical path).
 *
 * `BrowserRouter`'s `basename` is `import.meta.env.BASE_URL` — Vite sets
 * this to whatever `vite.config.ts`'s `base` resolves to (`/` normally,
 * `/gym-log-app/` under the GitHub Pages build). Without it, `Routes`
 * matches against the raw pathname the browser reports, which on Pages'
 * subpath deployment is `/gym-log-app/...`, not `/...` — none of the
 * routes below would ever match and the whole app would render nothing
 * (a blank page, `.github/workflows/deploy.yml`'s deployed build).
 */
import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { AppShell, LoggingShell } from './app-shell';
import { LoggingScreen } from './logging/logging-screen';
import { DiaryScreen } from './diary/diary-screen';
import { SessionDetailScreen } from './diary/session-detail-screen';
import { ExerciseSearchScreen } from './search/exercise-search-screen';
import { ProgressionScreen } from './progression/progression-screen';
import { InsightsScreen } from './insights/insights-screen';
import { ExerciseCatalogueScreen } from './catalogue/exercise-catalogue-screen';
import { SettingsScreen } from './settings/settings-screen';
import { useLoggingSession } from '../application/logging/logging-store';
import { useStorageAccess } from '../application/storage-access';
import { useFileExchangeAccess } from '../application/file-exchange-access';
import { useSettingsStore } from '../application/settings-store';
import { buildSeedCatalogue } from '../application/catalogue/seed-exercises';
import { CURRENT_SCHEMA_VERSION } from '../application/schema-migration';
import type { StoragePort } from '../application/ports/storage-port';
import { IndexedDbStorageAdapter } from '../infrastructure/indexed-db-storage-adapter';
import { FileSystemStorageAdapter } from '../infrastructure/file-system-storage-adapter';
import { FileExchangeAdapter } from '../infrastructure/file-exchange-adapter';
import { selectAdapterClass } from '../infrastructure/select-adapter';
import { applyTheme } from './theme';
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

/**
 * Applies the current theme immediately (using whatever `useSettingsStore`
 * already has — `DEFAULT_SETTINGS.theme` is `'system'`, so this matches
 * the app's previous unconditional OS-driven behavior until a real
 * Settings record loads) and keeps a `'system'` choice live as the OS
 * preference changes. An explicit `'light'`/`'dark'` choice
 * (`ThemeSection`, spec 006 FR-001/003) is never fought here — this
 * listener only re-applies when the current setting is `'system'`.
 */
function wireThemeToOsPreference(): void {
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  const reapplyIfSystem = (): void => {
    if (useSettingsStore.getState().settings.theme === 'system') {
      applyTheme('system');
    }
  };
  applyTheme(useSettingsStore.getState().settings.theme);
  media.addEventListener('change', reapplyIfSystem);
}

/** Seeds the exercise catalogue on a genuinely fresh install (D9/ADR-0005
 * — closes a pre-existing gap, spec 006 research.md §1). Never re-seeds a
 * device that already has any exercise, seed or user-created. Writes all
 * twelve exercises through one atomic `importBulk` call rather than a
 * sequential loop of `saveExercise` calls (Copilot review, PR #31): a
 * mid-loop failure used to leave the catalogue non-empty but incomplete,
 * which made this function's own `existing.length > 0` guard skip the
 * missing entries forever on every later launch — atomic means either all
 * twelve land, or the catalogue is still empty and the next launch's call
 * retries from scratch. `sessions: []` upserts nothing (an upsert of no
 * rows), so this never touches session data. */
async function seedCatalogueIfEmpty(storage: StoragePort): Promise<void> {
  const existing = await storage.listExercises();
  if (existing.length > 0) return;
  await storage.importBulk({
    sessions: [],
    exercises: buildSeedCatalogue(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
  });
}

/**
 * Gates the real route tree behind `seedCatalogueIfEmpty` settling
 * (Copilot review, PR #31): without this, seeding raced the initial
 * route's own render — a direct first visit to `/exercises` or `/log`
 * could complete its one-time catalogue read before the fire-and-forget
 * seed finished, and render as visibly (and, pre-atomicity fix,
 * sometimes permanently) empty. Renders a bare shell until seeding
 * settles — success or failure, the latter logged and swallowed rather
 * than blocking the app — then mounts the routes that read the
 * catalogue. `storage.listExercises()` is cheap once already seeded, so
 * this costs returning users nothing perceptible; only a genuinely fresh
 * install pays for the one bulk write before first paint of a route.
 */
function App({ storage }: { storage: StoragePort }) {
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    seedCatalogueIfEmpty(storage)
      .catch((error: unknown) => {
        console.error('Failed to seed exercise catalogue', error);
      })
      .finally(() => {
        if (!cancelled) setSeeded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storage]);

  if (!seeded) {
    return <div aria-hidden="true" />;
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Navigate to="/diary" replace />} />
        <Route element={<AppShell />}>
          <Route path="/diary" element={<DiaryScreen />} />
          <Route path="/diary/:sessionId" element={<SessionDetailScreen />} />
          <Route path="/search" element={<ExerciseSearchScreen />} />
          <Route
            path="/exercises/:exerciseId/progression"
            element={<ProgressionScreen />}
          />
          <Route path="/insights" element={<InsightsScreen />} />
          <Route path="/exercises" element={<ExerciseCatalogueScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Route>
        <Route element={<LoggingShell />}>
          <Route path="/log" element={<LoggingScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function mount(): void {
  const root = document.getElementById('root');
  if (!root) {
    throw new Error('#root element not found in index.html');
  }
  const storage = createStorageAdapter();
  useLoggingSession.getState().configure(storage);
  useStorageAccess.getState().configure(storage);
  useFileExchangeAccess.getState().configure(new FileExchangeAdapter());
  useSettingsStore.getState().configure(storage);
  // Fire-and-forget: must not block first paint (Principle II) or
  // first-render's use of `useSettingsStore.getState().settings`, which
  // already starts at `DEFAULT_SETTINGS` (theme 'system', matching this
  // app's previous unconditional boot-time behavior) until this resolves
  // and corrects it. Unlike seeding, nothing reads Settings synchronously
  // off the first paint the way a route reads the exercise catalogue, so
  // this doesn't need the same gate.
  void useSettingsStore
    .getState()
    .load()
    .then(() => applyTheme(useSettingsStore.getState().settings.theme));
  createRoot(root).render(
    <StrictMode>
      <App storage={storage} />
    </StrictMode>,
  );
}

wireThemeToOsPreference();
mount();
registerSW({ immediate: true });
