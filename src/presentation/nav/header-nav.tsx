/**
 * Primary navigation (ADR-0009 — supersedes the always-visible `BottomNav`
 * bar): a slim header, present on every `AppShell` route (never
 * `LoggingShell` — the logging form is reached from the diary's own FAB,
 * not this menu, `docs/design.md` §6), with a single right-aligned
 * hamburger button that opens a dropdown listing the destinations the
 * project owner asked to keep here: Diary, Insights, Exercises, and
 * (spec 006 FR-001/006) Settings — the screen closing v1
 * (`docs/agent-brief.md` Phase 6) needs a reachable entry point, and this
 * menu is this app's one navigation surface outside the logging FAB.
 * Exercise search-by-catalogue (`/search`) deliberately has no entry here
 * anymore — it stays routable (linked from a session's own exercises and
 * from Insights cards), it just isn't one of this menu's items, now
 * that the diary's own search (FR-6) covers "find a session by exercise".
 *
 * The menu closes on: choosing a destination (`NavLink`'s own `onClick`),
 * Escape, or a click/focus outside it — the last two via one
 * document-level listener attached only while open, removed again on
 * close so a closed menu costs nothing. Focus returns to the hamburger
 * button on every close path except "chose a destination", where the
 * browser's own navigation already moves focus meaningfully elsewhere.
 *
 * Also renders the current screen's own title (`useScreenTitle`,
 * `screen-title.tsx`) to the left of the menu button — design-refinement
 * request to save the vertical space each screen's own `<h1>` used to take.
 *
 * ADR-0014: a screen registering a `backTo` route (`useScreenBackTo`) gets
 * a back arrow rendered before the title, reusing the same rotated
 * `chevron-right` glyph `LoggingScreen`'s own "‹ Diary" link already uses
 * for "back" — one visual vocabulary for the gesture across the app,
 * rather than a second icon meaning the same thing.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Icon } from '@/presentation/design/icons';
import type { IconName } from '@/presentation/design/icons';
import { useScreenBackTo, useScreenTitle } from './screen-title';
import './header-nav.css';

const DESTINATIONS: { to: string; label: string; icon: IconName }[] = [
  { to: '/diary', label: 'Diary', icon: 'book' },
  { to: '/insights', label: 'Insights', icon: 'chart' },
  { to: '/exercises', label: 'Exercises', icon: 'list' },
  { to: '/settings', label: 'Settings', icon: 'sliders' },
];

export function HeaderNav() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const title = useScreenTitle();
  const backTo = useScreenBackTo();

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !buttonRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <header className="header-nav">
      {backTo && (
        <Link to={backTo} className="header-nav__back" aria-label="Back">
          <Icon name="chevron-right" style={{ transform: 'rotate(180deg)' }} />
        </Link>
      )}
      {title && <h1 className="header-nav__title">{title}</h1>}
      <button
        ref={buttonRef}
        type="button"
        className="header-nav__toggle"
        aria-label="Menu"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="menu" />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="header-nav__menu"
          role="menu"
          aria-label="Primary"
        >
          {DESTINATIONS.map((destination) => (
            <NavLink
              key={destination.to}
              to={destination.to}
              role="menuitem"
              className={({ isActive }) =>
                `header-nav__item${isActive ? ' header-nav__item--active' : ''}`
              }
              onClick={() => setOpen(false)}
            >
              <Icon name={destination.icon} />
              <span>{destination.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </header>
  );
}
