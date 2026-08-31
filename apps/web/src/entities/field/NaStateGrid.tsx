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
 * The 4-state NA picker for absence-only fields.
 *
 * All four are always offered, including NOT_PRESENT: "never surfaced for
 * review" is a statement about the queue, and this grid is the opposite
 * direction — a reviewer ruling that the field is structurally absent.
 * Removing the option would make the correct answer unsayable and push the
 * reviewer onto NOT_FOUND, a different claim that routes differently.
 *
 * Options come from the Zod enum, not a hand-written array: a fifth member
 * added to the contract appears here without an edit, and NO_VALUE fails to
 * compile until it is described. The grid selects a reason; it never submits
 * one, and it never decides which fields are absence-only.
 */
export type NaStateGridProps = {
  /** The reason currently chosen, or null for none. Server state, echoed. */
  readonly value: NaReason | null;
  readonly onChange: (reason: NaReason) => void;
  /** Blocked states its reason, and the server authors that sentence. */
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
 * The rulebook's own distinctions, quoted rather than paraphrased — this is
 * the one place a reviewer decides between four things that look alike, and
 * NOT_FOUND vs NOT_STATED is the pair that gets confused.
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
