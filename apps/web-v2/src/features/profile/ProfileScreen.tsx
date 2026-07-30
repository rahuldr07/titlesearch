import { useQuery } from "@tanstack/react-query";
import { myPermissionsQuery, myProfileQuery } from "./queries";
import { useSession } from "../../shared/session";
import { IdentityCard } from "./IdentityCard";
import { CapabilityCard } from "./CapabilityCard";
import { SecurityCard } from "./SecurityCard";
import { PreferencesCard } from "./PreferencesCard";
import { Screen } from "../../shared/ui/Screen";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";

/**
 * YOUR PROFILE — four cards, in descending order of how little you control.
 *
 * Identity is the provider's and cannot be edited here. Capabilities are the
 * server's and cannot be edited anywhere in this tool. Security offers one
 * coarse action. Only the last card takes input, and only over how things are
 * drawn. The order is the argument: by the time a person reaches a control on
 * this screen they have already read three cards explaining what is not theirs
 * to change, which is why nobody comes here expecting to grant themselves a
 * door.
 *
 * TWO QUERIES, NOT ONE, and neither substitutes for the other: the profile says
 * who you are, the permissions projection says what you may do. A partial
 * failure degrades only its own region — losing your identity must not blank
 * the list of what you are allowed to do, and losing the projection must not
 * take your account off the screen.
 *
 * Nothing on this screen counts anything a person did. No orders reviewed, no
 * corrections made, no streak, no pace — a profile that scores you turns every
 * subsequent judgement into a performance, which is the failure mode this
 * product is built to avoid.
 */
export function ProfileScreen() {
  const role = useSession((s) => s.role);
  const permissions = useQuery(myPermissionsQuery(role));
  const profile = useQuery(myProfileQuery);

  const actions = permissions.data?.rules.map((granted) => granted.action) ?? [];
  const state = permissions.isError ? "failed" : permissions.isPending ? "loading" : "ready";

  return (
    <Screen measure="720">
      {/*
        THE MASTHEAD IS NOT ONE OF THE CARDS. Sharing the stack's 14px gap set
        the title the same distance from the first card as the cards are from
        each other, so "Your profile" read as a label on the identity card
        rather than as the screen's title. The export draws 18px there and 14px
        between cards; two values, so two elements.
      */}
      <ScreenHeading eyebrow="Account" title="Your profile" />
      <div className="mt-9 flex flex-col gap-7">
        {profile.isError ? (
          <p className="text-base text-state-halt-ink">Your profile is unavailable.</p>
        ) : profile.isPending ? (
          <p className="text-base text-ink-secondary">Loading your profile…</p>
        ) : (
          <IdentityCard name={profile.data.name} email={profile.data.email} role={profile.data.role} />
        )}

        <CapabilityCard actions={actions} state={state} />

        {profile.isSuccess ? (
          <SecurityCard sessions={profile.data.sessions} mfa={profile.data.mfa} />
        ) : null}

        <PreferencesCard />
      </div>
    </Screen>
  );
}
