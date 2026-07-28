import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { OrderPipelineResponse } from "@titlepipe/contract";
import { ScreenTitle } from "../../app/ScreenTitle";
import { buttonClasses } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Toggle, ToggleGroup } from "../../shared/ui/ToggleGroup";
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

  if (isError) return <p className="text-base text-state-halt-ink">Pipeline unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading the run…</p>;

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
    /*
     * THIS SCREEN SETS ITS OWN MEASURE — 700px, centred, as the design draws it.
     * The shell's cap belongs to the widest board in the app, not to a single
     * column of stage rows; left uncapped, one row would run the full window and
     * put the owner caption a screen's width away from the stage it names.
     */
    <div className="mx-auto flex max-w-350 flex-col gap-7">
      <header className="flex flex-col gap-2">
        <ScreenTitle>Step 3 — Pipeline</ScreenTitle>
        <h1 className="text-4xl font-semibold">Building the draft report</h1>
        <p className="text-md leading-body text-ink-secondary">
          Two halts by design: the completeness gate protects the spend, the
          human QC gate protects the client.
        </p>
      </header>

      <PackageStats
        totalPages={pipeline.total_pages}
        pagesRelevant={pipeline.pages_relevant}
        classifierNote={pipeline.classifier_note}
      />

      <ul className="overflow-hidden rounded-9 border border-line-strong bg-surface-panel">
        {pipeline.stages.map((stage) => (
          <StageRow key={stage.id} stage={stage} />
        ))}
      </ul>

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
  );
}
