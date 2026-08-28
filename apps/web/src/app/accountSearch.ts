/**
 * THE ACCOUNT SCREEN'S SEARCH STRING, AND IT HAS EXACTLY ONE KEY.
 *
 * `?tab=` names which of the design's six settings panes is open. It is in the
 * URL rather than in component state for the reason `orderSearch.ts` gives for
 * `page`: "selection held in component state is selection nobody can link to,
 * reload into, or send to a colleague." A settings pane is the most linked-to
 * thing in any admin surface — "your MFA is here" is a URL or it is a
 * paragraph of directions.
 *
 * `AccountTabId` is the union the panes are keyed by, so a misspelt tab does
 * not compile at the call site and does not survive the URL either: an
 * unrecognised value is DROPPED rather than passed through, which leaves the
 * key absent, and absent is the state the screen already handles as "open the
 * first pane".
 *
 * WHAT IS DELIBERATELY ABSENT: no filter, no sort, no query, no page. The
 * rulebook pane filters its own list in the browser and that filter stays in
 * the component, because a URL that can express a saved search is a URL
 * somebody bookmarks, and a bookmarked rulebook filter is a second rulebook.
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
