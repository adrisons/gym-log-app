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
}

const ScreenTitleContext = createContext<ScreenTitleContextValue | undefined>(
  undefined,
);

export function ScreenTitleProvider({ children }: { children: ReactNode }) {
  const [title, setTitle] = useState('');
  return (
    <ScreenTitleContext.Provider value={{ title, setTitle }}>
      {children}
    </ScreenTitleContext.Provider>
  );
}

/** `HeaderNav`'s own read side. */
export function useScreenTitle(): string {
  return useContext(ScreenTitleContext)?.title ?? '';
}

/**
 * A screen calls this once, unconditionally, near the top of its component
 * (before any early return — Rules of Hooks) with whatever its heading
 * currently is. Re-registers whenever `title` itself changes (e.g.
 * `ProgressionScreen`'s title starts as a placeholder and becomes the
 * loaded exercise's name once data resolves). A layout effect, not a plain
 * one, so the new screen's title is in place before the browser paints —
 * otherwise the previous screen's title would flash for one frame after a
 * route change, since React unmounts/mounts across routes rather than
 * re-rendering one persistent component.
 */
export function useSetScreenTitle(title: string): void {
  const ctx = useContext(ScreenTitleContext);
  useLayoutEffect(() => {
    ctx?.setTitle(title);
  }, [ctx, title]);
}
