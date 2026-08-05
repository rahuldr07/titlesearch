import { useQuery } from "@tanstack/react-query";
import { GateCallToAction } from "../../entities/order/GateCallToAction";
import { Card } from "../../shared/ui/Card";
import { DividedSection } from "../../shared/ui/ListRow";
import { Screen } from "../../shared/ui/Screen";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";
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
 *
 * RULE: the gate's outcome is the server's, so this screen holds no state of
 * its own. FAILURE PREVENTED: a "Gate outcome · local preview" toggle used to
 * sit between the run and the button, and flipping it repainted the call to
 * action while the stage rows kept printing the server's phases — the screen
 * contradicting itself in two places at once. The closing button now reads
 * `gate_halted` and nothing else; the rendering the fixtures cannot reach is
 * catalogued in `features/gallery`, which is what that screen is for.
 *
 * The design's reading order survives the removal intact: stats, then the run,
 * then the one thing to do about it.
 */
export function ProcessingScreen() {
  const { data, isPending, isError } = useQuery(orderPipelineQuery(PIPELINE_ORDER_ID));

  if (isError) return <ScreenMessage tone="halt" measure="700">Pipeline unavailable.</ScreenMessage>;
  if (isPending) return <ScreenMessage measure="700">Loading the run…</ScreenMessage>;

  return (
    <Screen measure="700" pad="40" placement="centre">
      <div className="flex flex-col gap-7">
        <ScreenHeading
          eyebrow="Step 3 — Pipeline"
          title="Building the draft report"
          lede="Two halts by design: the completeness gate protects the spend, the human QC gate protects the client."
        />

        <PackageStats
          totalPages={data.total_pages}
          pagesRelevant={data.pages_relevant}
          classifierNote={data.classifier_note}
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
            {data.stages.map((stage) => (
              <StageRow key={stage.id} stage={stage} />
            ))}
          </DividedSection>
        </Card>

        <GateCallToAction halted={data.gate_halted} orderId={data.order_id} />
      </div>
    </Screen>
  );
}
