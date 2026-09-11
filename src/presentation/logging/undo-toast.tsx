/**
 * FR-004, FR-023: the 5-second undo affordance shared by block/entry/set
 * deletion. The countdown's *information*, not just its animation, is
 * visible (a numeral), so it survives `prefers-reduced-motion`
 * (`docs/design.md` §4.3) — the decorative bar is `aria-hidden`.
 */
import { useEffect, useState } from 'react';
import './logging.css';

const WINDOW_MS = 5000;

export interface UndoToastProps {
  message: string;
  expiresAt: number;
  onUndo: () => void;
}

export function UndoToast({ message, expiresAt, onUndo }: UndoToastProps) {
  const [remainingMs, setRemainingMs] = useState(() =>
    Math.max(0, expiresAt - Date.now()),
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(Math.max(0, expiresAt - Date.now()));
    }, 100);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remainingMs <= 0) return null;

  return (
    <div className="undo-toast" role="status">
      <span>{message}</span>
      <span>{Math.ceil(remainingMs / 1000)}s</span>
      <span
        aria-hidden="true"
        className="undo-toast__bar"
        style={{ width: `${(remainingMs / WINDOW_MS) * 100}%` }}
      />
      <button type="button" className="logging-button" onClick={onUndo}>
        Undo
      </button>
    </div>
  );
}
