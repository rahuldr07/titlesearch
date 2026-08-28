import type { SourcePage } from "@titlepipe/contract";
import { cx } from "../../components/ui";
import { PaperSheet } from "../../entities/evidence/PaperSheet";
import { ClerkStamp } from "../../entities/evidence/ClerkStamp";
import { PageBody } from "./PageBody";
import type { ZoomLevel } from "./PageBar";

/**
 * MAGNIFICATION IS `zoom`, NOT `scale`, AND THAT IS A SCROLLING DECISION.
 *
 * `scale-200` sets the `scale` property, which paints the sheet at twice the
 * size while its LAYOUT BOX stays 396px — so the overflow it creates is
 * invisible to the scroll container and the right half of a magnified page
 * becomes unreachable. CSS `zoom` re-lays-out, so the `ScrollArea` above (which
 * is on `axis="both"` for exactly this reason, per its own doc) can actually
 * reach it. Tailwind has no `zoom` utility; the arbitrary-property form is the
 * same idiom `scroll-area.tsx` already uses for `scrollbar-width`, and it
 * carries no length, so it is not the arbitrary value §6 bans.
 */
const ZOOM: Record<ZoomLevel, string> = {
  fit: "[zoom:1]",
  half: "[zoom:1.5]",
  double: "[zoom:2]",
};

/**
 * ONE SHEET OF THE PACKAGE, AS PAPER (rule 8).
 *
 * `PaperSheet` is the surface — warm stock, serif, justified, the grain, the
 * −.35° tilt, and the degraded register — and it is imported rather than
 * re-drawn. `degraded` is passed straight through from the server's finding,
 * so a bad microfilm frame renders in its own stock instead of in the clean
 * one with a warning bolted on.
 *
 * ══ THE STAMP IS THE SERVER'S CLASSIFICATION, NOT A FORGERY ════════════════
 *
 * `ClerkStamp` wants a caption and a detail, and says "never composed from
 * state". The reference app stamps `FILED 08/14/2026 · BK — PG —` from its own
 * fixture; `SourcePage` carries no recording date, no book and no page, and the
 * lines that DO contain them ("INSTR # 2019-0044821  BK 10944 PG 213") are
 * page text — reading a stamp back out of the body would be the UI inventing a
 * record from OCR, which is the one thing a provenance product may not do.
 *
 * So the stamp carries the two facts the server states outright: `kind`, its
 * classification of the instrument, printed verbatim (never recased — a
 * server-supplied identifier that reads differently on screen than in the
 * rulebook is unsearchable), and the page's coordinate in the package.
 *
 * CONTRACT GAP: a recording stamp proper — filed date, book/page, instrument
 * number — has no home on `SourcePage`.
 */
export function PageSheet(props: {
  readonly n: number;
  readonly total: number;
  readonly page: SourcePage | null;
  readonly line: number | null;
  readonly pinned: boolean;
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
          />
        </PaperSheet>
      </div>
    </div>
  );
}
