/**
 * FR-006: the Data section — export, import, and delete-everything.
 */
import { ExportControls } from './export-controls';
import { ImportFlow } from './import-flow';
import { DeleteEverythingFlow } from './delete-everything-flow';

export interface DataSectionProps {
  /** Called after a successful import or delete-everything, once the
   * atomic storage write has landed — the caller's job is refreshing
   * whatever in-memory state (Settings store, band labels, theme) still
   * holds the pre-change snapshot. */
  onDataChanged: () => void | Promise<void>;
}

export function DataSection({ onDataChanged }: DataSectionProps) {
  return (
    <section className="settings-section" aria-label="Data">
      <h2>Data</h2>
      <ExportControls />
      <ImportFlow onImported={onDataChanged} />
      <DeleteEverythingFlow onDeleted={onDataChanged} />
    </section>
  );
}
