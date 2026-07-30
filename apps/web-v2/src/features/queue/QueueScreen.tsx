import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { nextOrderQuery } from "./queries";
import { Card, CardBody } from "../../shared/ui/Card";
import { Screen } from "../../shared/ui/Screen";
import { ScreenFailure } from "../../shared/ui/ScreenFailure";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";
import { ToggleGroup, Toggle } from "../../shared/ui/ToggleGroup";
import { ScreenTitle } from "../../app/ScreenTitle";
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
        <header className="flex flex-wrap items-end justify-between gap-8">
          <div className="min-w-0 flex-1">
            <ScreenTitle>Your queue</ScreenTitle>
            <h1 className="mt-3 text-3xl font-semibold text-ink-primary">Work comes to you</h1>
            <p className="mt-3 max-w-235 text-base leading-body text-ink-secondary">
              The system hands over the next order by age and priority —
              there&rsquo;s no list to shop through. Every clock here belongs to an
              order, never to you.
            </p>
          </div>
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
        </header>

        <MineBand />

        <QueueBand title="Next up" note="the system decides — no picking">
          {order === null ? (
            <Card>
              <CardBody>
                <p className="font-semibold">Nothing is waiting.</p>
                <p className="mt-2 text-sm text-ink-secondary">
                  Work comes to you — the system decides which order is next.
                </p>
              </CardBody>
            </Card>
          ) : (
            <NextOrderCard order={order} />
          )}
        </QueueBand>

        <TailBands senior={view === "senior"} />
      </div>
    </Screen>
  );
}
