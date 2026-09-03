import type { DemoAccount } from "../../app/session/signedIn";
import { ACCOUNT_LICENSES } from "../../app/session/demoAccounts";

/**
 * One "demo — continue as" row: avatar initials, name, role, →. The seat
 * ("QC") is what the shop calls the job; the role (`senior`) is what
 * `x-mock-role` carries and what the permission projection keys off. Both
 * are printed, seat first, so the screen never implies the job title is an
 * authorization fact.
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
      className="tp-state flex w-full items-center gap-5 rounded-lg border border-line-strong bg-surface-panel px-5 py-4 text-left hover:border-action-border hover:bg-action-surface"
    >
      <span className="flex h-15 w-15 shrink-0 items-center justify-center rounded-pill bg-action-surface text-label font-bold leading-flat text-action">
        {account.initials}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-meta font-semibold leading-close text-ink-primary">
          {account.name}
        </span>
        {/* Licence strings ride the description for the two people that
            hold one ("· #GA-8841"). */}
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
