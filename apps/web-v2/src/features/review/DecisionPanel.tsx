import type { Field, FieldReading } from "@titlepipe/contract";
import { canDo } from "@titlepipe/contract";
import { enginesDisagree, fieldLabel, readingsOf, stateLabel } from "./fieldLabel";
import { ReadingsPanel } from "./ReadingsPanel";
import { SourcePin } from "./SourcePin";
import { useSession } from "../../shared/session";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Chip } from "../../shared/ui/Chip";
import { Button } from "../../shared/ui/Button";

export interface Pinned {
  seat: string;
  reading: FieldReading;
}

interface DecisionPanelProps {
  field: Field;
  pinned: Pinned | null;
  onPin: (pinned: Pinned) => void;
  onAdopt: (value: string) => void;
  onConfirm: () => void;
  onCorrect: () => void;
  onEscalate: () => void;
  onPass: () => void;
  children: React.ReactNode;
}

/**
 * The selected field, its evidence, and the three things a reviewer can do.
 *
 * A BOTH-FOUND DISAGREEMENT NEVER CLAIMS EMPTINESS (`ux.spec` #1). Two engines
 * returned values and the merge did not settle — so the headline shows the
 * leading reading AS A DRAFT, labelled. Rendering "Not Available" here would
 * tell the reviewer there is nothing to look at while two candidates sit in the
 * payload, which is the exact defect the orphan rule was written against.
 *
 * ACTIONS BELONG TO REVIEW ROLES. An ops user arriving by a complaint deep link
 * can look at the field in context but not act on it, and the actions are
 * ABSENT rather than disabled — a greyed button is an invitation to ask for
 * permission. The bug channel stays open for everyone, because "this input is
 * broken" is not a review decision.
 */
export function DecisionPanel({
  field,
  pinned,
  onPin,
  onAdopt,
  onConfirm,
  onCorrect,
  onEscalate,
  onPass,
  children,
}: DecisionPanelProps) {
  const role = useSession((s) => s.role);
  const mayReview = canDo(role, "field.confirm");
  const readings = readingsOf(field);
  const draft = readings.find((reading) => reading.value !== null)?.value ?? null;

  return (
    <Card>
      <CardHeader filled>
        <span data-testid="sel-label" className="font-mono text-md font-semibold text-ink-primary">
          {fieldLabel(field.path)}
        </span>
        <Chip
          data-testid="sel-state"
          tone={field.state === "needs_review" ? "attend" : "neutral"}
          size="sm"
          bordered
        >
          {stateLabel(field)}
        </Chip>
      </CardHeader>

      <CardBody className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Eyebrow variant="caption">The value</Eyebrow>
          {field.value !== null ? (
            <span className="font-mono text-lg text-ink-primary">{field.value}</span>
          ) : draft !== null && enginesDisagree(field) ? (
            <>
              <span className="font-mono text-lg text-ink-primary">{draft}</span>
              <span className="text-xs text-state-attend-ink">draft — nothing settled yet</span>
            </>
          ) : (
            <span className="text-base text-ink-secondary">
              Nothing has been merged for this field.
            </span>
          )}
          {field.source_snippet === null ? null : (
            <p className="font-quote text-xs italic text-ink-secondary">{field.source_snippet}</p>
          )}
        </div>

        <ReadingsPanel
          field={field}
          onPin={(reading, seat) => onPin({ seat, reading })}
          onAdopt={onAdopt}
        />

        {pinned === null ? null : (
          <SourcePin
            seat={pinned.seat}
            engineId={pinned.reading.engine_id}
            page={pinned.reading.page}
            coords={pinned.reading.line_coords}
          />
        )}

        {mayReview ? (
          <div className="flex flex-wrap gap-4">
            <Button size="sm" data-testid="act-confirm" onClick={onConfirm}>
              Confirm ⏎
            </Button>
            <Button size="sm" fill="outlined" tone="neutral" data-testid="act-correct" onClick={onCorrect}>
              Correct c
            </Button>
            <Button size="sm" fill="outlined" tone="attend" data-testid="act-escalate" onClick={onEscalate}>
              Escalate e
            </Button>
            <Button size="sm" fill="ghost" tone="neutral" data-testid="act-pass" onClick={onPass}>
              Pass — say why
            </Button>
          </div>
        ) : (
          <p className="text-xs text-ink-muted">
            You are here for context. Review decisions belong to the reviewer on
            this order.
          </p>
        )}

        {children}

        <p className="text-xs text-ink-muted">Report pipeline bug</p>
      </CardBody>
    </Card>
  );
}
