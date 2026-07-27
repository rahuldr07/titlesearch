import type { GoldenField } from "@titlepipe/contract";
import { useConfirmSeed, useDemoteSeed } from "./queries";
import { CorrectAction } from "./CorrectAction";
import { AffirmAction } from "./AffirmAction";
import { SeedLog } from "./SeedLog";
import { ApiError } from "../../shared/api";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * THREE ACTIONS. NOTHING ELSE — and the third is what keeps the other two
 * honest. Without "demote to suspect" the only exits are change it or bless it,
 * and an illegible recital gets blessed because there is nowhere else to put it.
 *
 * NO BULK ANYTHING EXISTS HERE (§9.3). One field, one document, one record: this
 * is the only place in the system where ground truth changes, and every
 * affordance that would let someone act on two fields at once is absent rather
 * than disabled.
 */
export function SeedRecord({ field }: { field: GoldenField }) {
  const confirm = useConfirmSeed(field.id);
  const demote = useDemoteSeed(field.id);
  const refusal = [confirm.error, demote.error].find((e) => e instanceof ApiError);

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">{field.path}</Eyebrow>
          <span className="font-mono text-xs text-ink-muted">{field.order_id}</span>
        </CardHeader>
        <CardBody className="grid gap-6 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <Eyebrow variant="caption">Current seed value</Eyebrow>
            <span data-testid="seed-value" className="font-mono text-lg text-ink-primary">
              {field.value}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <Eyebrow variant="caption">Source tag</Eyebrow>
            <span data-testid="seed-tag" className="font-mono text-lg text-ink-primary">
              {field.tag}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <Eyebrow variant="caption">Citation on the seed</Eyebrow>
            <span className="font-mono text-base text-ink-secondary">
              {field.source_citation ?? "none recorded"}
            </span>
          </div>
        </CardBody>
      </Card>

      {refusal instanceof ApiError ? (
        <p role="alert" className="text-xs font-semibold text-state-halt-ink">
          server: {refusal.message}
        </p>
      ) : null}

      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">Three actions. Nothing else.</Eyebrow>
        </CardHeader>
        <CardBody className="flex flex-col gap-9">
          <AffirmAction
            heading="1 · Confirm seed"
            blurb={
              <>
                The seed is correct and the model failure is real. The value
                stands and the tag becomes <code className="font-mono">ruled</code>{" "}
                — human-verified rather than merely delivered.
              </>
            }
            reasonLabel="How you read the document"
            reasonTestId="seed-confirm-reason"
            buttonTestId="seed-confirm-btn"
            buttonLabel="Confirm — the field stays; the failure is the model's"
            tone="settled"
            pending={confirm.isPending}
            onSubmit={(reason) => confirm.mutate({ reason })}
          />

          <hr className="border-line-subtle" />
          <CorrectAction fieldId={field.id} />
          <hr className="border-line-subtle" />

          <AffirmAction
            heading="3 · Demote to suspect"
            blurb="The document is ambiguous — neither value can be confirmed. This is not a lesser action but a precise diagnosis: the document is the problem, and no one is blamed for it."
            reasonLabel="What makes it unreadable"
            reasonTestId="seed-demote-reason"
            buttonTestId="seed-demote-btn"
            buttonLabel="Demote — out of the actionable denominator"
            tone="attend"
            pending={demote.isPending}
            onSubmit={(reason) => demote.mutate({ reason })}
          />
        </CardBody>
      </Card>

      <SeedLog field={field} />
    </div>
  );
}
