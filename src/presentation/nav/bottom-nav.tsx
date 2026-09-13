/**
 * The app's one persistent navigation surface — four top-level
 * destinations the user returns to repeatedly, always reachable. Logging
 * (`docs/requirements.md` FR-1) is deliberately not one of them: it's
 * reached from a floating action on the diary instead, one tap away
 * without occupying a permanent slot in a bar that would otherwise sit
 * idle between sessions (`docs/design.md` §6's refinement note). Icon +
 * word on every tab (docs/design.md §1.2, §7.4 — an icon is never the
 * only carrier of meaning); the active tab is the one place this app's
 * single chromatic accent is spent on "current selection" (docs/design.md
 * §1.2/§3.1's own definition of what the accent role is for), not a
 * second color introduced for the nav itself.
 *
 * Publishes its own rendered height as `--bottom-nav-height` on the root
 * element: this bar sits in normal flex flow (`app-shell.css`), but the
 * diary's floating FAB/bulk-bar (`presentation/diary/diary.css`) are
 * `position: fixed` and so need this bar's height to float just above it
 * rather than guessing a fixed pixel value that drifts if this bar's own
 * content ever changes. Guarded for `ResizeObserver`'s absence in the
 * jsdom test environment.
 */
import { useLayoutEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { Icon } from '@/presentation/design/icons';
import type { IconName } from '@/presentation/design/icons';
import './bottom-nav.css';

const TABS: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: '/diary', label: 'Diary', icon: 'book', end: false },
  { to: '/search', label: 'Search', icon: 'search', end: false },
  { to: '/insights', label: 'Insights', icon: 'chart', end: false },
  { to: '/exercises', label: 'Exercises', icon: 'list', end: false },
];

export function BottomNav() {
  const navRef = useRef<HTMLElement>(null);

  useLayoutEffect(() => {
    const node = navRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;
    const publishHeight = () => {
      document.documentElement.style.setProperty(
        '--bottom-nav-height',
        `${node.offsetHeight}px`,
      );
    };
    publishHeight();
    const observer = new ResizeObserver(publishHeight);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <nav ref={navRef} className="bottom-nav" aria-label="Primary">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `bottom-nav__tab${isActive ? ' bottom-nav__tab--active' : ''}`
          }
        >
          <Icon name={tab.icon} />
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
