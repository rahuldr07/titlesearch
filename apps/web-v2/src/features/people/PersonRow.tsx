import { Chip } from "../../shared/ui/Chip";
import { Button } from "../../shared/ui/Button";
import { cn } from "../../shared/ui/classNames";
import { MFA_LABEL, type Person } from "./roster";

/** The design's three account states, mapped to the kit's tones. */
const STATUS_TONE = {
  Active: "settled",
  Suspended: "halt",
  Invited: "neutral",
} as const;

/**
 * One person, one row, and only two things you may do to them.
 *
 * CHANGE ROLE and SUSPEND are the whole vocabulary. There is no "reset
 * password", no "resend invitation", no "edit email" — this screen changes
 * AUTHORISATION and never credentials, and every control it does not draw is a
 * hand-off to the identity provider rather than an omission.
 *
 * The MFA column is a report, not a control: an admin cannot enrol someone
 * else's second factor, so the column states the fact and offers no button.
 * When the account is privileged and unenrolled the row also carries the gate
 * mark — the same fact the banner counts, shown where it applies.
 *
 * CONTRACT GAP: no role-change and no suspend endpoint. Both are drawn as the
 * design draws them and neither is wired; the footnote below the roster already
 * carries the copy about when a change would take effect.
 */
export function PersonRow({ person }: { person: Person }) {
  const mfaTone =
    person.mfa === "enrolled"
      ? "text-state-settled"
      : person.privileged
        ? "text-state-halt-ink"
        : "text-ink-muted";

  return (
    <li className="flex flex-wrap items-center gap-7 border-t border-line-subtle px-8 py-6 first:border-t-0">
      <div className="min-w-100 flex-1">
        <p className="text-md font-semibold text-ink-primary">{person.name}</p>
        <p className="mt-1 font-mono text-xs text-ink-muted">{person.email}</p>
      </div>

      <p className="min-w-60 text-sm text-ink-secondary">{person.role}</p>

      <Chip tone={STATUS_TONE[person.status]} size="sm" shape="tag">
        {person.status}
      </Chip>

      <p className={cn("min-w-37 text-center text-tiny font-bold tracking-badge uppercase", mfaTone)}>
        {MFA_LABEL[person.mfa]}
      </p>

      {person.gated ? (
        <Chip tone="halt" size="micro" bordered>Gate</Chip>
      ) : null}

      <div className="flex gap-3">
        <Button size="sm" fill="outlined" tone="neutral">Change role</Button>
        <Button size="sm" fill="outlined" tone="neutral" className="text-state-halt-ink">
          Suspend
        </Button>
      </div>
    </li>
  );
}
