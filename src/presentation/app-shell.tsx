/**
 * Layout route rendered around every screen (`main.tsx`): a scrollable
 * content region above the persistent `BottomNav`. Kept as a thin flex
 * wrapper rather than `position: fixed` so no per-screen bottom padding
 * is needed to avoid the nav covering content.
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
