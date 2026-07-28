import { Card, CardBody } from "../../shared/ui/Card";
import { DEMO_IDENTITY, initialsOf } from "./demoAccount";

/**
 * Who you are, stated once, at the top.
 *
 * THE WHOLE CARD IS READ-ONLY, and the last line says why in the design's own
 * words: "from identity provider". This screen changes nothing about identity —
 * name, email and organisation are the provider's record, and offering an edit
 * field here would promise a write this product does not own. The absence of a
 * single input is the point of the card.
 *
 * The role is printed from the server's own answer rather than a local label
 * table, so it cannot disagree with what the permissions payload grants.
 */
export function IdentityCard({ role }: { role: string | null }) {
  return (
    <Card>
      <CardBody className="flex items-center gap-8">
        <span
          aria-hidden="true"
          className="flex size-26 shrink-0 items-center justify-center rounded-full bg-action font-mono text-2xl font-semibold text-ink-on-action"
        >
          {initialsOf(DEMO_IDENTITY.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold text-ink-primary">{DEMO_IDENTITY.name}</p>
          <p className="mt-1 font-mono text-sm text-ink-secondary">{DEMO_IDENTITY.email}</p>
          <p className="mt-2 text-xs text-ink-muted">
            {DEMO_IDENTITY.org} · {role ?? "role not yet loaded"} · from identity provider
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
