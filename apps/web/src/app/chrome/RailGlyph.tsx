/** ONE LINE GLYPH PER DOOR. The design's rail draws them and ours drew none. */

/** 24x24 grid, stroke only. Subpaths are concatenated into one `d`. */
const GLYPHS: Readonly<Record<string, string>> = {
  // Overview — the reference's own grid mark on its first door.
  "/": "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z",
  // Queue — the reference's list mark on its second door: rules and bullets.
  "/queue": "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  "/ingest": "M12 3v11m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2",
  "/dashboard": "M4 4v16h16M8 15l3.5-4.5 3 2.5L19 7",
  "/delivery": "M21 3 10.5 13.5M21 3l-6.5 18-4-8-8-4z",
  "/orders":
    "M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7zM14 3v4h4M9 14l2 2 4-4",
  "/orders-list": "M3 5h18M3 10h18M3 15h12M3 20h12",
  "/templates": "M4 4h16v5H4zM4 12h7v8H4zM14 12h6v8h-6z",
  "/jurisdiction": "M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5",
  "/escalations": "M12 4 2.8 20h18.4zM12 10v3.5M12 17h.01",
  "/complaints": "M20 14a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2z",
  "/reconciliation": "M4 8h13m-3-3 3 3-3 3M20 16H7m3-3-3 3 3 3",
  "/golden": "m12 3.5 2.7 5.6 6.1.9-4.4 4.3 1 6.2-5.4-2.9-5.4 2.9 1-6.2L3.2 10l6.1-.9z",
  "/seed-correction":
    "M4 20.5h4.2L20.3 8.4a2.9 2.9 0 1 0-4.1-4.1L4 16.3zM14.5 6l3.5 3.5",
  "/bench":
    "M9.5 3v6.2L4.2 18a2 2 0 0 0 1.7 3h12.2a2 2 0 0 0 1.7-3l-5.3-8.8V3M8 3h8M7 15h10",
  "/leaderboard": "M3 21h18M7 21v-8M12 21V4M17 21v-5",
  "/blind": "M3 6.5h18v11H3zM7 10h.01M11 10h.01M15 10h.01M8.5 14h7",
  "/blind-status": "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18M12 7.5V12l3 2",
  "/account":
    "M12 12.5a4.2 4.2 0 1 0 0-8.4 4.2 4.2 0 0 0 0 8.4M4.5 20.5a7.5 7.5 0 0 1 15 0",
};

/**

 * `aria-hidden` without exception: the door's LABEL names the door, and a screen

 * reader that also announced the picture would say it twice.

 */
export function RailGlyph(props: { readonly path: string; readonly active: boolean }) {
  const d = GLYPHS[props.path];
  if (d === undefined) return null;
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={props.active ? "shrink-0" : "shrink-0 text-rail-accent"}
    >
      <path d={d} />
    </svg>
  );
}
