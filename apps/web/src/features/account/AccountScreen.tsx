import { Link } from "@tanstack/react-router";
import type { AccountTabId } from "../../app/accountSearch";
import { ACCOUNT_TABS, DEFAULT_ACCOUNT_TAB } from "./accountTabs";
import { cx } from "../../components/ui";
import { AccountPanel } from "./AccountPanel";

/**
 * SCREEN 12 — SETTINGS & RBAC, at `/account` (`authz.ts:81`,
 * `screen.account.enter`, EVERY role).
 *
 * Every role keeps this door in the mock-auth phase, and `authz.ts:79-80` says
 * why in the table itself: "role switch must not lock you out". Clerk narrows
 * it at P1.
 *
 * ══ THE SHELL IS THE PROTOTYPE'S, MEASURED ═════════════════════════════════
 *
 * `reference-app.html`'s `isSettings` block:
 *
 *     240px white sidebar, 1px #EDEFF3 right rule, full height
 *       h1 "Settings" 28px, padding 24px 24px 16px
 *       tab buttons, radius 14, 13px w500, selected on #F7F6FC
 *     content pane: flex 1, own scroll, padding 32px 40px, max-width 1000px
 *
 * The whole screen is a two-pane split with the RIGHT pane scrolling, which is
 * the one arrangement INVARIANT 60 permits: the frame is rooted at
 * `height:100vh; overflow:hidden` and only a screen body scrolls. The sidebar
 * is a full-height column and does not scroll with the content.
 *
 * ══ THE TAB IS IN THE URL ══════════════════════════════════════════════════
 *
 * `?tab=` — see `app/accountSearch.ts`. `Link` rather than a button, so the
 * panes are real navigation: middle-click, copy-link and the back button all
 * work, and "your MFA is on this screen" is a URL rather than directions.
 *
 * ══ WHY THE PANE LIST IS NOT ROLE-FILTERED ═════════════════════════════════
 *
 * It might look as though INVARIANT 42/43 — "a role-locked affordance is
 * ABSENT, not disabled" — should hide panes here. It does not apply: the six
 * panes are not doors. `authz.ts` grants `/account` to EVERYONE as one door,
 * and what a role may SEE inside it is decided by what each endpoint returns.
 * `/api/me/permissions` is already this role's projection with other worlds
 * unrepresented rather than hidden (`permissions.ts:9-18`), and `/api/people`
 * is role-scoped on the server. Hiding a pane in the browser would be the
 * client running a second permission table, which is INVARIANT 41's whole
 * point. The server scopes the contents; the shell draws the six panes.
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
