/**
 * A fact about how a row is drawn — 60px, the design's own `rowMap` figure
 * (reference-app.html:3944), and far above WCAG 2.5.8's 24px target
 * minimum, which matters because a row is clickable. In its own module so
 * tableRow.tsx exports only components (fast refresh); the row chrome
 * (tableRow.tsx) and the virtualizer (table.tsx) both read it.
 */
export const ROW_HEIGHT = 60;
