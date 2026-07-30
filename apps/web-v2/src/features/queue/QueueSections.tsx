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
 * ALL OF THEM RENDER THEIR EMPTY STATE, because that is the truthful render.
 * CONTRACT GAP: there is no assigned-work endpoint, no held-orders endpoint and
 * no in-flight projection. `GET /api/queue/next` returns exactly one order and
 * has no browse counterpart. Populating these bands would mean inventing four
 * server behaviours from a screen, so they show what the design draws when
 * there is nothing in them — which is also what is true.
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
