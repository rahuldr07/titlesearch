import type { LineCoords, SourcePage } from "@titlepipe/contract";
import { Button, cx } from "../../components/ui";
import { PaperSheet } from "../../entities/evidence/PaperSheet";
import { ClerkStamp } from "../../entities/evidence/ClerkStamp";
import { PageBody } from "./PageBody";
import type { ZoomLevel } from "./PageBar";

/**

 * MAGNIFICATION IS `zoom`, NOT `scale`, AND THAT IS A SCROLLING DECISION. `scale-200`

 * sets the `scale` property, which paints the sheet at twice the size while its LAYOUT

 * BOX stays 396px — so the overflow it creates is invisible to the…

 */
const ZOOM: Record<ZoomLevel, string> = {
  fit: "[zoom:1]",
  half: "[zoom:1.5]",
  double: "[zoom:2]",
};

/**
 * ONE SHEET OF THE PACKAGE, AS PAPER (rule 8). `PaperSheet` is the surface —
 * warm stock, serif, justified, the grain, the −.35° tilt, and the degraded
 * register — imported rather than re-drawn.
 *
 * ZOOM-TO-CITATION — ⚠ RULED 2026-08-29 (RULING-2026-08-29.md): when the open
 * field's recorded box is on THIS sheet and the citation zoom is on, the
 * wrapper scales to the reference's 1.85 over its 300ms curve with the
 * transform-origin at the box's centre. The origin is data (two percentages
 * off `LineCoords`), and §6 bans inline styles — so, exactly like
 * `CitedRegion`'s SVG geometry, it bypasses the class system: a ref callback
 * writes the two custom properties `entities.css`'s `tp-zoom-cite` reads.
 * Double-click toggles it and the drawn "Fit ✕" chip exits, both as drawn.
 */
export function PageSheet(props: {
  readonly n: number;
  readonly total: number;
  readonly page: SourcePage | null;
  readonly line: number | null;
  readonly pinned: boolean;
  /**
   * The recorded region, when the open field's reading carried one AND it is on
   * this sheet. The caller does that comparison — a box drawn on the wrong page
   * would be a citation pointing at the wrong document. Drawn by `PageBody`,
   * which owns the block the coordinates are measured against.
   */
  readonly box: LineCoords | null;
  readonly zoom: ZoomLevel;
  readonly citeZoom: boolean;
  readonly onCiteZoom: (on: boolean) => void;
}) {
  const zoomed = props.citeZoom && props.box !== null;
  const box = props.box;

  return (
    <div className={cx("relative flex justify-center overflow-hidden p-8", ZOOM[props.zoom])}>
      <div
        data-testid="cite-zoom-wrap"
        data-cite-zoomed={zoomed ? "1" : "0"}
        onDoubleClick={() => props.onCiteZoom(!props.citeZoom)}
        ref={(el) => {
          if (el === null) return;
          /* The drawn origin: the box centre, as percentages of the sheet.
             Written through the DOM API — see the header note. */
          const cx100 = box === null ? 50 : (box.x + box.w / 2) * 100;
          const cy100 = box === null ? 50 : (box.y + box.h / 2) * 100;
          el.style.setProperty("--tp-zoom-cx", `${String(cx100)}%`);
          el.style.setProperty("--tp-zoom-cy", `${String(cy100)}%`);
        }}
        className={cx("w-198 shrink-0 tp-zoom-cite", zoomed && "tp-zoom-cite-on")}
      >
        <PaperSheet
          degraded={props.page?.degraded === true}
          stamp={
            props.page === null ? undefined : (
              <ClerkStamp
                caption={props.page.kind}
                detail={`p${props.n} / ${props.total}`}
              />
            )
          }
        >
          <PageBody
            n={props.n}
            page={props.page}
            line={props.line}
            pinned={props.pinned}
            box={props.box}
          />
        </PaperSheet>
      </div>

      {zoomed && (
        <div className="absolute top-4 right-4 z-10">
          <Button
            size="sm"
            data-testid="cite-zoom-fit"
            onPress={() => props.onCiteZoom(false)}
          >
            Fit ✕
          </Button>
        </div>
      )}
    </div>
  );
}
