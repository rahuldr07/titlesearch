import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { leaderboardQuery, routingQuery } from "./queries";
import { LeaderboardMatrix } from "./LeaderboardMatrix";
import { SeatFlip } from "./SeatFlip";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * Engine performance, per jurisdiction and section. Never one number.
 *
 * THERE IS NO BEST ENGINE, and the screen says so in words. An engine that
 * wins Clayton mortgages loses Hartford judgments; a single ranking would be
 * an average over things that are not comparable, and someone would act on it.
 *
 * NO AUTO-PROMOTION AFFORDANCE EXISTS. Not disabled — absent. Moving an engine
 * into a production seat is a person's decision, recorded with the evidence
 * they decided on.
 */
export function LeaderboardScreen() {
  const cells = useQuery(leaderboardQuery);
  const routing = useQuery(routingQuery);
  const [selected, setSelected] = useState<
    { jurisdiction: string; section: string; engineId: string } | null
  >(null);

  if (cells.isError) return <p className="text-base text-state-halt-ink">Leaderboard unavailable.</p>;
  if (cells.isPending) return <p className="text-base text-ink-secondary">Loading…</p>;

  const seats = (routing.data?.cells ?? []).filter(
    (seat) =>
      selected !== null &&
      seat.jurisdiction === selected.jurisdiction &&
      seat.section === selected.section,
  );

  return (
    <div className="flex flex-col gap-8">
      <Eyebrow variant="screen">Engine leaderboard</Eyebrow>
      <p className="text-base leading-body text-ink-secondary">
        THERE IS NO BEST ENGINE — a cell that wins one jurisdiction and section
        loses another, and there is no auto-promotion anywhere in this screen.
        NO TRUTH YET is not a zero; it means the golden set is too thin here to
        say anything. A dash means the engine never declared the capability.
      </p>

      <LeaderboardMatrix
        cells={cells.data.cells}
        onSelect={(jurisdiction, section, engineId) =>
          setSelected({ jurisdiction, section, engineId })
        }
      />

      {selected ? (
        <>
          <SeatFlip {...selected} />

          {/*
            Seats are scoped to the SELECTED cell. Listing every jurisdiction's
            at once made `seat-A` mean six different things — and read that way
            too: "which engine is in seat A" is only a question about one
            jurisdiction and section at a time.
          */}
          <Card>
            <CardHeader filled>
              <Eyebrow variant="section">
                Production seats — {selected.jurisdiction} · {selected.section}
              </Eyebrow>
            </CardHeader>
            <CardBody className="flex flex-col gap-4">
              {seats.map((seat) => (
                <p
                  key={seat.id}
                  data-testid={`seat-${seat.seat}`}
                  className="font-mono text-base text-ink-primary"
                >
                  {seat.seat}: {seat.engine_id} · approved by {seat.approved_by} ·
                  evidence {seat.evidence_url}
                </p>
              ))}
            </CardBody>
          </Card>
        </>
      ) : null}
    </div>
  );
}
