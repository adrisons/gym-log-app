/**
 * FR-006: the Data section — export, import, and delete-everything.
 */
import { ExportControls } from './export-controls';
import { ImportFlow } from './import-flow';
import { DeleteEverythingFlow } from './delete-everything-flow';

export function DataSection() {
  return (
    <section className="settings-section" aria-label="Data">
      <h2>Data</h2>
      <ExportControls />
      <ImportFlow />
      <DeleteEverythingFlow />
    </section>
  );
}
