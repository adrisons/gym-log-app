# Quickstart: PWA Installability and Update Lifecycle

Validation scenarios proving FR-001-018 end to end. Prerequisites: a
production build (`npm run build && npm run preview`, or the deployed
GitHub Pages build) — `vite-plugin-pwa`'s service worker is inert in `npm
run dev` — and Chromium for the native-install/update paths (WebKit/Safari
for the manual-install path, ideally a real iOS device for the final
manual check).

## 1. Update notice never interrupts a set (SC-001, User Story 1)

1. Build and deploy/preview version A; open it in Chromium; install it
   (see §3) or just keep it open in a tab.
2. On the logging screen, start filling in an add-set row's fields without
   tapping Confirm.
3. Build and deploy/preview version B (any trivial content change) to the
   same URL.
4. Wait for the periodic check (or trigger `registration.update()` from
   DevTools' Application → Service Workers panel) — confirm no reload
   happens and no notice appears yet.
5. Tap Confirm (or Cancel) on the in-progress row.
6. Confirm the update notice now appears (still on `/log`? — it must not;
   navigate to any other screen and confirm it's there, per FR-018).
7. Tap the notice's update control; confirm the app reloads to version B.

## 2. Storage status across both adapters (SC-002, User Story 2)

1. **File System Access (Chromium desktop)**: fresh profile, open the app,
   go straight to Settings before logging anything — confirm the storage
   section states a folder will be chosen on first save (no folder name,
   no error). Log and confirm a set (triggers the folder picker), return
   to Settings, confirm the real folder name now shows.
2. **IndexedDB (WebKit/Safari, or Chromium with the File System Access
   flag disabled)**: open the app, go to Settings, confirm the storage
   section states data is stored in the browser/app's own storage, worded
   as expected behavior (not an error or a missing feature).
3. **Permission lost**: with the File System Access adapter active and a
   folder already chosen, revoke the app's permission for that folder from
   the browser's own site-settings UI. Reopen Settings — confirm it states
   access needs to be reconfirmed and offers the reconnect control; tap it,
   grant permission again in the native dialog, and confirm the section
   returns to showing the folder name normally (SC-006).

## 3. Install offer (SC-003/SC-004, User Story 3)

1. Open the app in a plain Chromium tab (not installed) — confirm the
   install offer appears with a native "Install" control; accept it and
   confirm the app installs and the offer never reappears in the installed
   window (FR-013).
2. In a fresh tab (not installed), open the offer and tap "Don't show
   again"; reload the same tab and confirm it does not reappear (FR-014,
   SC-004); open the app in a *different* tab/profile and confirm the
   offer is unaffected there (per-device, not global).
3. **iOS Safari (manual, real device or Safari Technology Preview)**: open
   the app in a plain tab — confirm the offer renders the manual "Add to
   Home Screen" instructions rather than a native button (FR-012); follow
   them, confirm the installed icon launches the app standalone, and
   confirm the offer never appears in that standalone launch (FR-013).

## 4. No update notice for the version already running at launch (SC-005)

1. With version B already installed/current, fully close and reopen the
   app.
2. Confirm no update notice appears — it launched already current
   (FR-005).

## Recording results

Note the outcome of each numbered step (pass/fail, browser/OS used) in
this feature's PR description or a follow-up commit note — this project
records manual verification here rather than in an automated report
(matching spec 006's own SC-008 precedent, research.md §6).
