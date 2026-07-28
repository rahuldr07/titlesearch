import type { ReactNode } from "react";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader filled>
        <Eyebrow variant="section">{title}</Eyebrow>
        <span className="text-xs text-ink-muted">{note}</span>
      </CardHeader>
      <CardBody>{children}</CardBody>
    </Card>
  );
}

/**
 * The other four bands of the design's queue: Mine, Held, In flight, Recently
 * delivered.
 *
 * THEY ARE NOT A LIST TO SHOP THROUGH, and the design says so in its own words:
 * *"The system hands over the next order by age and priority — there's no list
 * to shop through."* Mine is work already assigned to you; Held is work that
 * stopped and needs someone; In flight is a senior/ops read; Recently delivered
 * is history. None of them offers a choice of what to take next — that decision
 * belongs to the server, and `queue.spec` #1 pins it.
 *
 * ALL FOUR RENDER THEIR EMPTY STATE, because that is the truthful render.
 * CONTRACT GAP: there is no assigned-work endpoint, no held-orders endpoint and
 * no in-flight projection. `GET /api/queue/next` returns exactly one order and
 * has no browse counterpart. Populating these bands would mean inventing four
 * server behaviours from a screen, so they show what the design draws when
 * there is nothing in them — which is also what is true.
 *
 * EVERY CLOCK HERE BELONGS TO AN ORDER, NEVER TO A PERSON. That is why no band
 * carries a rate, a rank or an estimate.
 */
export function QueueSections() {
  return (
    <>
      <Section title="Mine" note="work already assigned to you">
        <p className="text-base text-ink-secondary">
          Nothing in progress — you&rsquo;re clear.
        </p>
      </Section>

      <Section title="Held" note="stopped · needs someone">
        <p className="text-base text-ink-secondary">Nothing held.</p>
      </Section>

      <Section title="In flight" note="processing · senior and ops view">
        <p className="text-base text-ink-secondary">
          Nothing in flight. This band is a read, not a worklist — seeing an
          order here is not an invitation to take it.
        </p>
      </Section>

      <Section title="Recently delivered" note="get back to a recent one">
        <p className="text-base text-ink-secondary">
          Nothing delivered recently on your account.
        </p>
      </Section>
    </>
  );
}
