import { Button } from "../../shared/ui/Button";
import { Card, CardBody } from "../../shared/ui/Card";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";

import { AuthorOverride } from "./AuthorOverride";
import type { ClientRecord, OverrideType } from "./registry";

/**
 * The delta list — "holds these deltas only" is the heading, and it is a
 * statement about storage, not a filter on a longer list.
 *
 * A waive is toned HALT and everything else action, because the three others
 * change how a line is answered while a waive removes the obligation. That is
 * the difference worth seeing from across the room when you are scanning a
 * client for what it has excused itself from.
 */
const TONE: Readonly<Record<OverrideType, "halt" | "action">> = {
  waive: "halt", narrow: "action", replace: "action", add: "action",
};

export function OverridesPanel({
  client,
  productName,
  canAuthor,
}: {
  client: ClientRecord;
  productName: string;
  canAuthor: boolean;
}) {
  return (
    <Card>
      <CardBody>
        <Eyebrow variant="section" as="h2">
          Sign-off overrides · {client.name} holds these deltas only
        </Eyebrow>

        {client.overrides.length === 0 ? (
          <p className="mt-5 text-xs leading-body text-ink-muted">
            No deltas. This client takes the baseline exactly as written.
          </p>
        ) : (
          <ul className="mt-5 flex flex-col gap-4">
            {client.overrides.map((o) => (
              <li
                key={o.id}
                data-testid={`override-${o.id}`}
                className="flex flex-wrap items-baseline gap-5"
              >
                <Chip tone={TONE[o.type]} size="micro" bordered>{o.type}</Chip>
                <span className="text-base font-medium text-ink-primary">{o.desc}</span>
                <span className="flex-1 text-xs leading-close text-ink-muted">
                  — {o.note}
                </span>
                {canAuthor ? (
                  /* CONTRACT GAP: removing an override publishes a config version; no endpoint. */
                  <Button
                    size="sm"
                    fill="outlined"
                    tone="neutral"
                    className="text-state-halt-ink"
                    disabled
                  >
                    Remove
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {canAuthor ? <AuthorOverride productName={productName} /> : null}
      </CardBody>
    </Card>
  );
}
