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
  | { step: 'applying'; prepared: PreparedImport }
  | { step: 'done' };

export interface ImportFlowProps {
  /** Called once `commit()` has landed — the caller refreshes whatever
   * in-memory state (Settings store, theme) still holds the
   * pre-import snapshot (Copilot review, PR #31). */
  onImported: () => void | Promise<void>;
}

function describeSingleton(
  name: string,
  singleton: { present: boolean; willReplace: boolean },
): string | undefined {
  if (!singleton.present) return undefined;
  return singleton.willReplace
    ? `${name} will be replaced.`
    : `${name} will be added.`;
}

function messageFor(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something went wrong reading that file.';
}

export function ImportFlow({ onImported }: ImportFlowProps) {
  const [state, setState] = useState<FlowState>({ step: 'idle' });

  async function pickAndPrepare(): Promise<void> {
    try {
      const picked = await requireFileExchange().pickFile('application/json');
      if (!picked) return; // cancelled — no-op

      const result = await prepareImport(requireStorage(), picked.content);
      if (!result.ok) {
        setState({ step: 'error', message: result.message });
        return;
      }
      setState({ step: 'preview', prepared: result.prepared });
    } catch (error) {
      // Picker/read failures, and failures reading the local snapshot
      // inside prepareImport, are not ImportValidationResult failures —
      // without this catch they reject pickAndPrepare() unhandled
      // (Copilot review, PR #31).
      setState({ step: 'error', message: messageFor(error) });
    }
  }

  async function confirm(prepared: PreparedImport): Promise<void> {
    setState({ step: 'applying', prepared });
    try {
      await prepared.commit();
    } catch (error) {
      // A rejected commit() must not leave the flow stuck on "Importing…"
      // forever, nor produce an unhandled rejection (Copilot review, PR
      // #31) — the screen contract still requires the StorageError
      // message surfaced, same as a validation failure.
      setState({ step: 'error', message: messageFor(error) });
      return;
    }
    setState({ step: 'done' });
    await onImported();
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
