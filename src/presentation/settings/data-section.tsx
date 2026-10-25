/**
 * FR-006: the Data section — export, import, delete-everything, and
 * (spec 010) the scoped delete-old-data alternative.
 */
import { ExportControls } from './export-controls';
import { ImportFlow } from './import-flow';
import { DeleteEverythingFlow } from './delete-everything-flow';
import { DeleteOldDataFlow } from './delete-old-data-flow';

export interface DataSectionProps {
  /** Called after a successful import, delete-everything, or (spec 010)
   * delete-old-data, once the atomic storage write has landed — the
   * caller's job is refreshing whatever in-memory state (Settings store,
   * theme, the storage-size readout) still holds the pre-change
   * snapshot. */
  onDataChanged: () => void | Promise<void>;
}

export function DataSection({ onDataChanged }: DataSectionProps) {
  return (
    <section className="settings-section" aria-label="Data">
      <h2>Data</h2>
      <div className="settings-data-actions">
        <ExportControls />
        <ImportFlow onImported={onDataChanged} />
        <DeleteOldDataFlow onDeleted={onDataChanged} />
        <DeleteEverythingFlow onDeleted={onDataChanged} />
      </div>
    </section>
  );
}
