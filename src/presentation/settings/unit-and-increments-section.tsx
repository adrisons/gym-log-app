/**
 * FR-001: default unit (kg/lb) and quick increments (duration/distance —
 * weight has no quick-increment control, `docs/requirements.md` FR-3).
 * Every change applies immediately and persists (FR-002, no Save button).
 */
import { useSettingsStore } from '@/application/settings-store';

export function UnitAndIncrementsSection() {
  const settings = useSettingsStore((state) => state.settings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  return (
    <section className="settings-section" aria-label="Unit and increments">
      <h2>Unit and increments</h2>

      <label className="settings-field-label" htmlFor="settings-default-unit">
        Default unit
        <select
          id="settings-default-unit"
          className="settings-select"
          value={settings.defaultUnit}
          onChange={(event) =>
            void updateSettings({
              defaultUnit: event.target.value as 'kg' | 'lb',
            })
          }
        >
          <option value="kg">Kilograms (kg)</option>
          <option value="lb">Pounds (lb)</option>
        </select>
      </label>

      <label
        className="settings-field-label"
        htmlFor="settings-duration-increment"
      >
        Duration quick increment (seconds)
        <input
          id="settings-duration-increment"
          className="settings-field-input"
          type="number"
          inputMode="numeric"
          min={1}
          value={settings.quickIncrements.durationSeconds}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (!Number.isFinite(value) || value <= 0) return;
            void updateSettings({
              quickIncrements: {
                ...settings.quickIncrements,
                durationSeconds: value,
              },
            });
          }}
        />
      </label>

      <label
        className="settings-field-label"
        htmlFor="settings-distance-increment"
      >
        Distance quick increment (metres)
        <input
          id="settings-distance-increment"
          className="settings-field-input"
          type="number"
          inputMode="numeric"
          min={1}
          value={settings.quickIncrements.distanceMetres}
          onChange={(event) => {
            const value = Number(event.target.value);
            if (!Number.isFinite(value) || value <= 0) return;
            void updateSettings({
              quickIncrements: {
                ...settings.quickIncrements,
                distanceMetres: value,
              },
            });
          }}
        />
      </label>
    </section>
  );
}
