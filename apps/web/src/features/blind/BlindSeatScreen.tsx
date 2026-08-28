import { useState } from "react";
import type { BlindEntryInput } from "@titlepipe/contract";
import { CAPTURE_ORDER } from "../../shared/blindQueries";
import { blankEntry, toWire, type DraftEntry } from "./draftEntry";
import { CaptureForm } from "./CaptureForm";
import { CaptureReceipt } from "./CaptureReceipt";
import { SeatGaps } from "./SeatGaps";
import { useCapture } from "./useCapture";

/**
 * SCREEN — THE CAPTURE SEAT, at `/blind` (`authz.ts:76`,
 * `screen.blind.enter`, typist + admin).
 *
 * "Blind fifty" is a MEASUREMENT PROGRAMME, not a stage of the pipeline. Temp
 * typists hand-key fields off a county package while structurally blind to the
 * machine's output and to each other's; the entries are reconciled afterwards
 * to measure what the ensemble's accuracy actually is. Everything unusual about
 * this screen follows from that one sentence.
 *
 * ══ THE RAIL IS ALREADY HANDLED, AND THIS FILE DOES NOT REPEAT IT ══════════
 *
 * INVARIANT 46 — "the capture seat has no rail; structural blindness stays
 * whole." `app/rootRoute.tsx` implements it: the shell tests
 * `pathname.startsWith("/blind")` and does not mount `SideRail` at all, reading
 * off the URL rather than the role so that an admin demonstrating the protocol
 * is still blind at the seat. NOTHING IS DUPLICATED HERE. A second copy of that
 * test in the screen would be a second place for it to be wrong, and the shell
 * is the layer that owns chrome.
 *
 * The order strip is likewise absent without a rule of its own: `OrderStrip`
 * returns `null` off `/orders/{id}` (`chrome/OrderStrip.tsx`), and this route
 * is not order-scoped. So the seat renders on bare ground.
 *
 * ══ WHAT THIS SCREEN MAY NOT SHOW, WHICH IS ALMOST EVERYTHING ══════════════
 *
 * No machine-extracted value, no confidence figure, no engine name, no other
 * seat's entry, no order state, no stage, and no link to any of them. That is
 * not a UI convention: `endpoints.ts:290-294` records that blindness is
 * enforced SERVER-SIDE and verified by a security test rather than a UI test,
 * which means this screen has nothing to leak because it is never handed
 * anything to leak. The one read it could technically perform —
 * `GET /api/orders/{id}/fields` — is the answer sheet, and is not imported.
 *
 * ══ THE ORDER IS STATED, BECAUSE THERE IS NO WAY TO CHOOSE ONE ═════════════
 *
 * `/blind` takes no path param (authz.ts:76) and no endpoint lists orders to
 * pick from — the browse endpoint was removed by construction
 * (endpoints.ts:69, :77-82) and INVARIANT 22 forbids one. So the package under
 * the seat is named once in `shared/blindQueries.ts` and printed here as the
 * demo order, rather than chosen from a picker that would have to be invented.
 */
export function BlindSeatScreen() {
  const [drafts, setDrafts] = useState<readonly DraftEntry[]>(() => [blankEntry()]);

  const capture = useCapture(CAPTURE_ORDER, () => {
    // The server accepted them; the boxes are cleared for the next field. The
    // filed entries are NOT redrawn from local state — the seat has no read
    // (endpoints.ts:290-294), and a client-side list of "what I typed" would be
    // a read-back this protocol deliberately does not have.
    setDrafts([blankEntry()]);
  });

  function file() {
    const entries: BlindEntryInput[] = [];
    for (const draft of drafts) {
      // Narrowed rather than defaulted. A `?? "certain"` here would invent the
      // one value enums.ts:66-70 calls the poison; the hold already makes this
      // unreachable, and an early return is the honest way to say so.
      if (draft.confidence === null) return;
      entries.push(toWire(draft, draft.confidence));
    }
    if (entries.length === 0) return;
    capture.mutate({ entries });
  }

  return (
    <div
      data-testid="blind-seat"
      tabIndex={0}
      role="region"
      aria-label="Capture seat"
      className="tp-state tp-screen-enter flex h-full min-h-0 flex-col gap-12 overflow-y-auto p-14"
    >
      <div className="flex max-w-500 flex-col gap-4">
        <h1 className="text-title font-bold leading-tight text-ink-primary">
          Capture seat
        </h1>
        <p className="text-meta leading-body text-ink-secondary">
          Key what the package says, field by field, with the page it came off
          and how sure you are. You are not shown the machine&rsquo;s reading or
          the other seat&rsquo;s — that is what makes the measurement worth
          taking, and the server enforces it rather than this screen.
        </p>
        <p className="text-meta leading-close text-ink-muted">
          Package{" "}
          <span data-testid="capture-order" className="font-mono text-ink-primary">
            {CAPTURE_ORDER}
          </span>
        </p>
      </div>

      <div className="flex max-w-500 flex-col gap-10">
        <CaptureForm
          drafts={drafts}
          onDrafts={setDrafts}
          pending={capture.isPending}
          onFile={file}
        />
        <CaptureReceipt error={capture.error} accepted={capture.data} />
        <SeatGaps />
      </div>
    </div>
  );
}
