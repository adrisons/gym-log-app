/**
 * A fixed, locale-independent "12 Sep 2026" date form (ADR-0009), used
 * where a diary date needs to read the same regardless of the viewer's own
 * device locale. Built by hand from a fixed month-name table rather than
 * `Intl.DateTimeFormat`: CLDR's own short-month data isn't uniformly
 * 3-letter across locales (`en-GB`'s September abbreviates to "Sept", not
 * "Sep"), so no single `Intl` locale reliably produces this exact form —
 * the whole point here is one legible, unambiguous shape, not whatever a
 * locale happens to abbreviate to.
 */
const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function formatDiaryDate(dateTime: string): string {
  const date = new Date(dateTime);
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}
