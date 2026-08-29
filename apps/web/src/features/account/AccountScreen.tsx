import { Link } from "@tanstack/react-router";
import type { AccountTabId } from "../../app/accountSearch";
import { ACCOUNT_TABS, DEFAULT_ACCOUNT_TAB } from "./accountTabs";
import { cx } from "../../components/ui";
import { AccountPanel } from "./AccountPanel";

/**

 * SCREEN 12 — SETTINGS & RBAC, at `/account` (`authz.ts:81`, `screen.account.enter`,

 * EVERY role). Every role keeps this door in the mock-auth phase, and `authz.ts:79-80`

 * says why in the table itself: "role switch must not lock you out".

 */
export function AccountScreen(props: { readonly tab: AccountTabId | undefined }) {
  const active = props.tab ?? DEFAULT_ACCOUNT_TAB;

  return (
    <div className="tp-screen-enter flex h-full min-h-0">
      {/*
       * The h1 sits OUTSIDE the nav landmark. The prototype draws the title in
       * the sidebar column and so does this, but a page title inside <nav> is a
       * page whose name a screen-reader user finds by browsing navigation. The
       * column is the layout; the nav is only the list inside it.
       */}
      <div className="flex w-120 shrink-0 flex-col border-r border-line-subtle bg-surface-panel">
        <div className="px-12 pt-12 pb-8">
          <h1 className="text-title font-semibold leading-tight text-ink-primary">
            Settings
          </h1>
        </div>
        <nav aria-label="Settings sections" className="min-h-0 flex-1">
          <ul className="flex flex-col gap-2 px-6 pb-10">
            {ACCOUNT_TABS.map((tab) => (
              <li key={tab.id}>
                <Link
                  to="/account"
                  search={{ tab: tab.id }}
                  aria-current={tab.id === active ? "page" : undefined}
                  className={cx(
                    "tp-state flex rounded-lg px-6 py-5 text-meta leading-close",
                    tab.id === active
                      ? "bg-action-surface font-semibold text-ink-secondary"
                      : "font-medium text-ink-muted hover:bg-row-hover",
                  )}
                >
                  {/*
                   * PLAIN TEXT, as the design draws it. An earlier pass put the
                   * backing endpoint under every label in mono — useful, and not
                   * what `reference-app.html` has: its tabs are one 13px w500
                   * line each. Which panes have no contract surface is said on
                   * the pane itself, where the gap actually is.
                   */}
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/*
       * `tabIndex={0}`: a region that scrolls must be reachable by keyboard, or
       * a reader who cannot use a pointer cannot reach the bottom of the pane
       * (WCAG 2.1.1, and axe's `scrollable-region-focusable`). It takes an
       * accessible name with it, because a bare tab stop announces nothing.
       */}
      <div
        tabIndex={0}
        role="region"
        aria-label="Settings content"
        className="tp-state flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-20 py-16"
      >
        <div className="w-full max-w-500">
          <AccountPanel tab={active} />
        </div>
      </div>
    </div>
  );
}
