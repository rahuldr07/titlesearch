import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { QueueBandId } from "@titlepipe/contract";
import { nextOrderQuery, queueBandsQuery } from "./queries";
import { useSession } from "../../shared/session";
import { EmptyPanel } from "../../shared/ui/EmptyPanel";
import { Screen } from "../../shared/ui/Screen";
import { ScreenFailure } from "../../shared/ui/ScreenFailure";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";
import { QueueBand } from "./QueueBand";
import { MineBand, TailBands } from "./QueueSections";
import { NextOrderCard } from "./NextOrderCard";
import { QueueViewToggle, type QueueView } from "./QueueViewToggle";
import { QuietState } from "./QuietState";

/**
 * ONE order, chosen by the server. There is no list, no filter and no sort —
 * `GET /api/queue/next` has no browse counterpart by design, and `queue.spec`
 * #1 asserts the next queued order appears nowhere on this page. Work comes to
 * you; the system decides.
 *
 * Nothing here counts, times or paces anything (`queue.spec` #2, constraint 7).
 * No "3 orders waiting", no elapsed timer, and no ESTIMATE — an estimate is a
 * pace indicator wearing a helpful hat.
 *
 * BAND ORDER IS THE DESIGN'S ARGUMENT, not a layout preference. Mine comes
 * first because finishing what you already hold beats being handed something
 * new, and Next up sits second so that taking more work reads as a decision
 * made after seeing what is already open — not as the top of the page.
 *
 * The Reviewer / Senior · Ops switch is a VIEW over bands, never an identity.
 * It shows and hides In flight exactly as the export does; who you are still
 * comes from the session, and the server still gates every byte behind it.
 *
 * "Nothing is waiting" is an `EmptyPanel`, not a `ScreenMessage`, and the two
 * are not interchangeable here: this branch is reached only once the query has
 * RESOLVED and the server has answered `order: null`. The in-flight and failed
 * cases are returned above it. Drawing the resolved-empty panel while the
 * request was still open would have the screen assert that no work exists on the
 * strength of a fetch that had not come back — a loading bug shipped as a design.
 *
 * BOTH READS GATE THE WHOLE SCREEN, for that same reason. The bands draw a
 * resolved-and-empty panel when their count is zero, so letting them mount
 * while `/api/queue/bands` is still open — or has failed — would print "Nothing
 * held" on the strength of a fetch that never came back. Which bands exist is
 * the server's answer too, so there is nothing to render optimistically.
 */
export function QueueScreen() {
  // The acting role, DEV-ONLY (conflict C12). It keys the bands cache so the
  // preview control actually previews; the server still decides what it answers.
  const role = useSession((session) => session.role);
  const next = useQuery(nextOrderQuery);
  const bands = useQuery(queueBandsQuery(role));
  const [view, setView] = useState<QueueView>("reviewer");

  if (next.isError || bands.isError) {
    const failure = next.error ?? bands.error;
    return (
      <Screen measure="1340">
        <ScreenFailure reference={failure instanceof Error ? failure.message : undefined} />
      </Screen>
    );
  }
  if (next.isPending || bands.isPending)
    return <ScreenMessage measure="1340">Loading the next order…</ScreenMessage>;

  const order = next.data.order;
  // The server decides which bands this caller gets and in what order; the
  // screen only knows where "Next up" is spliced in. A band it did not send is
  // absent here, never an empty one — `Band` renders nothing for `undefined`.
  const bandOf = (id: QueueBandId) => bands.data.bands.find((band) => band.id === id);
  /*
   * THE SERVER'S TWO CENSUSES, read — not `orders.length` on either. A reviewer
   * who cannot see the held work would otherwise be told nothing is waiting on
   * anyone, which is the one sentence on this screen that must never be wrong.
   * A band the server did not send is not a zero, so `?? 0` is deliberately
   * absent: both counts have to be present AND zero for the card to appear.
   */
  const quiet = bandOf("mine")?.count === 0 && bandOf("held")?.count === 0;

  return (
    /*
     * `1340`, not `860`. The mockup draws screen 1 across the full sheet — its
     * queue column is ~1290px — and the row it draws is a seven-cell one-liner
     * that does not fit in 860. Held at 860 the band either wraps every row back
     * to two lines (undoing the density this reskin is for) or ellipsises the
     * address, which is the one cell a reader scans a band by. This is the
     * export's per-screen measure being overruled by the approved picture on the
     * one screen the picture is unambiguous about; every other screen keeps its
     * export width.
     */
    <Screen measure="1340">
      {/* 24px band to band — the mockup's `.band{margin-top:24px}`. At 20px the
          bands read as one stack rather than four piles. */}
      <div className="flex flex-col gap-12">
        <ScreenHeading
          size="26"
          eyebrow="Your queue"
          /* THE SIGNATURE MOMENT, and it is the mockup's own line: `Work comes
             <em>to you.</em>`. The closing phrase carries the whole argument of
             the screen — you do not go and get work — so it is the phrase the
             display italic is for. `ScreenHeading` paints the `<em>`; the call
             site only has to mean it. */
          title={
            <>
              Work comes <em>to you.</em>
            </>
          }
          lede={
            <p>
              The system hands over the next order by age and priority —
              there&rsquo;s no list to shop through. Every clock here belongs to an
              order, never to you.
            </p>
          }
          actions={<QueueViewToggle view={view} onView={setView} />}
        />

        {quiet ? <QuietState /> : null}

        <MineBand band={bandOf("mine")} />

        <QueueBand title="Next up" note="the system decides — no picking">
          {order === null ? (
            <EmptyPanel
              title="Nothing is waiting."
              body="Work comes to you — the system decides which order is next."
            />
          ) : (
            <NextOrderCard order={order} />
          )}
        </QueueBand>

        <TailBands
          senior={view === "senior"}
          held={bandOf("held")}
          inFlight={bandOf("in_flight")}
          delivered={bandOf("delivered")}
        />
      </div>
    </Screen>
  );
}
