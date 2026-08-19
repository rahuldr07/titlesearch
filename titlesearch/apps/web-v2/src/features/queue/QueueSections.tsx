import type { ReactNode } from "react";
import type { QueueBand as QueueBandData } from "@titlepipe/contract";
import { EmptyPanel } from "../../shared/ui/EmptyPanel";
import { BandOrders, type BandPress } from "./BandOrders";
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
 * THEY NOW READ `GET /api/queue/bands`. Until 2026-07-30 there was no
 * assigned-work endpoint, no held-orders endpoint and no in-flight projection,
 * so populating a band meant inventing four server behaviours from a screen.
 * That endpoint serves all four: the server's own title and note, its own
 * per-band `count`, and rows that carry no way to take the work.
 *
 * `GET /api/queue/next` remains the ONLY hand-over. No band row offers a claim,
 * an assign or a priority, which is what keeps a census from becoming a list to
 * shop through.
 *
 * A BAND THE SERVER DID NOT SEND IS NOT DRAWN. An absent band and an empty band
 * are different statements and only the server can tell them apart — a reviewer
 * is served no In flight band at all, rather than an empty or a dimmed one. The
 * Reviewer / Senior · Ops switch is a second, narrower thing: a VIEW over bands
 * the server already agreed to send, which is why it can only ever hide.
 *
 * IN FLIGHT IS THE SENIOR/OPS BAND ONLY. That is the design's own split, not a
 * guess: the export's Reviewer view draws four bands and its Senior · Ops view
 * draws the same four plus In flight.
 *
 * EVERY CLOCK HERE BELONGS TO AN ORDER, NEVER TO A PERSON. That is why no band
 * carries a rate, a rank or an estimate.
 *
 * `EmptyPanel` — RESOLVED AND EMPTY — is the honest primitive for a band whose
 * server-supplied count is zero, and `ScreenMessage` would be the dishonest one:
 * the screen returns above before rendering any band while the request is still
 * open or has failed, so "not loaded" is not a state a band can be in. The
 * dashed outline states the same thing the copy does, which is what stops a
 * reader taking a blank band for a fetch that never came back. These four
 * previously shared a private `Empty` that was a solid Card — the mark the
 * design reserves for "here is a thing" — so an absence was drawn with the one
 * border style that asserts presence.
 */
export function MineBand({ band }: { band: QueueBandData | undefined }) {
  return (
    /* `solid` on the one band that is YOUR open work — the mockup's `.btn.solid`,
       an INK press, not the wax. Held and delivered take the hairline `.btn.line`
       so the only full-strength accent on the screen stays "Take next order". */
    <Band band={band} verb="Resume →" press="solid">
      {/* A fragment, not an attribute string: `&rsquo;` decodes reliably in JSX
          TEXT, and this file's copy is written with entities throughout. */}
      <EmptyPanel title={<>Nothing in progress — you&rsquo;re clear.</>} />
    </Band>
  );
}

export function TailBands({
  senior,
  held,
  inFlight,
  delivered,
}: {
  senior: boolean;
  held: QueueBandData | undefined;
  inFlight: QueueBandData | undefined;
  delivered: QueueBandData | undefined;
}) {
  return (
    <>
      <Band band={held} verb="Open →" press="outlined">
        <EmptyPanel title="Nothing held." />
      </Band>

      {senior ? (
        <Band band={inFlight} verb={null} press="outlined">
          <EmptyPanel
            title="Nothing in flight."
            body="This band is a read, not a worklist — seeing an order here is not an invitation to take it."
          />
        </Band>
      ) : null}

      {/* CONTRACT GAP: the export's control reads `Reopen · v2`. Nothing on the
          band row says which version was delivered, and a version number is a
          value like any other — printing `v2` here would be the screen asserting
          a revision count the server never sent. */}
      <Band band={delivered} verb="Reopen →" press="outlined">
        <EmptyPanel title="Nothing delivered recently on your account." />
      </Band>
    </>
  );
}

/**
 * The band's frame. Title, note and count are the SERVER'S — a client-side
 * `Record<QueueBandId, string>` is a second copy of product copy that drifts
 * silently from the first, and the count is the server's census rather than a
 * number this screen could reach.
 */
function Band({
  band,
  verb,
  press,
  children,
}: {
  band: QueueBandData | undefined;
  verb: string | null;
  press: BandPress;
  children: ReactNode;
}) {
  if (band === undefined) return null;
  return (
    <QueueBand title={band.title} note={band.note} count={band.count}>
      <BandOrders band={band} verb={verb} press={press} empty={children} />
    </QueueBand>
  );
}
