import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { OrderPipelineResponse } from "@titlepipe/contract";
import { buttonClasses } from "../../shared/ui/Button";
import { Card } from "../../shared/ui/Card";
import { DividedSection } from "../../shared/ui/ListRow";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Toggle, ToggleGroup } from "../../shared/ui/ToggleGroup";
import { Screen } from "../../shared/ui/Screen";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";
import { cn } from "../../shared/ui/classNames";
import { PackageStats } from "./PackageStats";
import { StageRow } from "./StageRow";
import { orderPipelineQuery, PIPELINE_ORDER_ID } from "./queries";

/**
 * STEP 3 — the run, with its two stops named up front.
 *
 * THE HALTS ARE THE PRODUCT, NOT AN INCIDENT. The completeness gate stops the
 * run before extraction spends money on a package that cannot answer the
 * questions; the QC gate stops it before a client sees anything a person has
 * not approved. A progress screen that hid them would be describing a pipeline
 * that does not exist, and would make each stop look like a fault when it
 * arrived.
 *
 * NO THROUGHPUT, NO ELAPSED TIME, NO PERCENTAGE. The screen shows what has
 * happened and what is waiting on whom; it never shows how fast. Speed numbers
 * here would make the two deliberate stops read as delays.
 */
export function ProcessingScreen() {
  const { data, isPending, isError } = useQuery(orderPipelineQuery(PIPELINE_ORDER_ID));

  if (isError) return <ScreenMessage tone="halt" measure="700">Pipeline unavailable.</ScreenMessage>;
  if (isPending) return <ScreenMessage measure="700">Loading the run…</ScreenMessage>;

  return <PipelineBody pipeline={data} />;
}

/**
 * Mounted only once the run has arrived, so the gate preview can be SEEDED FROM
 * THE SERVER'S `gate_halted` rather than guessing an initial value and
 * correcting itself a frame later.
 *
 * The toggle previews the other rendering of the closing call-to-action and
 * writes nothing — the stage rows keep printing the server's phases either way,
 * because the gate's outcome is the server's to state and this control is a
 * local view of it, not an override of it. It sits with the button it changes,
 * below the run, so the design's reading order — stats, then the run, then the
 * one thing to do about it — survives the extra control.
 *
 * THE CALL TO ACTION IS A LINK, NOT A SUBMIT. It never starts, resumes or
 * retries anything; it carries you to whichever screen is holding the run —
 * the completeness gate while the gate is halted, the order under review once
 * it is not. Both are registered routes, so drawing it disabled would have been
 * a lie about a journey the app can actually make.
 */
function PipelineBody({ pipeline }: { pipeline: OrderPipelineResponse }) {
  const [gateHalted, setGateHalted] = useState(pipeline.gate_halted);

  return (
    <Screen measure="700" pad="40" placement="centre">
      <div className="flex flex-col gap-7">
        <ScreenHeading
          eyebrow="Step 3 — Pipeline"
          title="Building the draft report"
          lede="Two halts by design: the completeness gate protects the spend, the human QC gate protects the client."
        />

        <PackageStats
          totalPages={pipeline.total_pages}
          pagesRelevant={pipeline.pages_relevant}
          classifierNote={pipeline.classifier_note}
        />

        {/*
          The card is the OUTER edge (`line-strong`), the rows are the INNER
          separators (`line-subtle`) — two greys that are not interchangeable.
          The list is its own `DividedSection` so the first row's dropped
          hairline is measured against the rows and nothing else; hung on the
          card, a banner rendered above the stages would silently take the
          exemption and the run would open with a rule attached to nothing.
        */}
        <Card>
          <DividedSection>
            {pipeline.stages.map((stage) => (
              <StageRow key={stage.id} stage={stage} />
            ))}
          </DividedSection>
        </Card>

        <div className="flex items-center gap-4">
          <Eyebrow variant="caption">Gate outcome · local preview</Eyebrow>
          <ToggleGroup
            aria-label="Gate outcome (local preview)"
            value={[gateHalted ? "halted" : "passed"]}
            onValueChange={(value) => setGateHalted(value[0] !== "passed")}
          >
            <Toggle value="halted">Halted</Toggle>
            <Toggle value="passed">Passed</Toggle>
          </ToggleGroup>
        </div>

        {gateHalted ? (
          <Link to="/completeness" className={cn(buttonClasses({ size: "xl", tone: "halt" }))}>
            Resolve completeness gate →
          </Link>
        ) : (
          <Link
            to="/orders/$orderId/review"
            params={{ orderId: pipeline.order_id }}
            className={cn(buttonClasses({ size: "xl" }))}
          >
            Open review — the run is waiting on you →
          </Link>
        )}
      </div>
    </Screen>
  );
}
