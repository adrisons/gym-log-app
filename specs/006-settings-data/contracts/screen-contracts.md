# Contract: Settings screen and sub-flows

Mirrors spec 005's `screen-contracts.md` convention: what each screen/flow
reads, writes, and renders — not markup.

## `/settings` — `SettingsScreen`

Reads: `storage.getSettings()`, `storage.listBandLabels()`. Renders four
sections (`UnitAndIncrementsSection`, `ThemeSection`,
`FirstDayOfWeekSection`, `BandLabelsSection`) and `DataSection`. Every
control change calls `storage.saveSettings(next)` immediately (FR-002 — no
Save button, matching the rest of the app's no-save-button convention) and
updates local state optimistically; `document.documentElement.dataset.theme`
is set directly on a theme change (FR-003), and `main.tsx`'s
`applyThemeFromSystemPreference` listener is guarded to no-op once an
explicit choice exists (research.md's note in plan.md's Scope list).

## `DataSection` → `ExportControls`

Two buttons: "Export data" (JSON) and "Export for spreadsheet" (CSV).
Each: reads every record kind via `StoragePort`, builds the file
(`buildExportFile`/`buildTabularExport`), calls
`fileExchange.saveFile(name, content, mimeType)`. No preview — export has
nothing to confirm (spec.md User Story 1).

## `DataSection` → `ImportFlow`

1. "Import data" → `fileExchange.pickFile('application/json')`.
2. `undefined` (cancelled) → no-op, flow ends.
3. A string → `parseAndValidateExportFile()` (FR-013/014): on failure,
   show the rejection message, flow ends, nothing written.
4. On success → migrate in memory if needed (FR-012) → read local state →
   `computeImportPreview()` → render the preview (counts per record kind,
   FR-010) with Confirm/Cancel.
5. Cancel → discard everything in memory, flow ends, nothing written or
   recorded (FR-012's "no trace").
6. Confirm → `storage.importBulk(...)` → success toast; failure surfaces
   the `StorageError` message, already-atomic per the port contract so
   nothing is half-applied either way.

## `DataSection` → `DeleteEverythingFlow`

1. "Delete everything" → first confirmation dialog (plain "are you sure").
2. Confirm → second dialog, explicit "this cannot be undone" wording
   (FR-015).
3. Cancel at either step → flow ends, nothing changes.
4. Confirm both → `storage.resetToFreshInstall(buildSeedCatalogue())` →
   success toast, screen re-reads Settings/band labels (now defaults/empty).

## `BandLabelsSection`

Reorder (drag or up/down controls), rename, add, remove — each calls
`storage.saveBandLabels(next)` immediately (FR-004), reusing the existing
band-label list already written by `specs/001-log-a-session` FR-011; no
new port method (`listBandLabels`/`saveBandLabels` already exist).

## `insights-screen.tsx` (edited, FR-018)

Adds one read: `storage.getSettings()` alongside its existing
`listSessions`/`listExercises` calls, and passes
`settings.firstDayOfWeek` into `buildInsights(...)` →
`computeConsistency(sessions, firstDayOfWeek, asOf)`.
