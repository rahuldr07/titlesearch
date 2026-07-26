import { useEffect, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import type { HighlightTone, NormRect, PdfHighlight } from "./coords";

/**
 * PdfPane + coordinate overlay — built once, used by Review, Extraction
 * Bench, Reconciliation, Seed Correction (frontend-master-prompt §3).
 *
 * The overlay is an absolutely-positioned layer scaled with the rendered
 * page. `line_coords` is contractually opaque (its final shape lands with the
 * LLMWhisperer adapter, P2) — everything codes against the minimal normalized
 * placeholder below, and the mapping lives in exactly ONE function
 * (`parseLineCoords`). Engines without coordinates declare none — no overlay,
 * snippet callout only. Never a faked box.
 *
 * There is no source-page endpoint in the contract yet (CONTRACT GAP — see
 * repo notes), so `fileUrl` is null under MSW and the pane renders the
 * designed mock page from the .dc.html spec. When the endpoint lands, the
 * same highlights render over react-pdf output.
 */

// The pdfjs worker is copied from the version-pinned `pdfjs-dist` into `public/`
// by scripts/copy-pdf-worker.mjs (run before dev/build), so it is served from
// the site root and lands in dist. A `?url`/`?worker` import fails on Vite 8's
// rolldown resolver for node_modules paths, and a bare `new URL(...,
// import.meta.url)` never emits the file — this keeps it version-synced and
// bundler-agnostic.
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

function rectCss(r: NormRect) {
  return {
    left: `${r.x0 * 100}%`,
    top: `${r.y0 * 100}%`,
    width: `${(r.x1 - r.x0) * 100}%`,
    height: `${(r.y1 - r.y0) * 100}%`,
  };
}

const calloutBorder: Record<HighlightTone, string> = {
  ok: "border-state-settled",
  attend: "border-state-attend-border",
  act: "border-state-halt",
  pin: "border-page-ref-border",
};
const chipBg: Record<HighlightTone, string> = {
  ok: "bg-document-settled-border",
  attend: "bg-border-evidence",
  act: "bg-state-halt",
  pin: "bg-state-idle",
};

function CalloutHighlight({ hl }: { hl: PdfHighlight }) {
  const top = hl.rects[0] ? `${hl.rects[0].y0 * 100}%` : "20%";
  return (
    <div
      id={`hl-${hl.id}`}
      onClick={hl.onClick}
      className={`tp-highlight-arrive absolute left-[8%] w-[84%] rounded-[3px] border-2 bg-surface-evidence ${calloutBorder[hl.tone]}`}
      style={{ top }}
    >
      <div
        className={`absolute -top-5 -left-0.5 rounded-t-[3px] px-[7px] py-px text-[10px] font-bold tracking-[.06em] text-ink-on-action ${chipBg[hl.tone]}`}
      >
        {hl.chip}
      </div>
      <div className="px-2 py-[6px] font-mono text-[12.5px] text-ink-primary">
        {hl.snippet}
      </div>
    </div>
  );
}

function LineHighlight({ hl }: { hl: PdfHighlight }) {
  return (
    <>
      {hl.rects.map((r, i) => (
        <div
          key={i}
          id={i === 0 ? `hl-${hl.id}` : undefined}
          onClick={hl.onClick}
          className={`tp-highlight-arrive absolute rounded-[2px] border-2 bg-surface-pin ${calloutBorder[hl.tone]}`}
          style={rectCss(r)}
        >
          {i === 0 && (
            <div
              className={`absolute -top-[18px] -left-0.5 rounded-t-[3px] px-[7px] py-px text-[10px] font-bold tracking-[.06em] whitespace-nowrap text-ink-on-action ${chipBg[hl.tone]}`}
            >
              {hl.chip}
            </div>
          )}
        </div>
      ))}
    </>
  );
}

function OverlayLayer({ highlights }: { highlights: PdfHighlight[] }) {
  return (
    <>
      {highlights.map((hl) =>
        hl.snippet !== undefined ? (
          <CalloutHighlight key={hl.id} hl={hl} />
        ) : hl.rects.length > 0 ? (
          <LineHighlight key={hl.id} hl={hl} />
        ) : null,
      )}
    </>
  );
}

export function PdfPane({
  fileUrl,
  page,
  pageStamp,
  highlights,
  scrollKey,
}: {
  fileUrl: string | null;
  page: number;
  /** e.g. "PAGE 29 OF 41" — bottom-right stamp on the mock page. */
  pageStamp: string;
  highlights: PdfHighlight[];
  /** change → re-centre the first highlight (S key / selection change). */
  scrollKey: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const first = highlights[0];
    if (!first) return;
    const el = document.getElementById(`hl-${first.id}`);
    el?.scrollIntoView({ block: "center" });
  }, [scrollKey, highlights]);

  return (
    <div
      ref={scrollRef}
      className="flex flex-1 justify-center overflow-y-auto px-5 py-[22px]"
    >
      {fileUrl ? (
        <div className="relative flex-none self-start">
          <Document file={fileUrl}>
            <Page pageNumber={page} width={540} />
          </Document>
          <div className="absolute inset-0">
            <OverlayLayer highlights={highlights} />
          </div>
        </div>
      ) : (
        <div className="relative aspect-[8.5/11] w-[540px] flex-none self-start rounded-[2px] bg-page shadow-page">
          {/* designed mock page (.dc.html): title bar + text-line-strong texture */}
          <div className="absolute top-[26px] left-[44px] h-[14px] w-[46%] rounded-[2px] bg-page-bar" />
          <div
            className="absolute top-[52px] right-[44px] bottom-[40px] left-[44px]"
            style={{
              background:
                "repeating-linear-gradient(to bottom, var(--color-page-line) 0 9px, transparent 9px 22px)",
            }}
          />
          <div className="absolute right-6 bottom-[14px] font-mono text-[10px] text-ink-muted">
            {pageStamp}
          </div>
          <OverlayLayer highlights={highlights} />
        </div>
      )}
    </div>
  );
}
