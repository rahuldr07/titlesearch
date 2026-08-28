import type { SourcePage } from "@titlepipe/contract";
import { CitationBox } from "../../entities/evidence/PaperSheet";

/**
 * INVARIANT 33, ON A PAGE THAT IS TEXT.
 *
 * The invariant says "provenance coordinates render as a pin on the source
 * page raster". There is no raster: `endpoints.ts:664` serves pages as LINES,
 * because "the recorded line coordinates index into this text". So the pin is
 * drawn in the coordinate system the wire actually has — the marked line gets
 * `CitationBox` (the 1.5px accent rule over the 16% fill, from the evidence
 * register), and the page-level pin is the weak mark, `--color-surface-pin`,
 * whose token comment names it exactly: "this field points here".
 *
 * The two strengths are the reason a missing line index does not collapse into
 * "no pin". A field can cite a page without citing a line, and the honest
 * render of that is a pin on the PAGE plus a sentence saying no line
 * coordinate was recorded — not a silently unmarked sheet, and not a guess at
 * which line the value came from.
 */
function Pin(props: { readonly n: number; readonly marked: number | null }) {
  return (
    <p
      data-testid="scan-pin"
      className="rounded-paper bg-surface-pin px-4 py-3 font-mono text-meta leading-body text-scan-ink"
    >
      {props.marked === null
        ? `p${props.n} — the selected field cites this page. No line coordinate was recorded, so the pin marks the page.`
        : `p${props.n} · line ${props.marked + 1} — the selected field cites the marked line.`}
    </p>
  );
}

/**
 * `read_in_full: false` IS A STATEMENT, NOT AN ABSENCE.
 *
 * `endpoints.ts:664` is unusually direct about it: "most pages of a county
 * package carry no field the report needs, and a page nobody typed is normal
 * rather than an error." So this renders as words on the paper. It is not an
 * error state, it is not an empty page, and it does not borrow the halt or
 * attend families — a reviewer who learns to read this as a fault will chase
 * fifty-seven of them per package.
 */
function NotInFull() {
  return (
    <p
      data-testid="scan-not-read-in-full"
      className="border-t border-page-line pt-4 text-meta leading-body text-scan-ink"
    >
      The server did not record a full read of this page. Normal for a county
      package, and not a gap — what is shown above is what was read off it.
    </p>
  );
}

/**
 * A PAGE WITH NO ENTRY IN `pages[]` — the fifty-seven, in the live fixture.
 *
 * Rule 8's prohibition does the work here: "never grey placeholder bars." A
 * skeleton bar means "not here yet", and this page is here — it is in the
 * package, the server counted it in `total_pages`, and nobody read it. So it
 * is still a sheet of paper, and it says so in the paper's own voice.
 */
function Unread(props: { readonly n: number }) {
  return (
    <p data-testid="scan-unread-page" className="text-body leading-scan">
      Page {props.n} is in this package and no reader typed it. The server
      served no lines for it, which is not the same as a blank page and not the
      same as a page that could not be read.
    </p>
  );
}

export function PageBody(props: {
  readonly n: number;
  readonly page: SourcePage | null;
  readonly line: number | null;
  readonly pinned: boolean;
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
      {props.pinned && <Pin n={props.n} marked={marked} />}
      <div data-testid="scan-lines" className="flex flex-col">
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
