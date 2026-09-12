/**
 * `docs/design.md` §1.1's one bounded exception to "never editorializing"
 * — a brief, self-dismissing acknowledgement that a just-logged session
 * was saved (`docs/requirements.md` FR-1). The text is what actually
 * confirms the save; the emoji is the one deliberately-relaxed bit of
 * imagery §1.2 otherwise forbids, and its motion is decoration only — it
 * disappears the same way with or without `prefers-reduced-motion`
 * (`docs/design.md` §4.3), it just doesn't animate getting there.
 */
import { useEffect, useState } from 'react';
import './diary.css';

const VISIBLE_MS = 1800;

export function SessionSavedToast() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeout = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timeout);
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
