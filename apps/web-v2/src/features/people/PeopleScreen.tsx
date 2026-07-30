import { useQuery } from "@tanstack/react-query";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { ScreenTitle } from "../../app/ScreenTitle";
import { Screen } from "../../shared/ui/Screen";
import { MfaGateBanner } from "./MfaGateBanner";
import { PersonRow } from "./PersonRow";
import { peopleQuery } from "./queries";

/**
 * ADMIN · PEOPLE — the whole roster, one row each, no pagination and no search.
 *
 * The list is short because a title shop is small, and showing all of it at
 * once is the point: an admin auditing who holds what needs to see the set, not
 * query it. A search box would let a gated account sit unnoticed behind a
 * filter, which is precisely what the banner above exists to prevent.
 *
 * THE SUBTITLE IS THE BOUNDARY OF THE SCREEN, not decoration. Authorisation is
 * ours; credentials are the identity provider's. Every control here changes the
 * first and none of them touches the second, and the copy says so before a
 * person starts looking for a password field that is deliberately absent.
 *
 * No per-person productivity anywhere — no orders reviewed, no correction rate,
 * no last-active ranking. Measuring people on this screen would turn an
 * authorisation register into a scoreboard.
 */
export function PeopleScreen() {
  const { data, isPending, isError } = useQuery(peopleQuery);

  return (
    <Screen measure="900">
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-end gap-8">
          <header className="min-w-120 flex-1 flex flex-col gap-3">
            <ScreenTitle>Admin · People</ScreenTitle>
            <h1 className="text-3xl font-semibold text-ink-primary">
              Everyone in this organisation
            </h1>
            <p className="max-w-3xl text-base leading-body text-ink-secondary">
              This screen changes authorisation, never credentials. Invitations
              and passwords hand off to the identity provider.
            </p>
          </header>
          {/* CONTRACT GAP: no invite endpoint. Drawn as designed and disabled —
              the invitation itself is the provider's to send. */}
          <Button size="lg" disabled>＋ Invite person</Button>
        </div>

        {isError ? (
          <p className="text-base text-state-halt-ink">The roster is unavailable.</p>
        ) : isPending ? (
          <p className="text-base text-ink-secondary">Loading the roster…</p>
        ) : (
          <>
            <MfaGateBanner count={data.privileged_without_mfa} />
            <Card>
              <ul>
                {data.people.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </ul>
            </Card>
          </>
        )}

        <p className="text-xs text-ink-muted">
          Role changes and suspensions take effect on the person&apos;s next request.
        </p>
      </div>
    </Screen>
  );
}
