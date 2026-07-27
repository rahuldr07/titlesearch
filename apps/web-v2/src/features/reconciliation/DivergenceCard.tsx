import { useState } from "react";
import type { Reconciliation } from "@titlepipe/contract";
import type { RulingBody } from "./queries";
import { PickPanel } from "./PickPanel";
import { ThirdValue } from "./ThirdValue";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField, TextArea } from "../../shared/ui/TextField";
import { Button } from "../../shared/ui/Button";

interface DivergenceCardProps {
  divergence: Reconciliation;
  pending: boolean;
  onRule: (body: RulingBody) => void;
}

/**
 * ONE DIVERGENCE — two independent readings, and the third answer that both of
 * them may be wrong.
 *
 * NEITHER SCOPE IS PRE-SELECTED and the draft starts empty (`reconciliation.spec`
 * #2). The design pre-populates the draft from the ruling; that is dropped. A
 * pre-written rule is a rule you skim and accept, and the words in the rulebook
 * then belong to a template rather than to the person who saw the pattern.
 *
 * A THIRD VALUE NEEDS ITS WHY (`reconciliation.spec` #4). Picking A or B means
 * agreeing with a reading someone already justified; entering a third means
 * both trained readers were wrong, which is a claim that has to carry its
 * reasoning. CONTRACT GAP: `reason` is optional in the schema, so this refusal
 * currently lives only here — the server would accept a third value bare.
 */
export function DivergenceCard({ divergence, pending, onRule }: DivergenceCardProps) {
  const path = divergence.path;
  const [pick, setPick] = useState<"A" | "B" | "third" | null>(null);
  const [third, setThird] = useState("");
  const [why, setWhy] = useState("");
  const [cite, setCite] = useState("");
  const [scope, setScope] = useState<"field" | "general" | null>(null);
  const [draft, setDraft] = useState("");

  const value =
    pick === "A" ? divergence.value_a : pick === "B" ? divergence.value_b : third.trim();
  const hasValue = pick !== null && value !== null && value !== "";
  const hasWhy = pick !== "third" || why.trim() !== "";
  const ready = hasValue && hasWhy && cite.trim() !== "";

  const submit = (asGeneral: boolean) => {
    if (!ready || value === null) return;
    onRule({
      path,
      ruling_value: value,
      citation: cite.trim(),
      ...(why.trim() === "" ? {} : { reason: why.trim() }),
      ...(asGeneral ? { general_rule_draft: { text: draft.trim() } } : {}),
    });
  };

  return (
    <Card data-testid={`div-${path}`}>
      <CardHeader filled>
        <Eyebrow variant="section">{path}</Eyebrow>
      </CardHeader>
      <CardBody className="flex flex-col gap-5">
        <PickPanel divergence={divergence} pick={pick} onPick={setPick} />

        {pick === "third" ? (
          <ThirdValue path={path} value={third} why={why} onValue={setThird} onWhy={setWhy} />
        ) : null}

        <label className="flex flex-col gap-2">
          <Eyebrow variant="field">Citation — a ruling with no source is an opinion</Eyebrow>
          <TextField
            data-testid={`cite-${path}`}
            value={cite}
            onChange={(event) => setCite(event.target.value)}
          />
        </label>

        <div className="flex flex-col gap-3">
          <p className="text-xs text-ink-muted">
            Is this a one-off, or did you just see a pattern? Neither is
            pre-selected.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button
              size="sm"
              fill="outlined"
              tone="neutral"
              data-testid={`rule-field-${path}`}
              aria-pressed={scope === "field"}
              disabled={!ready || pending}
              onClick={() => {
                setScope("field");
                submit(false);
              }}
            >
              Field ruling — this order only
            </Button>
            <Button
              size="sm"
              fill="outlined"
              tone="neutral"
              data-testid={`rule-general-${path}`}
              aria-pressed={scope === "general"}
              disabled={!ready || pending}
              onClick={() => setScope("general")}
            >
              General rule — draft for the rulebook
            </Button>
          </div>
        </div>

        {scope === "general" ? (
          <div className="flex flex-col gap-3">
            <Eyebrow variant="field">
              Draft rule — your words, nothing pre-written · files as PENDING,
              not live until an engineer confirms
            </Eyebrow>
            <TextArea
              data-testid={`draft-${path}`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <div>
              <Button
                size="sm"
                data-testid={`file-draft-${path}`}
                disabled={!ready || draft.trim() === "" || pending}
                onClick={() => submit(true)}
              >
                File as PENDING
              </Button>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
