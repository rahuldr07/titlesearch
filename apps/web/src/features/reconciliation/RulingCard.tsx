import { useState } from "react";
import type { Reconciliation, ReconciliationRulingRequest } from "@titlepipe/contract";
import { Button, Input, Label, RadioGroup, RadioGroupItem, Textarea } from "../../components/ui";
import { GeneralRuleOffer } from "./GeneralRuleOffer";
import { asChoice, rulingHold, rulingValue, type ValueChoice } from "./rulingHold";

/**
 * THE RULING, AND IT IS REFUSED WITHOUT A CITATION.
 *
 * `endpoints.ts:345`: "a ruling with no source is an opinion. Citation is
 * required." Carried in three places, deliberately: the SERVER refuses
 * (handlers.ts:1295, 422 from `citation: z.string().min(1)`) and is the only
 * enforcement; the request TYPE has no arm without it, so the wrong call does
 * not compile; and this button states the hold in words while the citation is
 * missing, because a control that is merely dead teaches nobody why.
 *
 * ══ FOUR CHOICES, AND THE FOURTH IS THE ONE A PICKER WOULD LOSE ════════════
 *
 * `ruling_value` is NULLABLE (endpoints.ts:351), so "neither reading is right"
 * is a RULING the contract can express — rule 14's typed absence, not a refusal
 * to decide. A control offering only A and B would silently make that ruling
 * unsayable and push the senior into picking the less-wrong string.
 *
 * ══ NOTHING IS PRE-SELECTED ════════════════════════════════════════════════
 *
 * The radio opens with no member chosen. A default of "Seat A" is a ruling the
 * UI made, and on a symmetric blind pair (handlers.ts:349 — "the model is not a
 * party") it is the exact bias the whole exercise exists to remove.
 */
export function RulingCard({
  divergence,
  pending,
  onRule,
}: {
  readonly divergence: Reconciliation;
  readonly pending: boolean;
  readonly onRule: (body: ReconciliationRulingRequest) => void;
}) {
  const [choice, setChoice] = useState<ValueChoice | null>(null);
  const [typed, setTyped] = useState("");
  const [citation, setCitation] = useState("");
  const [reason, setReason] = useState("");
  const [offered, setOffered] = useState(false);
  const [draft, setDraft] = useState("");
  const [scope, setScope] = useState("");

  const held =
    choice === null
      ? "Held: say which reading the ruling adopts, or that neither does."
      : rulingHold(choice, typed, citation, offered, draft);

  return (
    <div data-testid="ruling-card" className="flex flex-col gap-8">
      <RadioGroup
        aria-label="What this path reads, once ruled"
        value={choice}
        onChange={(value) => setChoice(asChoice(value))}
        className="flex flex-col gap-5"
      >
        <RadioGroupItem value="a" data-testid="choice-a">
          Seat A&rsquo;s reading
        </RadioGroupItem>
        <RadioGroupItem value="b" data-testid="choice-b">
          Seat B&rsquo;s reading
        </RadioGroupItem>
        <RadioGroupItem value="other" data-testid="choice-other">
          A third value — neither seat read it right
        </RadioGroupItem>
        <RadioGroupItem value="none" data-testid="choice-none">
          No value belongs here
        </RadioGroupItem>
      </RadioGroup>

      {choice === "other" && (
        <div className="flex flex-col gap-4">
          <Label htmlFor="ruling-typed">What it reads</Label>
          {/* Rule 3: the value is data, so the field is mono. */}
          <Input
            id="ruling-typed"
            data-testid="ruling-typed"
            data
            aria-label="What it reads"
            onChange={(event) => setTyped(event.target.value)}
          />
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Label htmlFor="ruling-citation">Where you read it — required</Label>
        {/* Rule 3: a citation is data. */}
        <Input
          id="ruling-citation"
          data-testid="ruling-citation"
          data
          aria-label="Where you read it"
          onChange={(event) => setCitation(event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-4">
        <Label htmlFor="ruling-reason">Why, in your words — optional</Label>
        <Textarea
          id="ruling-reason"
          data-testid="ruling-reason"
          aria-label="Why, in your words"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>

      <GeneralRuleOffer
        offered={offered}
        onOffered={setOffered}
        draft={draft}
        onDraft={setDraft}
        onScope={setScope}
      />

      <Button
        data-testid="rule-divergence-btn"
        variant="primary"
        disabledBecause={pending ? "Sending — the server has not answered yet." : held}
        onPress={() => {
          if (choice === null) return;
          onRule({
            path: divergence.path,
            ruling_value: rulingValue(choice, divergence.value_a, divergence.value_b, typed),
            citation: citation.trim(),
            ...(reason.trim() === "" ? {} : { reason: reason.trim() }),
            ...(offered
              ? {
                  general_rule_draft: {
                    text: draft.trim(),
                    jurisdiction_scope: scope.trim() === "" ? null : scope.trim(),
                  },
                }
              : {}),
          });
        }}
      >
        {held === null ? "Record the ruling" : "Record — held without a source"}
      </Button>
    </div>
  );
}
