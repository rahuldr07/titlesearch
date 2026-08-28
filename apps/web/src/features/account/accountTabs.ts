import type { AccountTabId } from "../../app/accountSearch";

/**
 * THE SIX PANES, AND WHAT EACH ONE CAN ACTUALLY READ.
 *
 * The labels and the order are the prototype's `setTabs` array, verbatim —
 * People / Access (RBAC) / Rules & Routing / Organization / Retention &
 * security / Audit log. A table rather than six `if`s because the sidebar, the
 * URL union and the panel switch all need the same list, and rule 11's "one
 * variable, never two literals" is exactly what three copies of a tab list
 * breaks.
 *
 * `backing` is not decoration. Four of these panes bind to an endpoint that
 * exists and two do not, and which is which is the single most useful thing to
 * know when opening this screen. It is printed in the sidebar so the shape of
 * the gap is visible before you click, rather than after.
 *
 * ══ THE TWO WITHOUT BACKING ════════════════════════════════════════════════
 *
 * `org` and `security` are drawn by the prototype and have no contract surface
 * at all: there is no organisation entity, and no retention policy, schedule or
 * period anywhere in `packages/contract`. They render `ContractGap` rather than
 * a plausible form, because a settings form that looks saveable and is not is
 * worse than an absent one — AGENTS.md forbids emitting what cannot be cited,
 * and a retention period is the last field in this product anybody should be
 * guessing at.
 *
 * `security` is the one pane that is PART real: `MeProfileResponse` carries
 * `mfa` and the session list, which is genuinely the security half of it. So it
 * draws what it has and names what it does not, rather than being all gap.
 */
export interface AccountTab {
  readonly id: AccountTabId;
  /** The prototype's own word for the pane. */
  readonly label: string;
  /** The endpoint the pane reads, or null where none exists. */
  readonly backing: string | null;
}

export const ACCOUNT_TABS: readonly AccountTab[] = [
  { id: "people", label: "People", backing: "/api/people" },
  { id: "access", label: "Access (RBAC)", backing: "/api/me/permissions" },
  { id: "rules", label: "Rules & routing", backing: "/api/rules" },
  { id: "org", label: "Organization", backing: null },
  { id: "security", label: "Retention & security", backing: "/api/me/profile" },
  { id: "audit", label: "Audit log", backing: "/api/audit" },
];

export const DEFAULT_ACCOUNT_TAB: AccountTabId = "people";
