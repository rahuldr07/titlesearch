/**
 * A fact about how a row is drawn — 44px, comfortably above WCAG 2.5.8's
 * 24px target minimum, which matters because a row is clickable. In its own
 * module so tableRow.tsx exports only components (fast refresh); the row
 * chrome (tableRow.tsx) and the virtualizer (table.tsx) both read it.
 */
export const ROW_HEIGHT = 44;
