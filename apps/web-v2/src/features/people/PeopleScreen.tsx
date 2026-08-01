import { useQuery } from "@tanstack/react-query";
import { Card } from "../../shared/ui/Card";
import { Button } from "../../shared/ui/Button";
import { DividedSection } from "../../shared/ui/ListRow";
import { Screen } from "../../shared/ui/Screen";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";
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
        <ScreenHeading
          eyebrow="Admin · People"
          /*
            THE EMPHASIS IS THE BOUNDARY, not the noun. `ScreenHeading` paints a
            descendant `<em>` in the display face, and the phrase worth painting
            here is the closing one: this register is complete for this
            organisation and stops at its edge, which is the difference between
            an authorisation list you can trust and a directory you cannot.
          */
          title={<>Everyone <em>in this organisation</em></>}
          lede={
            <p>
              This screen changes authorisation, never credentials. Invitations
              and passwords hand off to the identity provider.
            </p>
          }
          /* CONTRACT GAP: no invite endpoint. Drawn as designed and disabled —
             the invitation itself is the provider's to send. The reason rides
             on the control rather than living only here: a dead primary with
             nothing saying why reads as a broken screen, and the lede's claim
             that invitations "hand off to the identity provider" is the general
             statement, not this button's. */
          actions={
            <Button
              size="lg"
              disabled
              title="No invite endpoint — the invitation is the identity provider's to send."
            >
              ＋ Invite person
            </Button>
          }
        />

        {isError ? (
          <p className="text-base text-state-halt-ink">The roster is unavailable.</p>
        ) : isPending ? (
          <p className="text-base text-ink-secondary">Loading the roster…</p>
        ) : (
          <>
            <MfaGateBanner count={data.privileged_without_mfa} />
            {/*
              The roster is the only child of the card, so the first-row
              exemption is safe to name here: a banner rendered beside these
              rows would otherwise inherit it and open the list with a hairline
              hanging off nothing.
            */}
            <Card>
              <DividedSection>
                {data.people.map((person) => (
                  <PersonRow key={person.id} person={person} />
                ))}
              </DividedSection>
            </Card>
            {/*
              THE FOOTNOTE BELONGS TO THE ROSTER, so it renders only when the
              roster does. Outside this branch it survived both the pending and
              the failed states, and "Role changes and suspensions take effect on
              the person's next request" printed under "The roster is
              unavailable." — copy about controls that are not on screen, sitting
              directly beneath the sentence saying nothing loaded.
            */}
            <p className="text-xs text-ink-muted">
              Role changes and suspensions take effect on the person&apos;s next request.
            </p>
          </>
        )}
      </div>
    </Screen>
  );
}
