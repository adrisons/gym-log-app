/**
 * A scrollable "wheel" picker for a small set of discrete values (reps,
 * effort) — CSS scroll-snap does the actual snapping, so momentum
 * scrolling always rests on a real option. Equally usable without a
 * pointer (docs/design.md §5/§7.4 "nothing essential revealed by pointer
 * only"): the whole thing is a `listbox` the arrow keys drive, with
 * Home/End/PageUp/PageDown for longer jumps, so a keyboard or switch
 * user has the same one-control access a scroll gesture gives a touch
 * user. Honors reduced-motion (docs/design.md §4.3) by scrolling
 * instantly instead of smoothly when the user has asked for that.
 */
import { useEffect, useId, useRef } from 'react';
import './logging.css';

export interface WheelPickerOption<T> {
  value: T;
  label: string;
}

export interface WheelPickerProps<T> {
  options: WheelPickerOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  className?: string;
}

const ITEM_HEIGHT_PX = 44; // the app's own generous-hit-target minimum

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function WheelPicker<T>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: WheelPickerProps<T>) {
  const idPrefix = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  const scrollToIndex = (index: number, smooth: boolean) => {
    // Optional chaining on the method itself, not just the ref: jsdom (unit
    // tests) has no scrollTo implementation at all, and this must degrade
    // to a silent no-op there rather than throw — real browsers always
    // have it, so this changes nothing outside tests.
    containerRef.current?.scrollTo?.({
      top: index * ITEM_HEIGHT_PX,
      behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'instant',
    });
  };

  // A user-driven scroll (touch drag, momentum, wheel) fires many `scroll`
  // events in quick succession, each committing its nearest option via
  // `onChange` — which changes `selectedIndex` and would otherwise re-run
  // the sync effect below mid-gesture, snapping `scrollTop` back to that
  // exact index and fighting the still-moving native scroll/momentum.
  // `isUserScrollingRef` suppresses that sync until scrolling has been
  // quiet for a moment, letting CSS scroll-snap alone settle the final
  // position; the sync effect still runs normally for a value change that
  // didn't originate from this element's own scroll (e.g. the parent
  // resetting it).
  const isUserScrollingRef = useRef(false);
  const scrollIdleTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Keep the wheel's scroll position in sync when `value` changes from
  // outside (e.g. the parent resets it), without fighting the user's own
  // in-progress scroll.
  useEffect(() => {
    if (isUserScrollingRef.current) return;
    scrollToIndex(selectedIndex, false);
    // Only re-sync when the resolved index actually changes.
  }, [selectedIndex]);

  const commitFromScroll = () => {
    isUserScrollingRef.current = true;
    clearTimeout(scrollIdleTimeoutRef.current);
    scrollIdleTimeoutRef.current = setTimeout(() => {
      isUserScrollingRef.current = false;
    }, 150);

    const container = containerRef.current;
    if (!container) return;
    const index = Math.min(
      options.length - 1,
      Math.max(0, Math.round(container.scrollTop / ITEM_HEIGHT_PX)),
    );
    const option = options[index];
    if (option && option.value !== value) onChange(option.value);
  };

  const moveBy = (delta: number) => {
    const nextIndex = Math.min(
      options.length - 1,
      Math.max(0, selectedIndex + delta),
    );
    const option = options[nextIndex];
    if (!option) return;
    onChange(option.value);
    scrollToIndex(nextIndex, true);
  };

  return (
    <div
      ref={containerRef}
      className={`wheel-picker${className ? ` ${className}` : ''}`}
      role="listbox"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-activedescendant={`${idPrefix}-${selectedIndex}`}
      onScroll={commitFromScroll}
      onKeyDown={(event) => {
        switch (event.key) {
          case 'ArrowUp':
            event.preventDefault();
            moveBy(-1);
            break;
          case 'ArrowDown':
            event.preventDefault();
            moveBy(1);
            break;
          case 'PageUp':
            event.preventDefault();
            moveBy(-10);
            break;
          case 'PageDown':
            event.preventDefault();
            moveBy(10);
            break;
          case 'Home':
            event.preventDefault();
            moveBy(-options.length);
            break;
          case 'End':
            event.preventDefault();
            moveBy(options.length);
            break;
        }
      }}
    >
      <div className="wheel-picker__spacer" aria-hidden="true" />
      {options.map((option, index) => (
        <div
          key={index}
          id={`${idPrefix}-${index}`}
          role="option"
          aria-selected={index === selectedIndex}
          className={`wheel-picker__item${index === selectedIndex ? ' wheel-picker__item--selected' : ''}`}
        >
          {option.label}
        </div>
      ))}
      <div className="wheel-picker__spacer" aria-hidden="true" />
    </div>
  );
}
