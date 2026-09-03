import type { LineCoords, SourcePage } from "@titlepipe/contract";
import { CitationBox } from "../../entities/evidence/PaperSheet";
import { CitedRegion } from "./CitedRegion";

/**
 * The provenance pin, on a page that is text. It states which of three
 * things happened — a marked line, a boxed region, or a cited page with no
 * recorded coordinate — and `CitedRegion` draws the box for the second.
 */
function Pin(props: {
  readonly n: number;
  readonly marked: number | null;
  readonly box: LineCoords | null;
  /** See PageBody's prop — decides whose citation this sentence claims. */
  readonly previewing: boolean;
}) {
  /*
   * WHOSE citation this is. While a row is being hovered the sheet shows
   * THAT row's page, not the open field's — and this sentence used to say
   * "the selected field cites this page" either way, which put a citation
   * on screen for a field that does not carry it. The subject is named
   * from what is actually being drawn.
   */
  const subject = props.previewing ? "the row under the pointer" : "the selected field";
  const text =
    props.marked !== null
      ? `p${props.n} · line ${props.marked + 1} — ${subject} cites the marked line.`
      : props.box !== null
        ? `p${props.n} — ${subject} cites this page, and the boxed region is where the reading was taken.`
        : `p${props.n} — ${subject} cites this page. No line coordinate was recorded, so the pin marks the page.`;

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
 * `read_in_full: false` is a statement, not an absence: most pages of a
 * county package carry no field the report needs, and a page nobody typed
 * is normal rather than an error.
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
 * A page with no entry in `pages[]`. Never a grey placeholder bar: a
 * skeleton means "not here yet", and this page is here — it is in the
 * package and no reader typed it.
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
  /** The sheet is drawing a hovered row's citation, not the open field's. */
  readonly previewing: boolean;
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
      {props.pinned && (
        <Pin n={props.n} marked={marked} box={props.box} previewing={props.previewing} />
      )}
      {/*
        The box is measured against the lines, not the sheet — that is the
        whole reason this div is positioned. Hung off `PaperSheet` the
        overlay would stretch over padding, stamp and pin, and every region
        would land high.
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
