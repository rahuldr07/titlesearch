import type { LineCoords, SourcePage } from "@titlepipe/contract";
import { CitationBox } from "../../entities/evidence/PaperSheet";
import { CitedRegion } from "./CitedRegion";

/**

 * Invariant 33, on a page that is text. The invariant says "provenance coordinates

 * render as a pin on the source page raster".

 *
 * THE THIRD SENTENCE IS NEW AND THE OTHER TWO ARE NOT. `source_line_coords` was
 * `z.unknown()` until 2026-08-28, so this pin could only ever say the page was
 * cited and no coordinate existed — for fields that had carried one all along.
 * With a real `LineCoords` the pin says which of the three actually happened,
 * and `CitedRegion` draws the box the third case describes.
 */
function Pin(props: {
  readonly n: number;
  readonly marked: number | null;
  readonly box: LineCoords | null;
}) {
  const text =
    props.marked !== null
      ? `p${props.n} · line ${props.marked + 1} — the selected field cites the marked line.`
      : props.box !== null
        ? `p${props.n} — the selected field cites this page, and the boxed region is where the reading was taken.`
        : `p${props.n} — the selected field cites this page. No line coordinate was recorded, so the pin marks the page.`;

  return (
    <p
      data-testid="scan-pin"
      className="rounded-paper bg-surface-pin px-4 py-3 font-mono text-meta leading-body text-scan-ink"
    >
      {text}
    </p>
  );
}

/**

 * `read_in_full: false` IS A STATEMENT, NOT AN ABSENCE. `endpoints.ts:664` is

 * unusually direct about it: "most pages of a county package carry no field the report

 * needs, and a page nobody typed is normal rather than an error." So this…

 */
function NotInFull() {
  return (
    <p
      data-testid="scan-not-read-in-full"
      className="border-t border-page-line pt-4 text-meta leading-body text-scan-ink"
    >
      The server did not record a full read of this page. Normal for a county package,
      and not a gap — what is shown above is what was read off it.
    </p>
  );
}

/**

 * A PAGE WITH NO ENTRY IN `pages[]` — the fifty-seven, in the live fixture. Rule 8's

 * prohibition does the work here: "never grey placeholder bars." A skeleton bar means

 * "not here yet", and this page is here — it is in the package, the…

 */
function Unread(props: { readonly n: number }) {
  return (
    <p data-testid="scan-unread-page" className="text-body leading-scan">
      Page {props.n} is in this package and no reader typed it. The server served no
      lines for it, which is not the same as a blank page and not the same as a page
      that could not be read.
    </p>
  );
}

export function PageBody(props: {
  readonly n: number;
  readonly page: SourcePage | null;
  readonly line: number | null;
  readonly pinned: boolean;
  readonly box: LineCoords | null;
}) {
  const page = props.page;
  if (page === null) return <Unread n={props.n} />;

  /* An index the server's own `lines[]` cannot honour marks nothing. */
  const marked =
    props.line !== null && props.line >= 0 && props.line < page.lines.length
      ? props.line
      : null;

  return (
    <div className="flex flex-col gap-6">
      {props.pinned && <Pin n={props.n} marked={marked} box={props.box} />}
      {/*
        THE BOX IS MEASURED AGAINST THE LINES, NOT THE SHEET, and that is the
        whole reason this div is positioned. Hung off `PaperSheet` the overlay
        stretched over the stock's padding, the clerk stamp and the pin
        paragraph too — about 168px of chrome that is not the page's text —
        and every region landed a line and a half high.
      */}
      <div data-testid="scan-lines" className="relative flex flex-col">
        {props.box !== null && <CitedRegion box={props.box} />}
        {page.lines.map((text, i) => (
          <p key={`${props.n}:${i}`} className="whitespace-pre-wrap">
            {/* A blank line in the source is a blank line on the page. */}
            {text.length === 0 ? " " : null}
            {marked === i ? <CitationBox>{text}</CitationBox> : text}
          </p>
        ))}
      </div>
      {!page.read_in_full && <NotInFull />}
    </div>
  );
}
