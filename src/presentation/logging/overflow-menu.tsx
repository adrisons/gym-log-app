/**
 * A small "⋮" disclosure popover for a card's secondary actions
 * (docs/design.md §2 "secondary actions are present but visually
 * quieter") — keyboard operable (Escape closes it, the trigger is a plain
 * button) and not hover-only, per §5/§7.4. Each item is expected to be a
 * `.logging-button` the caller renders as a child. The menu closes on
 * Escape or an outside click/tap, not on every click inside it — a child
 * can be a `<select>` (ExerciseEntryCard's "move to block"), and closing
 * mid-interaction with a native form control would drop the interaction
 * entirely.
 *
 * Deliberately NOT an ARIA `menu`/`menuitem` widget: that pattern requires
 * arrow-key roving focus and forbids ordinary interactive descendants like
 * the `<select>` above, neither of which this component provides. It is a
 * disclosure exposing ordinary, individually tab-reachable buttons — the
 * plain, correct choice given what's actually implemented.
 */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from '@/presentation/design/icons';
import './logging.css';

export interface OverflowMenuProps {
  label: string;
  children: ReactNode;
  className?: string;
}

export function OverflowMenu({
  label,
  children,
  className,
}: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  return (
    <div
      ref={containerRef}
      className={`overflow-menu${className ? ` ${className}` : ''}`}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        type="button"
        className="logging-button overflow-menu__trigger"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((current) => !current)}
      >
        <Icon name="more-vertical" />
      </button>
      {open && (
        <div role="group" aria-label={label} className="overflow-menu__list">
          {children}
        </div>
      )}
    </div>
  );
}
