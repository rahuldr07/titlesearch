import type { AccountTabId } from "../../app/accountSearch";

/**
 * The six panes, and what each one can actually read. The labels and the
 * order are the design's.
 */
export interface AccountTab {
  readonly id: AccountTabId;
  /** The design's own word for the pane. */
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
