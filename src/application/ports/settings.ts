/**
 * `Settings` — the user's own per-device preferences (`docs/requirements.md`
 * FR-11; `specs/006-settings-data` data-model.md). Not a canonical entity
 * (`docs/requirements.md` §3.1) — additive, non-canonical state on the same
 * footing as the logging draft (D14), so it needs no schema-version bump.
 *
 * Lives under `application/ports/`, not `application/`, purely so
 * `storage-port.ts` can reference it without an `application-ports` →
 * `application` import, the same reason `LoggingDraft` lives here
 * (`./logging-draft.ts`'s own doc comment).
 */

export interface QuickIncrements {
  /** Seconds added/removed per tap on a Duration set's quick-increment
   * control (`docs/requirements.md` FR-3). */
  durationSeconds: number;
  /** Metres added/removed per tap on a Distance set's quick-increment
   * control (`docs/requirements.md` FR-3). */
  distanceMetres: number;
}

export interface Settings {
  defaultUnit: 'kg' | 'lb';
  quickIncrements: QuickIncrements;
  theme: 'light' | 'dark' | 'system';
  /** Drives the Insights consistency card's week boundaries
   * (`specs/005-insights` FR-010, this spec's FR-018). */
  firstDayOfWeek: 'monday' | 'sunday';
}

/**
 * The defaults a fresh install (or a Settings record predating a later
 * field) falls back to — matches D4's existing kg default and spec 005's
 * documented ISO/Monday provisional default exactly, so shipping this
 * feature changes no existing behavior until a user actively changes a
 * setting (`specs/006-settings-data` research.md §7).
 */
export const DEFAULT_SETTINGS: Settings = {
  defaultUnit: 'kg',
  // Matches `application/logging/quick-increments.ts`'s pre-Settings
  // hardcoded constants exactly (5s / 50m) — this field was previously
  // `distanceMetres: 5`, which contradicted this doc comment's own claim
  // and would have changed the default distance quick-increment for every
  // existing install the moment logging started reading Settings instead
  // of those constants (Copilot review, PR #31: "logging never reads
  // these values" — fixed by wiring them through, which made this
  // pre-existing mismatch reachable for the first time).
  quickIncrements: { durationSeconds: 5, distanceMetres: 50 },
  theme: 'system',
  firstDayOfWeek: 'monday',
};

/**
 * Fills in any field missing from a stored (possibly partial, possibly
 * absent) `Settings` record — D14: a Settings field defaults silently, no
 * migration. `stored` is `undefined` for a device that has never saved
 * Settings at all (`StoragePort.getSettings()`'s own presence contract,
 * mirroring `getDraft()`).
 */
export function withSettingsDefaults(stored?: Partial<Settings>): Settings {
  return {
    defaultUnit: stored?.defaultUnit ?? DEFAULT_SETTINGS.defaultUnit,
    quickIncrements: {
      durationSeconds:
        stored?.quickIncrements?.durationSeconds ??
        DEFAULT_SETTINGS.quickIncrements.durationSeconds,
      distanceMetres:
        stored?.quickIncrements?.distanceMetres ??
        DEFAULT_SETTINGS.quickIncrements.distanceMetres,
    },
    theme: stored?.theme ?? DEFAULT_SETTINGS.theme,
    firstDayOfWeek: stored?.firstDayOfWeek ?? DEFAULT_SETTINGS.firstDayOfWeek,
  };
}
