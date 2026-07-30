import type { ClientRecord, ConfigLine, OverrideType } from "@titlepipe/contract";

import { Button } from "../../shared/ui/Button";
import { Card, CardBody } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { EmptyNote } from "../../shared/ui/EmptyPanel";
import { Eyebrow } from "../../shared/ui/Eyebrow";

import { AuthorOverride } from "./AuthorOverride";

/**
 * The delta list — "holds these deltas only" is the heading, and it is a
 * statement about storage, not a filter on a longer list.
 *
 * A waive is toned HALT and everything else action, because the three others
 * change how a line is answered while a waive removes the obligation. That is
 * the difference worth seeing from across the room when you are scanning a
 * client for what it has excused itself from.
 *
 * Every delta carries WHO AUTHORED IT AND WHEN, verbatim from the record. A
 * difference in what a search must cover with no name against it is the config
 * layer's version of a value with no provenance.
 */
const TONE: Readonly<Record<OverrideType, "halt" | "action">> = {
  waive: "halt", narrow: "action", replace: "action", add: "action",
};

export function OverridesPanel({
  client,
  productName,
  lines,
  canAuthor,
}: {
  client: ClientRecord;
  productName: string;
  lines: readonly ConfigLine[];
  canAuthor: boolean;
}) {
  return (
    <Card>
      <CardBody>
        <Eyebrow variant="section" as="h2">
          Sign-off overrides · {client.name} holds these deltas only
        </Eyebrow>

        {/*
          "No deltas" is an ANSWER, not a blank. The record came back and it
          carries nothing, which is the mildest possible state a client can be
          in — the shared note's italic is what marks the line as the app
          speaking about an absence rather than as a delta that lost its text.
        */}
        {client.overrides.length === 0 ? (
          <div className="mt-5">
            <EmptyNote>
              No deltas. This client takes the baseline exactly as written.
            </EmptyNote>
          </div>
        ) : (
          <ul className="mt-5 flex flex-col gap-4">
            {client.overrides.map((o) => (
              <li key={o.id} data-testid={`override-${o.id}`} className="flex flex-col gap-2">
                {/*
                  TWO LINES, BECAUSE THE ROW CARRIES MORE THAN THE EXPORT'S DOES.
                  The design draws one flex row — chip, description, note,
                  Remove — and this row adds the line id and the authoring
                  signature, which the config layer owes for the same reason a
                  field owes provenance. As one wrapping row at the 880px
                  measure the note pushed Remove onto a line of its own, where a
                  destructive control sits under a sentence with nothing saying
                  which delta it removes. WHAT the delta is stays on the first
                  line with its control; WHO decided it and WHY drops to the
                  second.
                */}
                <div className="flex flex-wrap items-baseline gap-5">
                  <Chip tone={TONE[o.type]} size="micro" bordered>{o.type}</Chip>
                  {o.line_id === null ? null : (
                    <span className="font-mono text-tiny text-ink-muted">{o.line_id}</span>
                  )}
                  <span className="min-w-0 flex-1 text-base font-medium text-ink-primary">
                    {o.description}
                  </span>
                  {canAuthor ? (
                    /* CONTRACT GAP: removing an override publishes a config version; no endpoint. */
                    <Button
                      size="sm"
                      fill="outlined"
                      tone="neutral"
                      className="shrink-0 text-state-halt-ink"
                      disabled
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs leading-close text-ink-muted">
                  — {o.note} · {o.authored_by}, {o.authored_at}
                </p>
              </li>
            ))}
          </ul>
        )}

        {canAuthor ? <AuthorOverride productName={productName} lines={lines} /> : null}
      </CardBody>
    </Card>
  );
}
