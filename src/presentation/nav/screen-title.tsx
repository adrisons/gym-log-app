/**
 * Lets each `AppShell`-routed screen hand its own title up to `HeaderNav`,
 * which renders it to the left of the menu button instead of each screen
 * spending its own vertical space on a heading row (design-refinement
 * request). Presentation-only UI chrome state — deliberately a plain React
 * context here, not a store under `application/` (`docs/architecture.md`'s
 * layer rules: nothing about "what heading text is on screen right now" is
 * domain or application state).
 *
 * `LoggingShell` (the `/log` route) has no `HeaderNav` at all (ADR-0009) and
 * is never wrapped in this provider — `LoggingScreen` keeps its own `<h1>`.
 *
 * ADR-0014: a screen may also register a `backTo` route — `HeaderNav`
 * renders it as a back arrow to the left of the title, replacing that
 * screen's own close/back control (`SessionDetailScreen`'s old floating
 * "×" button, misplaced on narrow phones per the request this ADR
 * responds to). Every screen sets it on every mount (`undefined` by
 * default), so navigating to a screen with no `backTo` of its own always
 * clears whatever the previous screen left behind.
 *
 * A screen may also register a `backGuard` alongside `backTo` — called
 * right before `HeaderNav` follows that link, it returns `false` to cancel
 * the navigation. `SessionDetailScreen` uses this so tapping the navbar's
 * back arrow with unsaved edits pending doesn't silently discard them the
 * same way its own explicit "Discard changes" button does (Copilot review,
 * PR #42) — the back arrow is reachable from anywhere on the screen and
 * easy to tap by reflex, unlike a button the user chose to scroll to.
 */
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';

type BackGuard = () => boolean;

interface ScreenTitleContextValue {
  title: string;
  setTitle: (title: string) => void;
  backTo: string | undefined;
  setBackTo: (backTo: string | undefined) => void;
  backGuard: BackGuard | undefined;
  // `Dispatch<SetStateAction<...>>`, not a plain `(v) => void`, since
  // `BackGuard` is itself a function — storing one via `useSetScreenTitle`
  // below must go through the updater-function form
  // (`setBackGuard(() => backGuard)`) so React stores the function itself
  // rather than calling it as an updater.
  setBackGuard: Dispatch<SetStateAction<BackGuard | undefined>>;
}

const ScreenTitleContext = createContext<ScreenTitleContextValue | undefined>(
  undefined,
);

export function ScreenTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('');
  const [backTo, setBackTo] = useState<string | undefined>(undefined);
  const [backGuard, setBackGuard] = useState<BackGuard | undefined>(undefined);
  return (
    <ScreenTitleContext.Provider
      value={{ title, setTitle, backTo, setBackTo, backGuard, setBackGuard }}
    >
      {children}
    </ScreenTitleContext.Provider>
  );
}

/** `HeaderNav`'s own read side. */
export function useScreenTitle(): string {
  return useContext(ScreenTitleContext)?.title ?? '';
}

/** `HeaderNav`'s own read side for the back-arrow target, if any. */
export function useScreenBackTo(): string | undefined {
  return useContext(ScreenTitleContext)?.backTo;
}

/** `HeaderNav`'s own read side for the back-arrow's guard, if any — called
 * right before following `backTo`; returning `false` cancels the
 * navigation. */
export function useScreenBackGuard(): BackGuard | undefined {
  return useContext(ScreenTitleContext)?.backGuard;
}

/**
 * A screen calls this once, unconditionally, near the top of its component
 * (before any early return — Rules of Hooks) with whatever its heading
 * currently is, and optionally a route to back-navigate to (ADR-0014) plus
 * a guard for that back arrow. Re-registers whenever `title`/`backTo`/
 * `backGuard` change (e.g. `ProgressionScreen`'s title starts as a
 * placeholder and becomes the loaded exercise's name once data resolves).
 * A layout effect, not a plain one, so the new screen's title/back-arrow
 * are in place before the browser paints — otherwise the previous
 * screen's would flash for one frame after a route change, since React
 * unmounts/mounts across routes rather than re-rendering one persistent
 * component.
 */
export function useSetScreenTitle(
  title: string,
  backTo?: string,
  backGuard?: BackGuard,
): void {
  const ctx = useContext(ScreenTitleContext);
  // A caller typically passes `backGuard` as an inline arrow function (it
  // needs to close over that render's own local state, e.g.
  // `SessionDetailScreen`'s `dirtyRef`) — a fresh identity every render.
  // Read synchronously during render (not the effect below) into a ref, so
  // the effect's own dependency list never needs that unstable identity —
  // including it directly caused an infinite render loop (the effect ran,
  // called `setBackGuard`, which re-rendered this component, which created
  // a new `backGuard` identity, which reran the effect — Copilot review,
  // PR #42). `stableGuard`'s own identity (created once, via `useRef`) is
  // what actually gets registered, always delegating to whatever
  // `backGuardRef` currently holds.
  const backGuardRef = useRef<BackGuard | undefined>(undefined);
  const stableGuardRef = useRef<BackGuard>(
    () => backGuardRef.current?.() ?? true,
  );

  // Keeps `backGuardRef` current every render, but as its own effect with
  // no dependency array (rather than a plain assignment during render,
  // which the ref rules above forbid) — `HeaderNav` only ever calls
  // `stableGuardRef.current` from a click handler, well after this has
  // committed, so there's no staleness window this needs to close any
  // faster than "after every render".
  useLayoutEffect(() => {
    backGuardRef.current = backGuard;
  });

  useLayoutEffect(() => {
    ctx?.setTitle(title);
    ctx?.setBackTo(backTo);
    ctx?.setBackGuard(() => stableGuardRef.current);
  }, [ctx, title, backTo]);
}
