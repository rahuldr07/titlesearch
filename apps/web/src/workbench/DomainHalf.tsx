import { Row } from "./Row";
import { FieldValueView } from "../entities/field/FieldValueView";
import { StatePill } from "../entities/field/StatePill";
import { CitationRef } from "../entities/field/CitationRef";
import { OrderRef } from "../entities/order/OrderRef";
import { RulePill } from "../entities/rule/RulePill";
import { StageDots } from "../entities/order/StageDots";
import { ClerkStamp } from "../entities/evidence/ClerkStamp";
import type { FieldValue } from "../shared/fieldValue";

/**
 * The DOMAIN half of the workbench: the components that speak TitlePipe rather
 * than speaking Button.
 *
 * The first band is the one to look at hardest. Those are the five renders a
 * no-value field can take, and `enums.ts:20-52` says they must never collapse
 * into one grey dash — four are statements about the DOCUMENT, the fifth is a
 * statement about the PIPELINE. They are drawn here in a row precisely so a
 * person can confirm at a glance that they do not.
 *
 * Every value below is synthetic and obviously so. A convincing fixture is how
 * invented data escapes into a screen.
 */

const CITATION = { docId: "DOC-0000", page: 12, snippet: "…a specimen line…" };

const FIVE: readonly FieldValue[] = [
  { kind: "na-not-present" },
  { kind: "na-not-found" },
  { kind: "na-not-stated" },
  { kind: "na-present-unreadable", citation: CITATION },
  { kind: "not-extracted" },
];

export function DomainHalf() {
  return (
    <>
      <Row
        title="The five no-value renders"
        note="four statements about the document, one about the pipeline — never one grey dash"
      >
        <div className="flex flex-col gap-4">
          {FIVE.map((value, i) => (
            <FieldValueView key={i} value={value} />
          ))}
        </div>
      </Row>

      <Row title="A value, and a value with no source" note="the second is a defect, drawn as one">
        <FieldValueView value={{ kind: "cited", cited: { value: "SPECIMEN VALUE", citation: CITATION } }} />
        <FieldValueView value={{ kind: "uncited", value: "SPECIMEN VALUE" }} />
      </Row>

      <Row title="Field state" note="rendered verbatim from the server — confidence never promotes or demotes it">
        <StatePill state="pending" />
        <StatePill state="auto_confirmed" />
        <StatePill state="needs_review" />
        <StatePill state="confirmed" />
        <StatePill state="corrected" />
        <StatePill state="escalated" />
      </Row>

      <Row title="Citation and reference" note="mono, because these are data (rule 3)">
        <CitationRef docId="DOC-0000" page={12} snippet="…a specimen line…" />
        <OrderRef orderRef="TP-0000-0000" emphasis="row" />
        <OrderRef orderRef="TP-0000-0000" emphasis="subject" />
        <OrderRef orderRef="TP-0000-0000" emphasis="spotlight" />
      </Row>

      <Row title="Rules" note="a PENDING rule renders visibly inert — it cannot affect the pipeline yet">
        <RulePill code="R00" status="pending" />
        <RulePill code="R00" status="active" />
        <RulePill code="R00" status="retired" />
      </Row>

      <Row title="Stages">
        <StageDots
          stages={[
            { id: "a", label: "Intake", status: "settled" },
            { id: "b", label: "Extraction", status: "settled" },
            { id: "c", label: "Review", status: "running" },
            { id: "d", label: "Second read", status: "blocked", note: "Waiting on a countersign" },
            { id: "e", label: "Release", status: "pending" },
          ]}
        />
      </Row>

      <Row title="Evidence" note="paper, not placeholder bars (rule 8) — all CSS, no assets">
        <ClerkStamp kind="book-page" book="0000" page="00" recordedOn="0000-00-00" />
      </Row>
    </>
  );
}
