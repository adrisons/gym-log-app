/**
 * `docs/design.md` §1.1's one bounded exception to "never editorializing"
 * — a brief, self-dismissing acknowledgement that a just-logged session
 * was saved (`docs/requirements.md` FR-1). The text is what actually
 * confirms the save; the emoji is the one deliberately-relaxed bit of
 * imagery §1.2 otherwise forbids, and its motion is decoration only — it
 * disappears the same way with or without `prefers-reduced-motion`
 * (`docs/design.md` §4.3), it just doesn't animate getting there.
 *
 * `onDismiss`, when given, fires once self-dismissal actually happens —
 * `DiaryScreen` uses it to clear the logging store's `justRegisteredWorkout` flag
 * this component's mount was conditioned on, so the one-shot acknowledgement
 * stays one-shot (a later remount of that same route, with nothing new
 * logged since, renders nothing here at all).
 */
import { useEffect, useState } from 'react';
import './diary.css';

const VISIBLE_MS = 1800;

export interface SessionSavedToastProps {
  onDismiss?: () => void;
}

export function SessionSavedToast({ onDismiss }: SessionSavedToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, VISIBLE_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div className="diary-screen__saved-toast" role="status">
      <span aria-hidden="true" className="diary-screen__saved-toast-emoji">
        💪
      </span>
      Session saved
    </div>
  );
}
