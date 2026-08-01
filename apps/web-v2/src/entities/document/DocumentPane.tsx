import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { EvidenceOverlay } from "./EvidenceOverlay";
import { ZoomControls } from "./ZoomControls";
import { CitedText } from "./CitedText";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import type { EvidenceBox } from "./coordinates";
import { cn } from "../../shared/ui/classNames";

/**
 * The scanned page and its evidence highlight — the highest-value surface in
 * the product. Everything else exists to get a reviewer here, on the right page.
 *
 * SOURCE PAGES ARE RASTERS, NOT PDF. BRIEF §4 restricts react-pdf to the report
 * preview and §7 says cited page rasters are prefetched. `component-inventory`
 * §2.4 says "react-pdf page render"; that predates the brief and is overridden
 * here — a PDF renderer on this path would also defeat the prefetch design,
 * which exists so field-to-field movement touches no network.
 *
 * `surround` exists because of decisions.md D2, reversed by the owner: Review
 * ships the LIGHT pane as drawn, three measurement screens keep the dark
 * register. One prop, two registers, no forked component.
 */
/*
 * react-zoom-pan-pinch sets width/height as INLINE styles on its own wrapper.
 * An inline style can only be beaten by `!important`, so Tailwind's `!` prefix
 * is the sole way to make the viewport fill its parent. Restructured into
 * constants so the exemption can carry its reason on a line of its own.
 */
const FILL = "!w-full !h-full"; // rules-allow: overrides the library's inline width/height, which nothing else can beat
const FILL_X = "!w-full"; // rules-allow: overrides the library's inline width, which nothing else can beat

export function DocumentPane({
  pageSrc,
  page,
  readInFull,
  boxes,
  snippet,
  surround = "light",
  degraded = false,
}: {
  /** Prefetched raster for this page. */
  pageSrc: string;
  page: number;
  /** Server-supplied. A page not read in full is normal, not an error. */
  readInFull: boolean;
  /** `null` = the engine declared no coordinates. Renders no overlay at all. */
  boxes: readonly EvidenceBox[] | null;
  /** The cited text. Always present — it is the citation of record. */
  snippet: string;
  surround?: "light" | "dark";
  degraded?: boolean;
}) {
  const dark = surround === "dark";

  return (
    <section
      aria-label={`Source page ${page}`}
      className={cn("flex h-full flex-col", dark ? "bg-document-bg" : "bg-surface-document")}
    >
      <div className="flex-1 overflow-hidden">
        {readInFull ? (
          <TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit>
            {({ zoomIn, zoomOut, resetTransform }) => (
              <>
                <div className="px-6 py-4">
                  <ZoomControls
                    dark={dark}
                    onZoomIn={() => zoomIn()}
                    onZoomOut={() => zoomOut()}
                    onReset={() => resetTransform()}
                  />
                </div>
                <TransformComponent wrapperClass={FILL} contentClass={FILL_X}>
                  <div className="relative mx-auto w-full">
                    <img
                      src={pageSrc}
                      // Decorative: the page's content reaches assistive tech as
                      // the cited snippet below, which is the citation of record.
                      alt=""
                      className={cn(
                        "block w-full",
                        dark ? "shadow-page-on-dark" : "shadow-page",
                        degraded ? "filter-scan-degraded" : "filter-scan",
                      )}
                    />
                    {/* No coordinates => no overlay. Never a faked rectangle. */}
                    <EvidenceOverlay boxes={boxes ?? []} />
                  </div>
                </TransformComponent>
              </>
            )}
          </TransformWrapper>
        ) : (
          <NotReadInFull page={page} />
        )}
      </div>

      <CitedText snippet={snippet} hasCoordinates={boxes !== null} dark={dark} />
    </section>
  );
}

/** Never a blank pane — an empty region reads as "nothing here", which is false. */
function NotReadInFull({ page }: { page: number }) {
  return (
    <div className="flex h-full items-center justify-center p-11 text-center">
      <div>
        {/*
          THE PANE IS DARK IN BOTH REGISTERS since the 2026-08-01 reskin —
          `--color-surface-document` took the mockup's viewer surround value
          and now holds the same value as `--color-document-bg`. So this text
          sits on a near-black ground whichever `surround` is asked for, and the
          chrome inks it used to reach for measure 1.89:1 (`state-attend-ink`)
          and 1.68:1 (`ink-secondary`) there. The `--color-document-*` family is
          the pane's own vocabulary and is the only legible choice; the `dark`
          branch below was already correct and is now unconditional.
        */}
        <Eyebrow variant="caption" tone="attend" className="text-document-attend">
          Not read in full
        </Eyebrow>
        <p className="mt-3 text-base text-document-ink-soft">
          Page {page} is in the package but was not captured in full, so there is
          no raster to show. That is expected for most pages.
        </p>
      </div>
    </div>
  );
}
