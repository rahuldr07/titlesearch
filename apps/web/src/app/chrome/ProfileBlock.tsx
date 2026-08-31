import { useQueryClient } from "@tanstack/react-query";
import { Ack } from "@titlepipe/contract";
import { useSignedIn } from "../session/signedIn";
import { ROLE_HINTS } from "../session/demoAccounts";
import { useOverlays } from "../keyboard/overlays";
import { post } from "../../shared/api";
import { Kbd } from "../../components/ui";

/**
 * The profile block — the "deep well" at the foot of the rail. The well
 * itself is `SidebarFooter`; this is its contents.
 */
export function ProfileBlock() {
  const account = useSignedIn((s) => s.account);
  const signOut = useSignedIn((s) => s.signOut);
  const toggle = useOverlays((s) => s.toggle);

  // The rail does not render for a signed-out reader, so this is a
  // structural guard rather than a state a reader reaches.
  if (account === null) return null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-label font-bold uppercase leading-flat tracking-caps text-rail-ink-muted">
          Signed in
        </h2>
        <button
          type="button"
          data-testid="rail-hotkeys"
          title="Keyboard shortcuts (?)"
          onClick={() => toggle("key-map")}
          className="tp-state tp-press flex shrink-0 items-center gap-2 rounded-pill border border-rail-line bg-rail-line px-4 py-1 text-label leading-flat text-rail-ink hover:text-surface-panel"
        >
          <Kbd className="min-w-0 border-transparent bg-rail-line px-2 text-surface-panel">
            ?
          </Kbd>
          Hotkeys
        </button>
      </div>

      <div className="flex items-center gap-5">
        <span className="flex size-17 shrink-0 items-center justify-center rounded-pill bg-action text-meta font-bold leading-flat text-ink-on-action">
          {account.initials}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-meta font-semibold leading-flat text-surface-panel">
            {account.name}
          </span>
          {/* Mono: an email address is an identifier. */}
          <span className="truncate font-mono text-label leading-flat text-rail-ink-muted">
            {account.email}
          </span>
        </div>
        {/*
         * `justify-between` on a fixed-width parent silently overflows
         * rather than wrapping. The pill fits on this row only because the
         * name block is `min-w-0` and truncates.
         */}
        <span className="shrink-0 rounded-pill border border-rail-line px-4 py-1 text-label font-bold leading-flat text-rail-accent">
          {account.role}
        </span>
      </div>

      {/* What this role may do, under the name row. The lines live in
          `demoAccounts.ts` beside the roster. */}
      <p data-testid="role-hint" className="text-label leading-body text-rail-ink-muted">
        {ROLE_HINTS[account.role]}
      </p>

      <div className="flex items-center justify-between gap-4 border-t border-rail-line pt-5">
        <button
          type="button"
          data-testid="sign-out"
          title="End this session and return to sign-in"
          onClick={signOut}
          className="tp-state tp-press rounded-pill border border-rail-line px-4 py-1 text-label leading-flat text-rail-ink hover:text-surface-panel"
        >
          Switch user / Sign out
        </button>
        <ResetButton />
      </div>
    </div>
  );
}

/**
 * Restore the demo to fresh intake. `POST /api/demo/reset` re-seeds the mock
 * stores server-side — the reset is the server's, not a client purge of its
 * own caches — and every query is then refetched so the screens show the
 * reseeded truth. The signed-in seat survives.
 */
function ResetButton() {
  const queryClient = useQueryClient();
  return (
    <button
      type="button"
      data-testid="demo-reset"
      title="Restore the demo to fresh intake"
      onClick={() => {
        void post("/api/demo/reset", Ack).then(() =>
          queryClient.invalidateQueries(),
        );
      }}
      className="tp-state tp-press flex items-center gap-2 rounded-pill border border-rail-line px-4 py-1 text-label leading-flat text-rail-ink hover:text-surface-panel"
    >
      ↺ Reset
    </button>
  );
}
