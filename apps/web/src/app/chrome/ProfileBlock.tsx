import { useSignedIn } from "../session/signedIn";
import { Button } from "../../components/ui";

/**
 * THE PROFILE BLOCK — the design's "deep well" at the foot of the rail
 * (`--color-rail-deep`, a tone below the rail surface).
 *
 * ══ THE DESIGN ASKS FOR A SEVENTH TYPE SIZE, AND IT IS REFUSED ═════════════
 *
 * Design README §App shell, verbatim: "Bottom: signed-in profile (avatar
 * initials, name, email mono 10.5px, role pill)". The reference prototype uses
 * `font-size:10.5px` in five places (the divider caption and account role on
 * sign-in, this email, the footer legal line).
 *
 * `claude-design-rules.md` rule 2, also verbatim: "Six type sizes only:
 * 11 / 13 / 16 / 20 / 28 / 40 px. NOTHING BETWEEN."
 *
 * 10.5 is between. The two documents in the same bundle contradict each other,
 * and rule 2 is the one that ships as enforcement: `tokens.css` deletes the
 * whole `--text-*` namespace so Tailwind emits no seventh utility, and
 * `shared/tokens.test.ts` pins the cardinality at six. Inventing
 * `--text-micro: 10.5px` would defeat all three in one line, and the half-pixel
 * would land differently per zoom level anyway.
 *
 * RESOLVED IN FAVOUR OF THE RULE: the email renders at `--text-label` (11px),
 * mono per rule 3 — an email address is an identifier, which is data. The 0.5px
 * is not worth a seventh size, but the ruling is the owner's, not mine, and it
 * is FLAGGED rather than silently absorbed. Every other 10.5px in the design
 * gets the same treatment, at each site, with the same note.
 *
 * ══ SWITCH USER / SIGN OUT ═════════════════════════════════════════════════
 *
 * Both are client-side only. There is no auth surface in the contract — no
 * login, no logout, no session endpoint (see `app/session/signedIn.ts`). Sign
 * out drops the client-held demo session; "Switch user" returns to the same
 * screen that set it. Neither claims to have told a server anything.
 *
 * The design's third control here — "walkthrough Reset" — is NOT built. It
 * resets the prototype's in-memory demo state, which this app does not have:
 * every value on every screen comes from the server.
 */
export function ProfileBlock() {
  const account = useSignedIn((s) => s.account);
  const signOut = useSignedIn((s) => s.signOut);

  // The rail does not render for a signed-out reader (INVARIANT 45), so this
  // is a structural guard rather than a state a reader reaches.
  if (account === null) return null;

  return (
    <div
      data-testid="profile-block"
      className="flex shrink-0 flex-col gap-6 border-t border-rail-line bg-rail-deep p-10"
    >
      <div className="flex items-center gap-6">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-pill bg-action-surface text-label font-bold leading-flat text-action">
          {account.initials}
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-meta font-semibold leading-flat text-surface-panel">
            {account.name}
          </span>
          {/* 11px, not the design's 10.5 — see the header. Mono: rule 3, an
              email address is an identifier. */}
          <span className="truncate font-mono text-label leading-flat text-rail-ink-muted">
            {account.email}
          </span>
        </div>
      </div>

      {/*
       * THE ROLE PILL AND THE TWO CONTROLS STACK, they do not share a row.
       *
       * They did, and "Sign out" was clipped off the 240px column — caught by
       * screenshotting the built rail, not by any assertion. `justify-between`
       * on a fixed-width parent silently overflows rather than wrapping, so the
       * last control simply left the frame while the DOM still had it and every
       * text-based check stayed green. The pill gets its own line and the
       * controls get theirs, which fits at the design's width by construction
       * rather than by measuring.
       */}
      <span className="w-fit rounded-pill border border-rail-line px-5 py-2 text-label font-semibold leading-flat text-rail-accent">
        {account.role}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onPress={signOut}>
          Switch user
        </Button>
        <Button variant="ghost" size="sm" onPress={signOut} data-testid="sign-out">
          Sign out
        </Button>
      </div>
    </div>
  );
}
