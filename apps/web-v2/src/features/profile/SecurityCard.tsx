import type { MfaState, SessionRecord } from "@titlepipe/contract";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Chip } from "../../shared/ui/Chip";
import { Button } from "../../shared/ui/Button";
import { cn } from "../../shared/ui/classNames";

/**
 * Devices, and the one blunt instrument for when one of them is not yours.
 *
 * The card offers exactly ONE security action, and it is the coarsest one:
 * sign out everywhere. There is no per-session revoke, because a person who
 * suspects a stolen session cannot reliably tell which row is the thief — a
 * chooser here would invite them to revoke the wrong one and believe they were
 * safe. Coarse and certain beats precise and wrong.
 *
 * MFA is REPORTED, not managed. Enrolment lives with the identity provider, so
 * the state arrives on the profile and this screen states it — authorisation is
 * ours, credentials are theirs.
 *
 * `last_seen` is server text and renders verbatim. Nothing here counts up.
 */
const MFA_TEXT: Record<MfaState, string> = {
  enrolled: "MFA enrolled · ",
  pending: "MFA enrolment pending · ",
  absent: "MFA not enrolled · ",
};

export function SecurityCard({
  sessions,
  mfa,
}: {
  sessions: readonly SessionRecord[];
  mfa: MfaState;
}) {
  return (
    <Card>
      <CardBody>
        <Eyebrow variant="section" as="h2">Security</Eyebrow>
        <ul className="mt-5">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center gap-6 border-b border-line-subtle py-4">
              <div className="min-w-0 flex-1">
                <p className="text-base text-ink-primary">{session.device}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  {session.where} · {session.last_seen}
                </p>
              </div>
              {session.current ? <Chip tone="settled" size="sm">This device</Chip> : null}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-5">
          {/* CONTRACT GAP: no session-revocation endpoint. Drawn as the design
              draws it and disabled until one exists. */}
          <Button size="md" fill="outlined" tone="neutral" disabled>Sign out everywhere</Button>
          <p className="flex items-center gap-3 text-sm text-ink-secondary">
            <span
              aria-hidden="true"
              className={cn(
                "size-4 rounded-full",
                mfa === "enrolled" ? "bg-state-settled" : "bg-state-halt",
              )}
            />
            {MFA_TEXT[mfa]}
            {/* CONTRACT GAP: the provider's management URL is not in the
                contract, so this is not yet a link to anywhere. */}
            <span className="font-semibold">manage at provider ↗</span>
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
