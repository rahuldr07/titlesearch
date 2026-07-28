import { Card, CardBody } from "../../shared/ui/Card";
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
 */
export function MineBand() {
  return (
    <QueueBand title="Mine" note="in progress">
      <Empty>Nothing in progress — you&rsquo;re clear.</Empty>
    </QueueBand>
  );
}

export function TailBands({ senior }: { senior: boolean }) {
  return (
    <>
      <QueueBand title="Held" note="stopped · needs someone">
        <Empty>Nothing held.</Empty>
      </QueueBand>

      {senior ? (
        <QueueBand title="In flight" note="processing · senior · ops view">
          <Empty>
            Nothing in flight. This band is a read, not a worklist — seeing an
            order here is not an invitation to take it.
          </Empty>
        </QueueBand>
      ) : null}

      <QueueBand title="Recently delivered" note="get back to a recent one">
        <Empty>Nothing delivered recently on your account.</Empty>
      </QueueBand>
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <Card>
      <CardBody className="text-base text-ink-secondary">{children}</CardBody>
    </Card>
  );
}
