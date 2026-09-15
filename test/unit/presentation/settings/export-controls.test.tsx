import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportControls } from '@/presentation/settings/export-controls';
import { useStorageAccess } from '@/application/storage-access';
import { useFileExchangeAccess } from '@/application/file-exchange-access';
import { EXPORT_FORMAT } from '@/application/data-transfer/export-file';
import type { Exercise } from '@/domain/exercise';
import type { ExerciseId, SessionId } from '@/domain/ids';
import { createSession } from '@/domain/session';
import { createSet } from '@/domain/set';
import { createLoad } from '@/domain/load';
import { createVolume } from '@/domain/volume';
import { InMemoryStorage, InMemoryFileExchange } from '../../../support';

describe('ExportControls (spec 006 FR-007/009)', () => {
  let storage: InMemoryStorage;
  let fileExchange: InMemoryFileExchange;

  beforeEach(async () => {
    storage = new InMemoryStorage();
    fileExchange = new InMemoryFileExchange();
    useStorageAccess.getState().configure(storage);
    useFileExchangeAccess.getState().configure(fileExchange);
    await storage.saveExercise({
      id: 'ex-1' as ExerciseId,
      canonicalName: 'Back squat',
      aliases: [],
      defaultLoadType: 'weight',
      defaultVolumeKind: 'reps',
      trackEffort: false,
      unilateral: false,
      discipline: 'Strength',
    } satisfies Exercise);
    await storage.saveSession(
      createSession({
        id: 'sess-1' as SessionId,
        dateTime: '2026-09-10T18:00:00.000Z',
        notes: '',
        blocks: [
          {
            type: 'straightSets',
            exercises: [
              {
                exerciseId: 'ex-1' as ExerciseId,
                notes: '',
                sets: [
                  createSet({
                    volume: createVolume({ kind: 'reps', count: 5 }),
                    load: createLoad({
                      kind: 'weight',
                      value: 100,
                      unit: 'kg',
                    }),
                    setKind: 'working',
                    completed: true,
                  }),
                ],
              },
            ],
          },
        ],
      }),
    );
  });

  it('"Export data" saves a .json file with the interchange format, MIME type, and content', async () => {
    const user = userEvent.setup();
    render(<ExportControls />);

    await user.click(screen.getByRole('button', { name: 'Export data' }));

    await waitFor(() => expect(fileExchange.saved).toHaveLength(1));
    const [saved] = fileExchange.saved;
    expect(saved?.suggestedName).toMatch(/^gym-log-export-.*\.json$/);
    expect(saved?.mimeType).toBe('application/json');
    const parsed: unknown = JSON.parse(saved!.content);
    expect(parsed).toMatchObject({
      format: EXPORT_FORMAT,
      sessions: [{ id: 'sess-1' }],
      exerciseCatalogue: [{ id: 'ex-1', canonicalName: 'Back squat' }],
    });
  });

  it('"Export for spreadsheet" saves a .csv file with the MIME type and a row per session', async () => {
    const user = userEvent.setup();
    render(<ExportControls />);

    await user.click(
      screen.getByRole('button', { name: 'Export for spreadsheet' }),
    );

    await waitFor(() => expect(fileExchange.saved).toHaveLength(1));
    const [saved] = fileExchange.saved;
    expect(saved?.suggestedName).toMatch(/^gym-log-sessions-.*\.csv$/);
    expect(saved?.mimeType).toBe('text/csv');
    const lines = saved!.content.split('\n');
    expect(lines).toHaveLength(2); // header + the one logged Set
    expect(lines[1]).toContain('Back squat');
  });

  it('disables both buttons and shows "Exporting…" while a save is in flight, then re-enables them', async () => {
    let resolveSave: (() => void) | undefined;
    vi.spyOn(fileExchange, 'saveFile').mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSave = () => resolve(undefined);
        }),
    );
    const user = userEvent.setup();
    render(<ExportControls />);

    await user.click(screen.getByRole('button', { name: 'Export data' }));

    const exportingButton = await screen.findByRole('button', {
      name: 'Exporting…',
    });
    expect(exportingButton).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Export for spreadsheet' }),
    ).toBeDisabled();

    resolveSave?.();

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Export data' })).toBeEnabled(),
    );
    expect(
      screen.getByRole('button', { name: 'Export for spreadsheet' }),
    ).toBeEnabled();
  });
});
