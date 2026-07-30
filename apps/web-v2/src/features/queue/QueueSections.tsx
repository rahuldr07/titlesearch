import { EmptyPanel } from "../../shared/ui/EmptyPanel";
import { QueueBand } from "./QueueBand";

/**
 * The bands either side of "Next up": Mine, Held, In flight, Recently
 * delivered.
 *
 * THEY ARE NOT A LIST TO SHOP THROUGH, and the design says so in its own words:
 * *"The system hands over the next order by age and priority — there's no list
 * to shop through."* Mine is work already assigned to you; Held is work that
 * stopped and needs someone; In flight is a senior/ops read; Recently delivered
 * is history. None of them offers a choice of what to take next — that decision
 * belongs to the server, and `queue.spec` #1 pins it.
 *
 * ALL OF THEM RENDER THEIR EMPTY STATE, AND THE REASON HAS CHANGED. Until
 * 2026-07-30 there was no assigned-work endpoint, no held-orders endpoint and
 * no in-flight projection, so populating a band meant inventing four server
 * behaviours from a screen. `GET /api/queue/bands` now serves all four —
 * titles, notes, a server-owned per-band `count` that is deliberately NOT
 * `orders.length`, and rows that carry no way to take the work. The bands are
 * still drawn empty here because reading that endpoint is the queue's Wave 4
 * rebuild; what is no longer true is that the data does not exist.
 *
 * `GET /api/queue/next` remains the ONLY hand-over. No band row offers a claim,
 * an assign or a priority, which is what keeps a census from becoming a list to
 * shop through.
 *
 * IN FLIGHT IS THE SENIOR/OPS BAND ONLY. That is the design's own split, not a
 * guess: the export's Reviewer view draws four bands and its Senior · Ops view
 * draws the same four plus In flight. It is a view filter and nothing more — no
 * band here is gated on identity and none of them carries data, so the toggle
 * cannot reveal anything a reviewer was not already entitled to see.
 *
 * EVERY CLOCK HERE BELONGS TO AN ORDER, NEVER TO A PERSON. That is why no band
 * carries a rate, a rank or an estimate.
 *
 * `EmptyPanel` — RESOLVED AND EMPTY — is the honest primitive for all four, and
 * `ScreenMessage` would be the dishonest one. Nothing is in flight here: no band
 * issues a request that could still be open or could fail, so "not loaded" is
 * not a state any of them can be in. The dashed outline states the same thing
 * the copy does, which is what stops a reader taking a blank band for a fetch
 * that never came back. These four previously shared a private `Empty` that was
 * a solid Card — the mark the design reserves for "here is a thing" — so an
 * absence was drawn with the one border style that asserts presence.
 */
export function MineBand() {
  return (
    <QueueBand title="Mine" note="in progress">
      {/* A fragment, not an attribute string: `&rsquo;` decodes reliably in JSX
          TEXT, and this file's copy is written with entities throughout. */}
      <EmptyPanel title={<>Nothing in progress — you&rsquo;re clear.</>} />
    </QueueBand>
  );
}

export function TailBands({ senior }: { senior: boolean }) {
  return (
    <>
      <QueueBand title="Held" note="stopped · needs someone">
        <EmptyPanel title="Nothing held." />
      </QueueBand>

      {senior ? (
        <QueueBand title="In flight" note="processing · senior · ops view">
          <EmptyPanel
            title="Nothing in flight."
            body="This band is a read, not a worklist — seeing an order here is not an invitation to take it."
          />
        </QueueBand>
      ) : null}

      <QueueBand title="Recently delivered" note="get back to a recent one">
        <EmptyPanel title="Nothing delivered recently on your account." />
      </QueueBand>
    </>
  );
}
