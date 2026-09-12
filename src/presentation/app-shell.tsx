/**
 * Layout route rendered around every tab destination (`main.tsx`): a
 * scrollable content region above the persistent `BottomNav`. Kept as a
 * thin flex wrapper rather than `position: fixed` so no per-screen bottom
 * padding is needed to avoid the nav covering content.
 */
import { Outlet } from 'react-router-dom';
import { BottomNav } from './nav/bottom-nav';
import './app-shell.css';

export function AppShell() {
  return (
    <div className="app-shell">
      <div className="app-shell__content">
        <Outlet />
      </div>
      <BottomNav />
    </div>
  );
}

/**
 * `docs/requirements.md` FR-1 / `docs/design.md` §6: the logging form is
 * reached from a floating action on the diary, not a permanent nav tab —
 * it renders in its own shell, sharing `AppShell`'s sizing (each screen's
 * own root element still assumes it's inside this flex column, per
 * `app-shell.css`'s comment) but with no `BottomNav`, since it isn't one
 * of the destinations that bar surfaces.
 */
export function LoggingShell() {
  return (
    <div className="app-shell">
      <div className="app-shell__content">
        <Outlet />
      </div>
    </div>
  );
}
