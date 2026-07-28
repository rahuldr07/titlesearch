import type { CompletenessGap, GapKind } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";
import { GapCloseOptions } from "./GapCloseOptions";
import { GapClosedNote } from "./GapClosedNote";
import type { GapClosure } from "./useGateState";

/**
 * One disagreement, laid out as claim against evidence.
 *
 * THE TWO LINES ARE DELIBERATELY SYMMETRICAL. "You said" and "We found" get the
 * same label column and the same weight, because the screen is not entitled to
 * decide which one is right — the machine misses documents that are plainly in
 * the package, and a layout that presented the finding as the correction would
 * teach people to amend answers that were true.
 *
 * PROVISIONAL IS LOUDER THAN THE FINDING IT QUALIFIES, AND ONLY THE N/A CARD
 * CARRIES IT. A gap raised against an N/A the gate has not accepted says so in
 * a dashed attend block rather than a footnote — a gate that halts a run on
 * evidence it cannot yet vouch for must be the one to admit it. The other two
 * kinds do not get one: a caveat printed on every card is wallpaper, and the
 * card that actually needs reading loses the only mark that distinguishes it.
 *
 * CONTRACT GAP: the wire carries no per-gap provisional text — the design
 * quotes the precondition this gate matched on, and nothing on the response
 * says what it was. The note below is keyed on `kind` alone and states only
 * what the kind itself means, which is the most that is true without inventing.
 */
const KIND_LABEL: Record<GapKind, string> = {
  na_provisional: "Gap · answered N/A",
  /*
   * CONTRACT GAP: the design names the answer the gate disputes — "Gap ·
   * answered YES". `kind` says a claim is disputed and nothing says which
   * answer it was, so the label stops where the wire does.
   */
  disagreement: "Gap · claim disputed",
  period_short: "Gap · ordered period",
};

const PROVISIONAL_NOTE =
  "The precondition behind this gate is a fixture on the build, not a value segmentation produced. It reads the same on every package, so this card cannot yet be trusted as evidence about THIS order.";

export function GapCard({
  gap,
  closure,
  onClose,
}: {
  gap: CompletenessGap;
  closure: GapClosure | undefined;
  onClose: (option: string, note: string) => void;
}) {
  const closedByServer = gap.closed_by !== null;
  const open = !closedByServer && closure === undefined;

  return (
    <Card
      className={cn(
        "border-l-(length:--stroke-severity)",
        open ? "border-l-state-halt" : "border-l-state-settled",
      )}
    >
      <CardHeader>
        <h2 className="text-md font-semibold">{gap.line_label}</h2>
        <Chip className="ml-auto" shape="pill" size="micro" tone={open ? "halt" : "settled"}>
          {open ? KIND_LABEL[gap.kind] : "Closed"}
        </Chip>
      </CardHeader>

      <CardBody className="flex flex-col gap-6">
        <div className="flex gap-5">
          <Eyebrow variant="field" as="p" className="basis-42 shrink-0">
            You said
          </Eyebrow>
          <p className="text-base leading-body text-ink-primary">{gap.claim}</p>
        </div>

        <div className="flex gap-5">
          <Eyebrow variant="field" as="p" tone="halt" className="basis-42 shrink-0">
            We found
          </Eyebrow>
          <p className="text-base leading-body text-state-halt-ink">{gap.evidence}</p>
        </div>

        {open && gap.kind === "na_provisional" ? (
          <div className="flex gap-5 rounded-7 border border-dashed border-state-attend bg-state-attend-surface px-6 py-5">
            <Eyebrow variant="field" as="p" tone="attend" className="basis-42 shrink-0">
              Provisional
            </Eyebrow>
            <p className="text-xs leading-open text-ink-secondary">{PROVISIONAL_NOTE}</p>
          </div>
        ) : null}

        {open ? (
          <GapCloseOptions options={gap.close_options} onClose={onClose} />
        ) : (
          <GapClosedNote
            option={closure?.option ?? "Closed on the order"}
            note={closure?.note ?? gap.closed_note}
            by={closure?.by ?? gap.closed_by}
          />
        )}
      </CardBody>
    </Card>
  );
}
