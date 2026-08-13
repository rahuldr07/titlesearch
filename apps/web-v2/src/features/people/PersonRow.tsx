import type { MfaState, Person } from "@titlepipe/contract";
import { Chip } from "../../shared/ui/Chip";
import { Button } from "../../shared/ui/Button";
import { ListRow } from "../../shared/ui/ListRow";
import { cn } from "../../shared/ui/classNames";

/** The design's three account states, mapped to the kit's tones. */
const STATUS_TONE = {
  Active: "settled",
  Suspended: "halt",
  Invited: "neutral",
} as const;

/** The MFA column's text, per state. Presentation only. */
const MFA_LABEL: Record<MfaState, string> = {
  enrolled: "MFA ✓",
  pending: "MFA pending",
  absent: "MFA ✗",
};

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
 *
 * CONTRACT GAP: the roster carries no per-account gate flag, only `privileged`
 * and `mfa`. The design stamped a "Gate" mark on the rows the banner counts;
 * re-deriving it here from `privileged && mfa !== "enrolled"` would put a second
 * copy of the gate predicate in the browser, free to disagree with the server's
 * own figure. The mark is left off and the banner keeps the count.
 *
 * CONTRACT GAP: no role-change and no suspend endpoint. Both are drawn as the
 * design draws them and disabled; the footnote below the roster already carries
 * the copy about when a change would take effect.
 */
export function PersonRow({ person }: { person: Person }) {
  const mfaTone =
    person.mfa === "enrolled"
      ? "text-state-settled"
      : person.privileged
        ? "text-state-halt-ink"
        : "text-ink-muted";

  return (
    <ListRow className="flex flex-wrap items-center gap-7">
      <div className="min-w-100 flex-1">
        <p className="text-md font-semibold text-ink-primary">{person.name}</p>
        <p className="mt-1 font-mono text-xs text-ink-muted">{person.email}</p>
      </div>

      <p className="min-w-60 text-sm text-ink-secondary">{person.role}</p>

      <Chip tone={STATUS_TONE[person.status]} size="sm" shape="tag">
        {person.status}
      </Chip>

      <p
        className={cn(
          "min-w-37 text-center text-tiny font-bold tracking-badge uppercase",
          mfaTone,
        )}
      >
        {MFA_LABEL[person.mfa]}
      </p>

      <div className="flex gap-3">
        <Button size="sm" fill="outlined" tone="neutral" disabled>
          Change role
        </Button>
        <Button
          size="sm"
          fill="outlined"
          tone="neutral"
          className="text-state-halt-ink"
          disabled
        >
          Suspend
        </Button>
      </div>
    </ListRow>
  );
}
