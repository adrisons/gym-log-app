/**
 * `docs/design.md` §1.1's one bounded exception to "never editorializing"
 * — a brief, self-dismissing acknowledgement that a just-logged session
 * was saved (`docs/requirements.md` FR-1). The text is what actually
 * confirms the save; the emoji (plus a purely decorative glow/sparkle
 * flourish, `aria-hidden`) is the one deliberately-relaxed bit of imagery
 * §1.2 otherwise forbids, and its motion is decoration only — it
 * disappears the same way with or without `prefers-reduced-motion`
 * (`docs/design.md` §4.3), it just doesn't animate getting there.
 *
 * `onDismiss`, when given, fires once this mount is done with the flag it
 * was conditioned on — either the visible-duration timeout elapses, or
 * this component unmounts first (e.g. navigating away before it does).
 * `DiaryScreen` uses it to clear the logging store's `justLoggedASet` flag
 * either way, so the one-shot acknowledgement stays one-shot (a later
 * remount of that same route, with nothing new logged since, renders
 * nothing here at all) — not only on the visible self-dismissal case its
 * name suggests.
 */
import { useEffect, useRef, useState } from 'react';
import { REWARD_ANIMATION_MS } from '@/presentation/design/tokens';
import './diary.css';

export interface SessionSavedToastProps {
  onDismiss?: () => void;
}

export function SessionSavedToast({ onDismiss }: SessionSavedToastProps) {
  const [visible, setVisible] = useState(true);
  // Flips true in cleanup, false again the instant a following `setup` runs
  // — persists across React's dev-only StrictMode mount→cleanup→mount
  // probe (a ref, unlike the effect's own closure state, survives it) so
  // the deferred check below can tell that probe apart from a real unmount.
  const cleanedUpRef = useRef(false);

  useEffect(() => {
    cleanedUpRef.current = false;
    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      onDismiss?.();
    };
    const timeout = setTimeout(() => {
      setVisible(false);
      dismiss();
    }, REWARD_ANIMATION_MS);
    return () => {
      clearTimeout(timeout);
      // Leaving before the timeout fires (e.g. navigating away) must still
      // consume the one-shot flag this mount was conditioned on — otherwise
      // it survives to a later remount of this same route and replays
      // "Session saved" even though nothing new was logged since (Copilot
      // review, PR #22). Calling `onDismiss` straight from cleanup isn't
      // safe under StrictMode, though: its dev-only mount→cleanup→mount
      // probe runs this same cleanup on every real mount too, which would
      // clear the flag (and so unmount this component) a tick after it
      // ever appears. Deferring one microtask, and checking whether a
      // following `setup` already reset `cleanedUpRef` back to false by
      // then, tells that probe apart from a real unmount — only a real one
      // leaves the ref still true when the microtask runs (Copilot review,
      // PR #22). The `dismissed` guard still keeps this from also firing a
      // second time right after the timeout's own call above, once
      // clearing the flag causes `DiaryScreen` to unmount this component.
      cleanedUpRef.current = true;
      queueMicrotask(() => {
        if (cleanedUpRef.current) {
          dismiss();
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <div className="diary-screen__saved-toast" role="status">
      <span aria-hidden="true" className="diary-screen__saved-toast-glow" />
      <span
        aria-hidden="true"
        className="diary-screen__saved-toast-sparkle diary-screen__saved-toast-sparkle--1"
      >
        ✦
      </span>
      <span
        aria-hidden="true"
        className="diary-screen__saved-toast-sparkle diary-screen__saved-toast-sparkle--2"
      >
        ✦
      </span>
      <span aria-hidden="true" className="diary-screen__saved-toast-emoji">
        💪
      </span>
      Session saved
    </div>
  );
}
