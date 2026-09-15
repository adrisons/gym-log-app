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
 */
import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from 'react';

interface ScreenTitleContextValue {
  title: string;
  setTitle: (title: string) => void;
  backTo: string | undefined;
  setBackTo: (backTo: string | undefined) => void;
}

const ScreenTitleContext = createContext<ScreenTitleContextValue | undefined>(
  undefined,
);

export function ScreenTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('');
  const [backTo, setBackTo] = useState<string | undefined>(undefined);
  return (
    <ScreenTitleContext.Provider value={{ title, setTitle, backTo, setBackTo }}>
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

/**
 * A screen calls this once, unconditionally, near the top of its component
 * (before any early return — Rules of Hooks) with whatever its heading
 * currently is, and optionally a route to back-navigate to (ADR-0014).
 * Re-registers whenever `title`/`backTo` change (e.g. `ProgressionScreen`'s
 * title starts as a placeholder and becomes the loaded exercise's name
 * once data resolves). A layout effect, not a plain one, so the new
 * screen's title/back-arrow are in place before the browser paints —
 * otherwise the previous screen's would flash for one frame after a route
 * change, since React unmounts/mounts across routes rather than
 * re-rendering one persistent component.
 */
export function useSetScreenTitle(title: string, backTo?: string): void {
  const ctx = useContext(ScreenTitleContext);
  useLayoutEffect(() => {
    ctx?.setTitle(title);
    ctx?.setBackTo(backTo);
  }, [ctx, title, backTo]);
}
