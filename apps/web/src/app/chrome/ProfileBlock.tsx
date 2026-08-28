import { useSignedIn } from "../session/signedIn";
import { useOverlays } from "../keyboard/overlays";
import { Kbd } from "../../components/ui";

/**

 * THE PROFILE BLOCK — the design's "deep well" at the foot of the rail. The WELL

 * ITSELF is `SidebarFooter` (`--color-rail-deep`, top hairline); this is its contents.

 */
export function ProfileBlock() {
  const account = useSignedIn((s) => s.account);
  const signOut = useSignedIn((s) => s.signOut);
  const toggle = useOverlays((s) => s.toggle);

  // The rail does not render for a signed-out reader (INVARIANT 45), so this
  // is a structural guard rather than a state a reader reaches.
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
          {/* 11px, not the design's 10.5 — see the header. Mono: rule 3, an
              email address is an identifier. */}
          <span className="truncate font-mono text-label leading-flat text-rail-ink-muted">
            {account.email}
          </span>
        </div>
        {/*
         * THE PILL DOES NOT SHARE THE NAME'S ROW BY ACCIDENT — it did once, and
         * "Sign out" was clipped off the 240px column, caught by screenshotting
         * the built rail rather than by any assertion. `justify-between` on a
         * fixed-width parent silently overflows rather than wrapping, so the
         * last control simply left the frame while the DOM still had it and
         * every text-based check stayed green. It fits here because the name
         * block is `min-w-0` and truncates, which the pill is not asked to do.
         */}
        <span className="shrink-0 rounded-pill border border-rail-line px-4 py-1 text-label font-bold leading-flat text-rail-accent">
          {account.role}
        </span>
      </div>

      <div className="border-t border-rail-line pt-5">
        <button
          type="button"
          data-testid="sign-out"
          title="End this session and return to sign-in"
          onClick={signOut}
          className="tp-state tp-press rounded-pill border border-rail-line px-4 py-1 text-label leading-flat text-rail-ink hover:text-surface-panel"
        >
          Switch user / Sign out
        </button>
      </div>
    </div>
  );
}
