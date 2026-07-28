import { useQuery } from "@tanstack/react-query";
import { myPermissionsQuery } from "./queries";
import { useSession } from "../../shared/session";
import { IdentityCard } from "./IdentityCard";
import { CapabilityCard } from "./CapabilityCard";
import { SecurityCard } from "./SecurityCard";
import { PreferencesCard } from "./PreferencesCard";
import { ScreenTitle } from "../../app/ScreenTitle";

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
 * Nothing on this screen counts anything a person did. No orders reviewed, no
 * corrections made, no streak, no pace — a profile that scores you turns every
 * subsequent judgement into a performance, which is the failure mode this
 * product is built to avoid.
 */
export function ProfileScreen() {
  const role = useSession((s) => s.role);
  const { data, isPending, isError } = useQuery(myPermissionsQuery(role));

  const actions = data?.rules.map((granted) => granted.action) ?? [];
  const state = isError ? "failed" : isPending ? "loading" : "ready";

  return (
    <div className="flex flex-col gap-7">
      <header className="flex flex-col gap-3">
        <ScreenTitle>Account</ScreenTitle>
        <h1 className="text-3xl font-semibold text-ink-primary">Your profile</h1>
      </header>

      <IdentityCard role={data?.role ?? null} />
      <CapabilityCard actions={actions} state={state} />
      <SecurityCard />
      <PreferencesCard />
    </div>
  );
}
