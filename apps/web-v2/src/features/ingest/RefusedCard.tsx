import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * The order fields, in the words a person uses for them. The KEYS come from the
 * server — this map only translates, and an unknown key renders as itself
 * rather than being dropped: a missing field the screen cannot name is still a
 * missing field, and silently omitting it would be the one failure mode §4.3
 * exists to prevent.
 */
const FIELD_LABEL: Record<string, string> = {
  client_id: "CLIENT",
  external_ref: "ORDER #",
  jurisdiction: "JURISDICTION",
  state: "STATE",
  county: "COUNTY",
  package: "THE PACKAGE ITSELF",
};

/**
 * THE SERVER'S REFUSAL, RENDERED VERBATIM (`ingest.spec` #1).
 *
 * The client does not author the list of what is missing and does not
 * pre-validate its way around the round trip. Two lists of required fields —
 * one here, one at the door — is two definitions of a complete order, and they
 * drift the first time a jurisdiction gets added.
 */
export function RefusedCard({
  missing,
  reason,
}: {
  missing: readonly string[];
  reason: string;
}) {
  return (
    <Card data-testid="refused-card" accent="halt">
      <CardHeader filled>
        <Eyebrow variant="section">Refused at the door</Eyebrow>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <p className="max-w-2xl text-base leading-body text-ink-secondary">{reason}</p>
        <ul className="flex flex-wrap gap-3">
          {missing.map((key) => (
            <li
              key={key}
              data-testid="missing-field"
              className="rounded-3 border border-state-halt-border bg-state-halt-surface px-4 py-1 font-mono text-micro tracking-badge font-bold text-state-halt-ink"
            >
              {FIELD_LABEL[key] ?? key}
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}
