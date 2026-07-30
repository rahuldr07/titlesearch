import type { CompletenessGap, GapKind } from "@titlepipe/contract";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
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
  onClose: (option: string, note: string | null) => void;
}) {
  const closedByServer = gap.closed_by !== null;
  const open = !closedByServer && closure === undefined;

  return (
    /*
     * THE SEVERITY MARK IS A 2px INSET TOP STRIPE — `box-shadow: inset 0 2px 0`
     * (:553), red while the gap is open and green once it is closed. The export
     * carries five of these and not one 4px left border. This card drew the
     * left bar, which put it in a heavier voice than the gate banner above it
     * and squared its own top-left corner against three neighbours that were
     * round. `Card accent` is that stripe; nothing here spells an edge by hand.
     */
    <Card accent={open ? "halt" : "settled"}>
      <CardHeader>
        {/*
          "Sign-off line N · label", the design's own heading. The NUMBER is
          `gap.line_number` and never a lookup from the label: two lines may
          share wording across product versions, and matching on prose is a
          join the browser has no business making. Until 2026-07-30 the wire
          carried no N and the card printed the label alone, which left no way
          back to the line that was actually answered.
        */}
        <h2 className="text-md font-semibold">
          Sign-off line {gap.line_number} · {gap.line_label}
        </h2>
        <Chip className="ml-auto" shape="pill" size="micro" tone={open ? "halt" : "settled"}>
          {open ? KIND_LABEL[gap.kind] : "Closed"}
        </Chip>
      </CardHeader>

      {/*
        THE RHYTHM IS UNEVEN ON PURPOSE (:528-540): 8px between the claim and
        the evidence, because they are ONE comparison, then 14px before each
        block that follows. A blanket 12px gap set all four apart equally and
        the pair stopped reading as a pair — which is the only thing the two
        symmetrical rows are arranged to say.
      */}
      <CardBody>
        <div className="mb-4 flex gap-5">
          <Eyebrow variant="field" as="p" className="basis-42 shrink-0">
            You said
          </Eyebrow>
          <p className="text-base leading-body text-ink-primary">{gap.claim}</p>
        </div>

        <div className="mb-7 flex gap-5">
          <Eyebrow variant="field" as="p" tone="halt" className="basis-42 shrink-0">
            We found
          </Eyebrow>
          <p className="text-base leading-body text-state-halt-ink">{gap.evidence}</p>
        </div>

        {/*
          `dashed` is the claim, not the decoration: this block is a proposal
          with no document behind it, and Card draws that in STYLE so it
          survives greyscale (§4.2). The hairline is the family's own
          `-border`, which the hand-rolled version spelled as the saturated
          `border-state-attend` — one meaning drawn at two strengths depending
          on which card you opened.
        */}
        {open && gap.kind === "na_provisional" ? (
          <Card size="nested" tone="attend" dashed className="mb-7 flex gap-5 px-6 py-5">
            <Eyebrow variant="field" as="p" tone="attend" className="basis-42 shrink-0">
              Provisional
            </Eyebrow>
            <p className="text-xs leading-open text-ink-secondary">{PROVISIONAL_NOTE}</p>
          </Card>
        ) : null}

        {open ? (
          <GapCloseOptions options={gap.close_options} onClose={onClose} />
        ) : (
          /*
           * THE LOCAL CLOSURE WINS WHOLE, or the server's record does — never a
           * mix. `closure?.note ?? gap.closed_note` would have reached past a
           * comment-free closure (the server now says which options need no
           * comment) and printed the SERVER's sentence under a person's
           * closure, attributing words to the wrong act.
           */
          <GapClosedNote
            option={closure ? closure.option : "Closed on the order"}
            note={closure ? closure.note : gap.closed_note}
            by={closure ? closure.by : gap.closed_by}
          />
        )}
      </CardBody>
    </Card>
  );
}
