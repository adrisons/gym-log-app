/**
 * The app's one persistent navigation surface — five top-level
 * destinations, always reachable, replacing what used to be a scatter of
 * inline text links per screen (`DiaryScreen` had "Search exercises" /
 * "Insights" / "Manage exercises"; `LoggingScreen` had no way back to the
 * diary at all). Icon + word on every tab (docs/design.md §1.2, §7.4 —
 * an icon is never the only carrier of meaning); the active tab is the
 * one place this app's single chromatic accent is spent on "current
 * selection" (docs/design.md §1.2/§3.1's own definition of what the
 * accent role is for), not a second color introduced for the nav itself.
 */
import { NavLink } from 'react-router-dom';
import { Icon } from '@/presentation/design/icons';
import type { IconName } from '@/presentation/design/icons';
import './bottom-nav.css';

const TABS: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: '/', label: 'Log', icon: 'dumbbell', end: true },
  { to: '/diary', label: 'Diary', icon: 'book', end: false },
  { to: '/search', label: 'Search', icon: 'search', end: false },
  { to: '/insights', label: 'Insights', icon: 'chart', end: false },
  { to: '/exercises', label: 'Exercises', icon: 'list', end: false },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
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
