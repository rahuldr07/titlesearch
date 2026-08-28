import { useRead } from "../../app/useRead";
import { meProfile } from "../../shared/accountQueries";
import { Badge, Card } from "../../components/ui";
import { ContractGap } from "../../entities/contract/ContractGap";
import { PanelFrame } from "./AccountPanel";
import { QueryState } from "../../entities/state/QueryState";

/**
 * RETENTION & SECURITY — half of this pane is real and half of it does not
 * exist, and the split is worth naming rather than blending.
 *
 * SECURITY is `MeProfileResponse` (`intake.ts:359`): who you are, whether a
 * second factor is enrolled, and the sessions holding your account open. All
 * three are served and all three are read-only here by construction —
 * `intake.ts:363` on `mfa`: "Held by the identity provider; reported here,
 * never set here."
 *
 * RETENTION has no contract surface at all. No policy, no schedule, no period,
 * no purge — nothing in `packages/contract` names one. It is drawn as a gap
 * rather than a form, because a retention period is the single worst field in
 * this product to guess at: a form that looks saveable and is not would let
 * somebody believe they had set one.
 *
 * ══ IDENTITY IS NOT AUTHORISATION ══════════════════════════════════════════
 *
 * This pane reads `/api/me/profile` and the access pane reads
 * `/api/me/permissions`, and they are deliberately different endpoints.
 * `intake.ts:352-356`: "Identity and authorisation are different questions and
 * conflating them is how a screen ends up trusting a name it got from a
 * permissions payload."
 *
 * ══ THERE IS NO SIGN-OUT-THIS-SESSION BUTTON ═══════════════════════════════
 *
 * `SessionRecord` (`intake.ts:344`) is a read shape and no endpoint revokes
 * one. The row that says `current: true` is marked as this session so the list
 * is legible, and no row offers an action, because none exists to offer. A
 * revoke button that did nothing would be worse than the list alone.
 */
export function SecurityPanel() {
  const profile = useRead(meProfile);

  return (
    <PanelFrame
      title="Retention & security"
      note="Your second factor and the sessions holding this account open."
    >
      <QueryState query={profile} of="your profile">
        {(data) => (
          <div className="flex flex-col gap-8">
            <Card padding="tight">
              <div className="flex flex-wrap items-center justify-between gap-8">
                <div className="flex flex-col gap-2">
                  <span className="text-meta font-semibold leading-close text-ink-primary">
                    {data.name}
                  </span>
                  {/* Rule 3: an address is an identifier. */}
                  <span className="font-mono text-label leading-flat text-ink-muted">
                    {data.email}
                  </span>
                </div>
                {data.mfa === "enrolled" ? (
                  <Badge tone="settled">Second factor enrolled</Badge>
                ) : data.mfa === "pending" ? (
                  <Badge tone="attend">Second factor pending</Badge>
                ) : (
                  <Badge tone="halt">No second factor</Badge>
                )}
              </div>
            </Card>

            <Card padding="none">
              <div className="flex flex-col gap-2 border-b border-line-subtle bg-surface-sunken px-12 py-6">
                <span className="text-label font-semibold leading-flat text-ink-faint">
                  Sessions
                </span>
                <span className="text-label leading-close text-ink-muted">
                  Reported by the identity provider. No endpoint revokes one, so
                  no row offers to.
                </span>
              </div>
              <ul>
                {data.sessions.map((session) => (
                  <li
                    key={session.id}
                    className="flex flex-wrap items-baseline justify-between gap-6 border-b border-line-subtle px-12 py-8 last:border-b-0"
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-meta leading-close text-ink-primary">
                        {session.device}
                      </span>
                      <span className="text-label leading-flat text-ink-faint">
                        {session.where}
                      </span>
                    </div>
                    <div className="flex items-center gap-6">
                      {session.current && <Badge tone="accent">This session</Badge>}
                      {/*
                       * The server's string, passed through untouched. §8: a
                       * date the server sent is not parsed, normalised or
                       * re-rendered in a locale.
                       */}
                      <span className="font-mono text-label leading-flat text-ink-muted">
                        {session.last_seen}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            <ContractGap
              drawn="Retention policy — how long packages, extractions and delivered reports are kept, and the purge schedule (design §Settings, Retention & security pane)"
              has={
                <>
                  Nothing. No retention policy, schedule, period or purge shape
                  exists in{" "}
                  <code className="font-mono text-label">packages/contract</code>
                  , and no endpoint names one. The security half of this pane
                  above is real; the retention half has never been specified.
                </>
              }
              needs={
                <>
                  A retention shape and the door that may write it. It is the
                  last field in this product anybody should be guessing at — a
                  form that looked saveable and was not would let somebody
                  believe a policy had been set.
                </>
              }
            />
          </div>
        )}
      </QueryState>
    </PanelFrame>
  );
}
