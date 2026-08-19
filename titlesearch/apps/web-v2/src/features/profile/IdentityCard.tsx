import { Card, CardBody } from "../../shared/ui/Card";

/**
 * Who you are, stated once, at the top.
 *
 * THE WHOLE CARD IS READ-ONLY, and the last line says why in the design's own
 * words: "from identity provider". This screen changes nothing about identity —
 * name, email and role are the provider's record, and offering an edit field
 * here would promise a write this product does not own. The absence of a single
 * input is the point of the card.
 *
 * All three come from the profile payload rather than the permissions one. The
 * permissions projection answers what you may do and is not entitled to say who
 * you are; a screen that read a name off an authorisation response would be
 * trusting the wrong document.
 *
 * CONTRACT GAP: the profile carries no organisation, so the design's third
 * identity line names only the source of the record.
 */
export function IdentityCard({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: string;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-8">
        <span
          aria-hidden="true"
          className="flex size-26 shrink-0 items-center justify-center rounded-full bg-action font-mono text-2xl font-semibold text-ink-on-action"
        >
          {initialsOf(name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-semibold text-ink-primary">{name}</p>
          <p className="mt-1 font-mono text-sm text-ink-secondary">{email}</p>
          <p className="mt-2 text-xs text-ink-muted">{role} · from identity provider</p>
        </div>
      </CardBody>
    </Card>
  );
}

/** Two initials for the avatar disc — a display detail, never an identifier. */
function initialsOf(name: string): string {
  const parts = name
    .split(/[\s.]+/)
    .filter((part) => /^\p{L}/u.test(part))
    .slice(-2);
  return parts.map((part) => part.slice(0, 1).toUpperCase()).join("");
}
