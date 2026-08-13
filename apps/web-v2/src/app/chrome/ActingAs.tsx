import { ROLES, type Role } from "@titlepipe/contract";
import { cn } from "../../shared/ui/classNames";

/**
 * "ACTING AS" — a PREVIEW CONTROL, and the only thing in the chrome that has to
 * argue for its own existence.
 *
 * IT CHANGES WHAT THIS CLIENT DRAWS AND NOTHING ELSE (conflict C12). The server
 * enforces authorisation independently and refuses the data regardless of what
 * is selected here, so this cannot grant anybody anything — it previews which
 * gates a role meets. That distinction is the whole reason the note sits inside
 * the control rather than in a doc: a role switcher with no such sentence beside
 * it reads as permission, and reads that way to exactly the person who should
 * not believe it.
 *
 * IT MUST NOT SURVIVE CUTOVER TO THE REAL API. Its own file partly so that
 * deleting it is one deletion and one import, not surgery on a panel.
 *
 * ITS OWN FILE ALSO BECAUSE IT IS LOAD-BEARING FOR THE TEST SUITE. `role-*` is
 * how `authz.spec` and `sidebar.spec` prove the release-blocking rule that doors
 * outside a role's world are ABSENT rather than dimmed. That is a rule about the
 * product, checked through this control — so the control is not a convenience
 * and should not be buried in a component about layout.
 *
 * `aria-pressed` RATHER THAN A RADIO GROUP: these are toggles onto a preview
 * state, not a form field anybody submits, and nothing here is written to the
 * server. A radio group would announce a selection that is about to be sent.
 */
export function ActingAs({
  role,
  onActAs,
}: {
  role: Role;
  onActAs: (role: Role) => void;
}) {
  return (
    <>
      <p className="mb-4 rounded-3 border border-state-attend-border bg-state-attend-surface px-4 py-3 text-micro leading-body text-state-attend-ink">
        Preview control — not in production. The server enforces authorization
        independently; this only previews the gates.
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {ROLES.map((candidate: Role) => (
          <button
            key={candidate}
            type="button"
            aria-pressed={candidate === role}
            data-testid={`role-${candidate}`}
            onClick={() => onActAs(candidate)}
            className={cn(
              "rounded-3 border px-3 py-2 text-micro font-semibold",
              candidate === role
                ? "border-action bg-action-surface text-action-ink"
                : "border-line-subtle text-ink-secondary hover:border-line-strong",
            )}
          >
            {candidate}
          </button>
        ))}
      </div>
    </>
  );
}
