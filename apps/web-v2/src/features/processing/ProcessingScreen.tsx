import { useState } from "react";
import { ScreenTitle } from "../../app/ScreenTitle";
import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Toggle, ToggleGroup } from "../../shared/ui/ToggleGroup";
import { PackageStats } from "./PackageStats";
import { StageRow } from "./StageRow";
import { PIPELINE_STAGES } from "./pipelineStages";

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
 * NO THROUGHPUT, NO ELAPSED TIME, NO PERCENTAGE. The design shows what has
 * happened and what is waiting on whom; it never shows how fast. Speed numbers
 * on this screen would make the two deliberate stops read as delays.
 *
 * CONTRACT GAP: no pipeline-stage endpoint. There is no run resource in
 * `packages/contract`, so the stage list, its phases and the page counts are
 * local placeholders (see `pipelineStages.ts`). The gate outcome would be
 * server state; the switch below stands in for it so both designed renderings
 * are reachable, and is the only invented control on this screen.
 *
 * CONTRACT GAP: the primary button navigates in the product (to the
 * completeness gate, or into review). Routes are wired elsewhere and no
 * pipeline resource exists, so it is rendered without a destination.
 */
export function ProcessingScreen() {
  const [gateHalted, setGateHalted] = useState(true);

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-2">
        <ScreenTitle>Step 3 — Pipeline</ScreenTitle>
        <h1 className="text-4xl font-semibold">Building the draft report</h1>
        <p className="text-md leading-body text-ink-secondary">
          Two halts by design: the completeness gate protects the spend, the
          human QC gate protects the client.
        </p>
      </header>

      <PackageStats />

      <div className="flex items-center gap-4">
        <Eyebrow variant="caption">Gate outcome · synthetic</Eyebrow>
        <ToggleGroup
          aria-label="Gate outcome (synthetic)"
          value={[gateHalted ? "halted" : "passed"]}
          onValueChange={(value) => setGateHalted(value[0] !== "passed")}
        >
          <Toggle value="halted">Halted</Toggle>
          <Toggle value="passed">Passed</Toggle>
        </ToggleGroup>
      </div>

      <ul className="overflow-hidden rounded-9 border border-line-strong bg-surface-panel">
        {PIPELINE_STAGES.map((stage) => (
          <StageRow key={stage.title} stage={stage} gateHalted={gateHalted} />
        ))}
      </ul>

      <Button size="xl" tone={gateHalted ? "halt" : "action"}>
        {gateHalted
          ? "Resolve completeness gate →"
          : "Open review — the run is waiting on you →"}
      </Button>
    </div>
  );
}
