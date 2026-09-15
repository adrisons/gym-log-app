/**
 * FR-010/011: import — pick a file, validate/migrate it, show an
 * add/replace preview, and apply nothing until the user explicitly
 * confirms (contracts/screen-contracts.md).
 */
import { useState } from 'react';
import { requireStorage } from '@/application/storage-access';
import { requireFileExchange } from '@/application/file-exchange-access';
import { prepareImport } from '@/application/data-transfer/apply-import';
import type { PreparedImport } from '@/application/data-transfer/apply-import';

type FlowState =
  | { step: 'idle' }
  | { step: 'error'; message: string }
  | { step: 'preview'; prepared: PreparedImport }
  | { step: 'applying' }
  | { step: 'done' };

function describeSingleton(
  name: string,
  singleton: { present: boolean; willReplace: boolean },
): string | undefined {
  if (!singleton.present) return undefined;
  return singleton.willReplace
    ? `${name} will be replaced.`
    : `${name} will be added.`;
}

export function ImportFlow() {
  const [state, setState] = useState<FlowState>({ step: 'idle' });

  async function pickAndPrepare(): Promise<void> {
    const picked = await requireFileExchange().pickFile('application/json');
    if (!picked) return; // cancelled — no-op

    const result = await prepareImport(requireStorage(), picked.content);
    if (!result.ok) {
      setState({ step: 'error', message: result.message });
      return;
    }
    setState({ step: 'preview', prepared: result.prepared });
  }

  async function confirm(prepared: PreparedImport): Promise<void> {
    setState({ step: 'applying' });
    await prepared.commit();
    setState({ step: 'done' });
  }

  return (
    <div>
      <button
        type="button"
        className="settings-button"
        disabled={state.step === 'applying'}
        onClick={() => void pickAndPrepare()}
      >
        Import data
      </button>

      {state.step === 'error' && (
        <p role="alert" className="settings-message">
          {state.message}
        </p>
      )}

      {state.step === 'preview' && (
        <div className="settings-preview" role="status">
          <p>
            Sessions: {state.prepared.preview.sessions.toAdd} to add,{' '}
            {state.prepared.preview.sessions.toReplace} to replace.
          </p>
          <p>
            Exercises: {state.prepared.preview.exercises.toAdd} to add,{' '}
            {state.prepared.preview.exercises.toReplace} to replace.
          </p>
          {describeSingleton(
            'Band labels',
            state.prepared.preview.bandLabels,
          ) && (
            <p>
              {describeSingleton(
                'Band labels',
                state.prepared.preview.bandLabels,
              )}
            </p>
          )}
          {describeSingleton('Settings', state.prepared.preview.settings) && (
            <p>
              {describeSingleton('Settings', state.prepared.preview.settings)}
            </p>
          )}
          {state.prepared.preview.loggingDraft.present && (
            <p>Your in-progress, unsubmitted entry will be replaced.</p>
          )}
          {state.prepared.preview.schemaVersion.willMigrate && (
            <p>This file will be migrated to the current version.</p>
          )}
          <div className="settings-confirm-actions">
            <button
              type="button"
              className="settings-button settings-button--primary"
              onClick={() => void confirm(state.prepared)}
            >
              Confirm import
            </button>
            <button
              type="button"
              className="settings-button"
              onClick={() => setState({ step: 'idle' })}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {state.step === 'applying' && <p role="status">Importing…</p>}
      {state.step === 'done' && (
        <p role="status" className="settings-message settings-message--success">
          Import complete.
        </p>
      )}
    </div>
  );
}
