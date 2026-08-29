import type { NaReason } from "@titlepipe/contract";
import { NaReason as NaReasonEnum } from "@titlepipe/contract";
import {
  RadioGroup,
  RadioGroupItem,
  FieldSet,
  FieldLegend,
  FieldDescription,
} from "../../components/ui";
import { NO_VALUE } from "./noValueStates";

/**
 * THE 4-STATE NA PICKER (design §Screens 7, "NA 4-state grid for absence-only
 * fields").
 *
 * ══ WHY ALL FOUR ARE ALWAYS OFFERED, INCLUDING NOT_PRESENT ══════════════════
 *
 * `enums.ts:31-35` says NOT_PRESENT is "correct, and NEVER surfaced for review",
 * and it is tempting to read that as "omit it from the picker". It is not. That
 * sentence is about the QUEUE — a NOT_PRESENT field is not routed to a reviewer
 * to chase. This grid is the opposite direction: a reviewer looking at a row
 * that IS in front of them, RULING that the field is structurally absent in this
 * jurisdiction. Removing the option would make the correct answer unsayable and
 * push the reviewer onto NOT_FOUND, which is a different claim and routes
 * differently. The distinction is surfaced instead, on the option itself.
 *
 * ══ WHY THE OPTIONS COME FROM THE ZOD ENUM ══════════════════════════════════
 *
 * `NaReasonEnum.options` rather than a hand-written array: a fifth member added
 * to the contract appears here without an edit, and `NO_VALUE` fails to compile
 * until it is described. A literal array would silently keep offering four.
 *
 * The grid SELECTS a reason. It never submits one, and it never decides which
 * fields are "absence-only" — the caller holds the server's answer to that.
 */
export type NaStateGridProps = {
  /** The reason currently chosen, or null for none. Server state, echoed. */
  readonly value: NaReason | null;
  readonly onChange: (reason: NaReason) => void;
  /** Rule 9: blocked states its reason, and the server authors that sentence. */
  readonly disabledBecause?: string | null | undefined;
};

export function NaStateGrid({ value, onChange, disabledBecause }: NaStateGridProps) {
  return (
    <FieldSet data-na-grid>
      <FieldLegend variant="label">Record this field as absent</FieldLegend>
      <RadioGroup
        aria-label="Record this field as absent"
        value={value ?? ""}
        onChange={(next) => onChange(NaReasonEnum.parse(next))}
        disabledBecause={disabledBecause}
      >
        {NaReasonEnum.options.map((reason) => (
          <RadioGroupItem key={reason} value={reason} className="items-start">
            <span className="flex flex-col gap-1">
              <span>
                {NO_VALUE[reason].mark} {NO_VALUE[reason].sentence}
              </span>
              {/* The distinction, stated on the option rather than in a tooltip:
                  this is the one place four look-alike answers are told apart. */}
              <FieldDescription>{describe(reason)}</FieldDescription>
            </span>
          </RadioGroupItem>
        ))}
      </RadioGroup>
    </FieldSet>
  );
}

/**
 * The rulebook's own distinctions, quoted rather than paraphrased — this is the
 * one place a reviewer decides between four things that look alike, and
 * NOT_FOUND vs NOT_STATED is the pair that gets confused (`enums.ts:36-39`:
 * "the search happened and returned a document; the document does not say").
 */
function describe(reason: NaReason): string {
  switch (reason) {
    case "NOT_PRESENT":
      return "Structurally absent in this jurisdiction. Correct, and never surfaced for review.";
    case "NOT_FOUND":
      return "The field exists here and was searched for. Nothing of record.";
    case "NOT_STATED":
      return "The search returned a document, and the document is silent on it.";
    case "PRESENT_UNREADABLE":
      return "It is on the page and could not be read. Carries a page reference.";
  }
}
