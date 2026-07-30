import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * "What I can do" — the server's projection, rendered verbatim.
 *
 * The list arrives already scoped to the caller: a reviewer's payload does not
 * mention escalations or the rulebook at all. Other roles' capabilities are
 * UNREPRESENTED here, not hidden — which is why this component has no filter
 * and no notion of "roles above mine". It prints what came back.
 *
 * CONTRACT GAP: the design writes each capability as a sentence a person can
 * read ("Escalate a decision to senior review"), four of them, in a card about
 * 130px tall. The wire carries action identifiers, so this card renders 39 of
 * them in mono and runs past 900px — the single largest divergence on the
 * screen. Rendering the identifiers is still the honest option: inventing the
 * prose here would put a second, drifting copy of the authz vocabulary in the
 * browser, which is the exact failure the projection exists to prevent. The fix
 * is a `label` on each row of `PERMISSIONS` in `packages/contract/src/authz.ts`,
 * carried through `rulesFor` — after which this list is sentences and the
 * `font-mono` goes.
 *
 * RECORDED, NOT FIXED HERE: the same projection still serves ten doors into
 * screens the 2026-07-29 revision deleted (`screen.dashboard.enter`,
 * `screen.golden.enter`, `screen.bench.enter` and seven more), none of which
 * has a route. `doorsFor` already filters them out of the sidebar, so this card
 * is the only surface still promising capabilities nobody can exercise. Both
 * belong to the contract table, not to this component — pruning the list here
 * would mean the profile and the authz projection disagreeing about what a role
 * may do, which is worse than printing a door that leads nowhere.
 */
export function CapabilityCard({
  actions,
  state,
}: {
  actions: readonly string[];
  state: "ready" | "loading" | "failed";
}) {
  return (
    <Card>
      <CardBody>
        <Eyebrow variant="section" as="h2">What I can do</Eyebrow>
        {state === "failed" ? (
          <p className="mt-5 text-base text-state-halt-ink">
            Your permissions could not be loaded, so nothing is claimed here.
          </p>
        ) : state === "loading" ? (
          <p className="mt-5 text-base text-ink-secondary">Loading…</p>
        ) : (
          <ul className="mt-5 flex flex-col gap-4">
            {actions.map((action) => (
              <li key={action} className="flex items-start gap-4 text-base leading-body text-ink-secondary">
                <span aria-hidden="true" className="shrink-0 text-action">•</span>
                <span className="font-mono">{action}</span>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
