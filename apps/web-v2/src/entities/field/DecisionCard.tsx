import type { ReactNode } from "react";
import type { Field, FieldReading } from "@titlepipe/contract";
import { AsRead } from "./AsRead";
import { DecisionBar, type DecisionBarProps } from "./DecisionBar";
import { EngineReadings } from "./EngineReadings";
import { fieldLabel } from "./fieldLabel";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/** Adopting a reading, pinning its line, and whatever the pin drew. */
export interface DecisionReadings {
  onAdopt: (value: string) => void;
  onPin: (reading: FieldReading, seat: string) => void;
  /** Rendered inside the fold, beneath the readings it was opened from. */
  pin: ReactNode;
}

/**
 * The reviewer's unit of work — the question, the reading, the decision.
 *
 * THE QUESTION LEADS, AND IT IS SERVER-AUTHORED. `Field.asking` is what the
 * reviewer is asked and `Field.why` is why the router sent it; composing either
 * here would be the screen narrating a routing decision only the router can
 * claim. Both are optional AND nullable — absent on a field that never went to
 * review, null on one that did with no authored question yet — so the block
 * draws only where one exists rather than inventing a sentence to fill it.
 *
 * THE READING IS SHOWN ONCE (D4). `AsRead` holds the export's single sunken row
 * with the cite beside it; the per-engine detail folds underneath. What used to
 * sit here was a bordered card per engine, which put the ensemble in front of
 * the question and roughly doubled this pane.
 *
 * `state` AND ITS LABEL ARE SERVER-SUPPLIED. Constraint 3 forbids deriving
 * status in the browser, and `server-owns-state.spec` pins that confidence
 * never promotes or demotes a field — a 0.99 field stays queued if the server
 * queued it.
 *
 * ACTIONS BELONG TO REVIEW ROLES, and are ABSENT rather than disabled for
 * anyone else. An ops user arriving by a complaint deep link can look at the
 * field in context; a greyed button would be an invitation to ask for
 * permission. The bug channel stays open to everyone, because "this input is
 * broken" is not a review decision.
 *
 * CONTRACT GAP: the export prints the section as its own chip beside a short
 * field name. `fieldLabel(path)` already leads with the report's own section
 * abbreviation (`MTG 1 — LENDER`), and printing it twice would make the header
 * disagree with itself. One label, spelled the way the delivered report spells
 * it.
 */
export function DecisionCard({
  field,
  statusLabel,
  actions,
  readings,
  children,
}: {
  field: Field;
  /** Server-supplied display text for `field.state`. Never derived here. */
  statusLabel: string;
  /** `null` when the viewer's role cannot act — absent, never disabled. */
  actions: DecisionBarProps | null;
  readings: DecisionReadings;
  /** The editor this card opened, and the server's answer to it. */
  children?: ReactNode;
}) {
  const asking = field.asking ?? null;
  const why = field.why ?? null;

  return (
    <Card accent="action" data-testid="decision-card">
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
          {statusLabel}
        </Chip>
      </CardHeader>

      <CardBody className="flex flex-col gap-6">
        {asking === null ? null : (
          <div data-testid="sel-asking" className="flex flex-col gap-2">
            <p className="text-md font-semibold leading-body text-ink-primary">{asking}</p>
            {why === null ? null : (
              <p className="text-base leading-body text-ink-secondary">
                {/*
                  The export's own flag word, in literal capitals: the reason
                  arrives labelled as the ROUTER's statement rather than as
                  narration the screen might have written itself.
                */}
                <Eyebrow variant="caption" tone="attend">
                  FLAGGED{" "}
                </Eyebrow>
                {why}
              </p>
            )}
          </div>
        )}

        <AsRead field={field}>
          <EngineReadings field={field} onAdopt={readings.onAdopt} onPin={readings.onPin} />
          {readings.pin}
        </AsRead>

        {actions === null ? (
          <p className="text-xs text-ink-muted">
            You are here for context. Review decisions belong to the reviewer on this order.
          </p>
        ) : (
          <DecisionBar {...actions} />
        )}

        {/*
          `Report pipeline bug` used to sit here as a bare, inert line. It is
          gone: the export draws no such control on Review, and no product rule
          asks for one (the 2026-07-30 ruling). A dead affordance on the
          decision surface is worse than none — it invites a reviewer to file
          somewhere that does not exist while the field stays queued.
        */}
        {children}
      </CardBody>
    </Card>
  );
}
