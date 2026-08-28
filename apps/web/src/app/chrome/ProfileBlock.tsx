import { useSignedIn } from "../session/signedIn";
import { useOverlays } from "../keyboard/overlays";
import { Kbd } from "../../components/ui";

/**
 * THE PROFILE BLOCK — the design's "deep well" at the foot of the rail.
 *
 * The WELL ITSELF is `SidebarFooter` (`--color-rail-deep`, top hairline); this
 * is its contents. The split is what keeps the rail's regions in one file and
 * the session's identity in another.
 *
 * ══ THE DESIGN ASKS FOR A SEVENTH TYPE SIZE, AND IT IS REFUSED ═════════════
 *
 * Design README §App shell, verbatim: "Bottom: signed-in profile (avatar
 * initials, name, email mono 10.5px, role pill)". The reference prototype uses
 * `font-size:10.5px` in five places (the divider caption and account role on
 * sign-in, this email, the role hint, the footer legal line).
 *
 * `claude-design-rules.md` rule 2, also verbatim: "Six type sizes only:
 * 11 / 13 / 16 / 20 / 28 / 40 px. NOTHING BETWEEN."
 *
 * 10.5 is between. The two documents in the same bundle contradict each other,
 * and rule 2 is the one that ships as enforcement: `tokens.css` deletes the
 * whole `--text-*` namespace so Tailwind emits no seventh utility, and
 * `shared/tokens.test.ts` pins the cardinality at six. Inventing
 * `--text-micro: 10.5px` would defeat all three in one line, and the half-pixel
 * lands differently per zoom level anyway.
 *
 * RESOLVED IN FAVOUR OF THE RULE: the email renders at `--text-label` (11px),
 * mono per rule 3 — an email address is an identifier, which is data.
 *
 * ══ WHAT IS HERE THAT WAS NOT, AND WHAT IS STILL NOT ═══════════════════════
 *
 *   - "SIGNED IN" rubric — 11px/.14em ALL-CAPS. Rule 4 permits capitals on a
 *     sidebar rubric, and this is one.
 *   - The HOTKEYS button — the design's `? Hotkeys` chip. It opens the same
 *     `key-map` overlay `?` does, which is what makes the chord discoverable to
 *     a reader who never presses unlabelled keys.
 *   - The ROLE HINT ("Full access · rules, templates, people, release") is NOT
 *     built. The design hard-codes one sentence per role in the browser, which
 *     is a client-side summary of the permission table — INVARIANT 41 says
 *     there is exactly one permission table and it is the server's. The payload
 *     carries `rules`, not prose, and authoring the prose here would let it
 *     drift from the grants it describes. The role pill states the role; the
 *     Account screen holds what it means.
 *   - The RESET control is NOT built. It resets the prototype's in-memory demo
 *     state, which this app does not have: every value on every screen comes
 *     from the server, so there is nothing local to restore.
 *
 * ══ SWITCH USER / SIGN OUT ═════════════════════════════════════════════════
 *
 * ONE control, as the design draws it ("Switch user / Sign out"), because both
 * did the same thing: drop the client-held demo session and return to sign-in.
 * Two buttons calling one handler is a menu that lies about having two choices.
 * There is no auth surface in the contract — no login, logout or session
 * endpoint (see `app/session/signedIn.ts`) — so this claims to have told a
 * server nothing.
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
