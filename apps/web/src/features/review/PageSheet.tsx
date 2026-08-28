import type { LineCoords, SourcePage } from "@titlepipe/contract";
import { cx } from "../../components/ui";
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

 * ONE SHEET OF THE PACKAGE, AS PAPER (rule 8). `PaperSheet` is the surface — warm

 * stock, serif, justified, the grain, the −.35° tilt, and the degraded register — and

 * it is imported rather than re-drawn.

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
}) {
  return (
    <div className={cx("flex justify-center p-8", ZOOM[props.zoom])}>
      <div className="w-198 shrink-0">
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
    </div>
  );
}
