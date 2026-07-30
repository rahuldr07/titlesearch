import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { nextOrderQuery } from "./queries";
import { EmptyPanel } from "../../shared/ui/EmptyPanel";
import { Screen } from "../../shared/ui/Screen";
import { ScreenFailure } from "../../shared/ui/ScreenFailure";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";
import { ToggleGroup, Toggle } from "../../shared/ui/ToggleGroup";
import { QueueBand } from "./QueueBand";
import { MineBand, TailBands } from "./QueueSections";
import { NextOrderCard } from "./NextOrderCard";

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
 */
export function QueueScreen() {
  const { data, isPending, isError, error } = useQuery(nextOrderQuery);
  const [view, setView] = useState<"reviewer" | "senior">("reviewer");

  if (isError)
    return (
      <Screen measure="860">
        <ScreenFailure reference={error instanceof Error ? error.message : undefined} />
      </Screen>
    );
  if (isPending) return <ScreenMessage measure="860">Loading the next order…</ScreenMessage>;

  const order = data.order;

  return (
    <Screen measure="860">
      <div className="flex flex-col gap-9">
        <ScreenHeading
          eyebrow="Your queue"
          title="Work comes to you"
          lede={
            <p>
              The system hands over the next order by age and priority —
              there&rsquo;s no list to shop through. Every clock here belongs to an
              order, never to you.
            </p>
          }
          actions={
            <ToggleGroup
              aria-label="Queue view"
              value={[view]}
              onValueChange={(next) => {
                const picked = next.at(0);
                if (picked === "reviewer" || picked === "senior") setView(picked);
              }}
            >
              <Toggle value="reviewer" className="rounded-6 px-7 py-4 text-sm">Reviewer</Toggle>
              <Toggle value="senior" className="rounded-6 px-7 py-4 text-sm">Senior · Ops</Toggle>
            </ToggleGroup>
          }
        />

        <MineBand />

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

        <TailBands senior={view === "senior"} />
      </div>
    </Screen>
  );
}
