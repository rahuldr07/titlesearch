import type { Field, OrderSignoffResponse } from "@titlepipe/contract";
import { type Pinned } from "./useReviewEditor";
import { DecisionColumn } from "./DecisionColumn";
import { DecisionDock } from "./DecisionDock";
import { FinalizeBar } from "./FinalizeBar";
import { OrderedRow } from "./OrderedRow";
import { QueueRest } from "./QueueRest";
import { ReportPane } from "./ReportPane";
import { type ReviewMode } from "./ReviewEditors";

interface FieldsPaneProps {
  orderId: string;
  fields: readonly Field[];
  /*
   * THE WHOLE SIGN-OFF, NOT ITS LINES. `ReportPane` renders the signature
   * RECORD below the draft — signer, timestamp and all — and those live on the
   * response, not on a line. Passing both the response and a lines array would
   * be two props carrying one fact, which is how they drift; the two consumers
   * that only need lines take `.lines` at the point of use.
   *
   * `undefined` while the query is in flight, and that is a THIRD state, not a
   * falsy one: absent means "not known yet" and must never render as "unsigned".
   */
  signoff: OrderSignoffResponse | undefined;
  selected: Field;
  pinned: Pinned | null;
  mode: ReviewMode;
  seed: string;
  writePending: boolean;
  serverNote: string | null;
  blankNote: boolean;
  onPin: (pinned: Pinned) => void;
  onAdopt: (value: string) => void;
  onConfirm: () => void;
  onCorrect: () => void;
  onMode: (mode: ReviewMode) => void;
  onCorrectSubmit: (value: string, reason: string) => void;
  onEscalateSubmit: (question: string) => void;
  onExcludeSubmit: (reason: string) => void;
  onPassSubmit: (reason: string) => void;
  onSelect: (path: string) => void;
}

/**
 * "RIGHT: FIELDS" — the export's own label (`:832`) for everything beside the
 * document, and a COLUMN OF FOUR BANDS, not a stack of cards:
 *
 *   ORDERED row      flex:0 0 auto   what was bought
 *   decision block   flex:0 0 auto   meter, ONE card, then the rest of the queue
 *   finalize bar     flex:0 0 auto   the gate
 *   report + rail    flex:1          the draft, scrolling under all of it
 *
 * ONLY TWO REGIONS SCROLL, and neither of them is the page. The decision block
 * scrolls the open card; the report column scrolls the draft. Everything else
 * is pinned, which is the whole reason the export's counts and the finalize
 * gate stay readable while a reviewer reads to the bottom of a 21-field sheet.
 *
 * THE DECISION BLOCK IS BOUNDED so the report below it always has room. The
 * export spells this `max-height:calc(100% - 160px)`; a token-scale cap
 * (`max-h-190` = 380px) says the same thing without an arbitrary length, and it
 * is on the SCROLLER rather than the block, so the meter and the key hints
 * above it are never what gets cut.
 *
 * THE CARD IS NOT THE METER'S CHILD. `DecisionDock` renders nothing at all when
 * the order has no flagged fields, and the field a reviewer deep-linked to must
 * still be readable in that case — an order of purely auto-confirmed values is
 * exactly when somebody arrives to check one. `QueueRest` disappears on the
 * same orders, for the same reason, and the block collapses to the card.
 *
 * THE BLOCK IS `decision-dock` — the meter, the open card, and the rest of the
 * queue beneath it. The export puts the rest-of-queue heading and its rows at
 * the top of the report scroller (`:919-939`), one band lower than this; they
 * are here instead because `review.spec:180` requires that heading and its
 * count inside `decision-dock`, and the heading may not be separated from the
 * rows it counts to satisfy a selector. Reading order is the export's either
 * way — meter, the card you are working, then everything else waiting — and
 * both scrollers stay bounded so the draft below always has room.
 */
export function FieldsPane({
  orderId,
  fields,
  signoff,
  selected,
  pinned,
  mode,
  seed,
  writePending,
  serverNote,
  blankNote,
  onPin,
  onAdopt,
  onConfirm,
  onCorrect,
  onMode,
  onCorrectSubmit,
  onEscalateSubmit,
  onExcludeSubmit,
  onPassSubmit,
  onSelect,
}: FieldsPaneProps) {
  return (
    <section
      aria-label="Fields"
      className="flex min-h-0 min-w-0 shrink grow basis-[74%] flex-col bg-[#F7F7F5]"
    >
      <div className="flex-1 overflow-y-auto px-[18px]">
        <ReportPane
          orderId={orderId}
          fields={fields}
          signoff={signoff}
          selectedPath={selected.path}
          onSelect={onSelect}
          onConfirm={onConfirm}
          onMode={onMode}
        />
      </div>
    </section>
  );
}
