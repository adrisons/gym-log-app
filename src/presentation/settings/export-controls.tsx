/**
 * FR-007/009: export all data (JSON, the primary interchange file) and
 * export for spreadsheet (CSV, one-way). No preview — export has nothing
 * to confirm (spec.md User Story 1).
 */
import { useState } from 'react';
import { requireStorage } from '@/application/storage-access';
import { requireFileExchange } from '@/application/file-exchange-access';
import { allStoredDataRange } from '@/application/date-range';
import { buildExportFile } from '@/application/data-transfer/export-file';
import { buildTabularExport } from '@/application/data-transfer/tabular-export';

function timestampForFilename(date: Date): string {
  return date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

export function ExportControls() {
  const [busy, setBusy] = useState<'json' | 'csv' | undefined>(undefined);

  async function exportJson(): Promise<void> {
    setBusy('json');
    try {
      const storage = requireStorage();
      const now = new Date();
      const [sessions, exercises, settings, loggingDraft] = await Promise.all([
        storage.listSessions(allStoredDataRange()),
        storage.listExercises(),
        storage.getSettings(),
        storage.getDraft(),
      ]);
      const file = buildExportFile({
        sessions,
        exercises,
        settings,
        loggingDraft,
        now,
      });
      await requireFileExchange().saveFile(
        `gym-log-export-${timestampForFilename(now)}.json`,
        JSON.stringify(file, null, 2),
        'application/json',
      );
    } finally {
      setBusy(undefined);
    }
  }

  async function exportCsv(): Promise<void> {
    setBusy('csv');
    try {
      const storage = requireStorage();
      const [sessions, exercises] = await Promise.all([
        storage.listSessions(allStoredDataRange()),
        storage.listExercises(),
      ]);
      const csv = buildTabularExport(sessions, exercises);
      await requireFileExchange().saveFile(
        `gym-log-sessions-${timestampForFilename(new Date())}.csv`,
        csv,
        'text/csv',
      );
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="settings-button-group">
      <button
        type="button"
        className="settings-button settings-button--primary"
        disabled={busy !== undefined}
        onClick={() => void exportJson()}
      >
        {busy === 'json' ? 'Exporting…' : 'Export data'}
      </button>
      <button
        type="button"
        className="settings-button"
        disabled={busy !== undefined}
        onClick={() => void exportCsv()}
      >
        {busy === 'csv' ? 'Exporting…' : 'Export for spreadsheet'}
      </button>
    </div>
  );
}
