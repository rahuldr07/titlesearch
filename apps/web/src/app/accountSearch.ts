/**
 * The account screen's search string — one key. `?tab=` names which settings
 * pane is open, in the URL so it can be linked and reloaded. A misspelt tab
 * does not compile at the call site and does not survive the URL either: an
 * unrecognised value is dropped, leaving the key absent, which the screen
 * handles as "open the first pane". Deliberately absent: filter, sort,
 * query, page — the rulebook pane's filter stays in the component, because a
 * bookmarked rulebook filter is a second rulebook.
 */
export const ACCOUNT_TAB_IDS = [
  "people",
  "access",
  "rules",
  "org",
  "security",
  "audit",
] as const;

export type AccountTabId = (typeof ACCOUNT_TAB_IDS)[number];

export interface AccountSearch {
  tab?: AccountTabId;
}

function isTabId(value: unknown): value is AccountTabId {
  return ACCOUNT_TAB_IDS.some((id) => id === value);
}

export function accountSearch(search: Record<string, unknown>): AccountSearch {
  const tab = search["tab"];
  return isTabId(tab) ? { tab } : {};
}
