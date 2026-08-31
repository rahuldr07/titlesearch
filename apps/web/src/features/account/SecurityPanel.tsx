import { useRead } from "../../app/useRead";
import { meProfile } from "../../shared/accountQueries";
import { Badge, Card } from "../../components/ui";
import { ContractGap } from "../../entities/contract/ContractGap";
import { PanelFrame } from "./AccountPanel";
import { QueryState } from "../../entities/state/QueryState";

/**
 * Retention & security — half of this pane is real and half does not
 * exist, and the split is worth naming rather than blending. Security reads
 * `MeProfileResponse`; the retention half has never been specified.
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
                  {/* An address is an identifier, so it is mono. */}
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
                  Reported by the identity provider. No endpoint revokes one, so no row
                  offers to.
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
                       * The server's string, passed through untouched — a
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
                  Nothing. No retention policy, schedule, period or purge shape exists
                  in <code className="font-mono text-label">packages/contract</code>,
                  and no endpoint names one. The security half of this pane above is
                  real; the retention half has never been specified.
                </>
              }
              needs={
                <>
                  A retention shape and the door that may write it. It is the last field
                  in this product anybody should be guessing at — a form that looked
                  saveable and was not would let somebody believe a policy had been set.
                </>
              }
            />
          </div>
        )}
      </QueryState>
    </PanelFrame>
  );
}
