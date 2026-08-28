import { useState } from "react";
import type { SourcePage } from "@titlepipe/contract";
import { ScrollArea } from "../../components/ui";
import { PageBar, type ZoomLevel } from "./PageBar";
import { PageSheet } from "./PageSheet";
import { CoverageSpine } from "./CoverageSpine";

/**

 * The viewer's state, and the three things it refuses to compute. Which page is on

 * screen is a VIEW position — it is not order state, it is not derived from a

 * threshold, and it is not written anywhere.

 */
export function ScanViewer(props: {
  readonly total: number;
  readonly described: readonly SourcePage[];
  readonly page: number | null;
  readonly line: number | null;
  /** Magnification. Owned by `ScanPane` so the `Z` chord can reach it. */
  readonly zoom: ZoomLevel;
  readonly onZoom: (zoom: ZoomLevel) => void;
  /** The design's ◉ Following / ○ Free. When off, selection stops paging. */
  readonly following: boolean;
  readonly onFollowing: (following: boolean) => void;
}) {
  const [shown, setShown] = useState(props.page ?? props.described[0]?.n ?? 1);
  const [citedAt, setCitedAt] = useState(props.page);

  if (citedAt !== props.page) {
    setCitedAt(props.page);
    if (props.page !== null && props.following) setShown(props.page);
  }

  /*
   * CONTRACT GAP, and it is the mocks' own note (`workspace.ts:668`):
   * `total_pages` is a plain int, so a package that could not be read at all
   * arrives as 0. Zero is not "a package of no pages" and it is not a failed
   * request — `QueryState` already answered that one — so it is stated rather
   * than drawn as an empty spine of zero cells.
   */
  if (props.total < 1) {
    return (
      <p className="p-12 text-meta leading-body text-ink-secondary">
        The server reported no page count for this package. That is not a package of
        zero pages — it is the absence of a count, and no source page can be shown until
        one arrives.
      </p>
    );
  }

  const here = props.described.find((page) => page.n === shown) ?? null;
  /* The pin belongs to the CITED page. Paging away from it takes it with you. */
  const pinned = props.page !== null && props.page === shown;

  return (
    <>
      <PageBar
        shown={shown}
        total={props.total}
        zoom={props.zoom}
        onGo={setShown}
        onZoom={props.onZoom}
        following={props.following}
        onFollowing={props.onFollowing}
      />
      <ScrollArea label="Source page sheet" axis="both">
        <PageSheet
          n={shown}
          total={props.total}
          page={here}
          zoom={props.zoom}
          line={pinned ? props.line : null}
          pinned={pinned}
        />
      </ScrollArea>
      <CoverageSpine
        total={props.total}
        described={props.described}
        shown={shown}
        onGo={setShown}
      />
    </>
  );
}
