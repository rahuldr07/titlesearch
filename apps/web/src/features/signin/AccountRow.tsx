import type { DemoAccount } from "../../app/session/signedIn";
import { ACCOUNT_LICENSES } from "../../app/session/demoAccounts";

/**
 * One "demo — continue as" row: avatar initials, name, role, →.
 *
 * The design's row prints ONE role string. The contract has two facts here and
 * they are not interchangeable — the seat ("QC") is what the shop calls the
 * job, and the role (`senior`) is what `x-mock-role` carries and what the
 * server's permission projection keys off. Both are printed, seat first, so
 * the reader picking a row can see which world they are about to enter and the
 * screen never implies the design's job title is an authorization fact.
 *
 * `→` rather than an icon: rule 7's glyph vocabulary, and the design's own
 * character.
 */
export function AccountRow(props: {
  readonly account: DemoAccount;
  readonly onSelect: (account: DemoAccount) => void;
}) {
  const { account } = props;
  return (
    <button
      type="button"
      data-testid={`continue-as-${account.role}`}
      onClick={() => props.onSelect(account)}
      className="tp-state flex w-full items-center gap-5 rounded-md border border-line-strong bg-surface-panel px-5 py-4 text-left hover:border-action-border hover:bg-action-surface"
    >
      <span className="flex h-15 w-15 shrink-0 items-center justify-center rounded-pill bg-action-surface text-label font-bold leading-flat text-action">
        {account.initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-meta font-semibold leading-close text-ink-primary">
          {account.name}
        </span>
        {/* The design sets this line at 10.5px; rule 2 allows six sizes and
            10.5 is not one. 11px, flagged — see `ProfileBlock`.
            RULING-2026-08-29: the reference roster's licence strings ride the
            description for the two people it licenses ("· #GA-8841"). */}
        <span className="truncate text-label leading-close text-ink-faint">
          {account.seat} · {account.role}
          {ACCOUNT_LICENSES[account.id] !== undefined &&
            ` · ${ACCOUNT_LICENSES[account.id]}`}
        </span>
      </span>
      <span aria-hidden className="text-body font-bold leading-flat text-ink-disabled">
        →
      </span>
    </button>
  );
}
