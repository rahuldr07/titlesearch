import { useNavigate } from "@tanstack/react-router";
import { useSignedIn, type DemoAccount } from "../../app/session/signedIn";
import { useSession } from "../../shared/session";
import { DEMO_ACCOUNTS } from "../../app/session/demoAccounts";
import { AccountRow } from "./AccountRow";
import { CredentialsForm } from "./CredentialsForm";

/**
 * SCREEN 1 — SIGN-IN. Dark canvas, radial accent glow, flat white TF mark,
 * white card at radius 14 under the modal shadow.
 *
 * ══ THE OVERLAY SCROLLS; THE APP FRAME DOES NOT ════════════════════════════
 *
 * Design §Screens 1: "Overlay scrolls at short viewports (overflow-y:auto,
 * margin:auto centering)." That is not a contradiction of INVARIANT 60 — this
 * screen is not the app frame. `styles.css` roots the document at
 * `overflow:hidden`, and the panes inside it scroll; this is one such pane, and
 * `margin:auto` on the card is what keeps it centred when it fits and lets it
 * scroll when it does not. `items-center` would clip the top instead.
 *
 * ══ NOBODY SIGNED IN IS SHOWN AN ADMIN WORLD ═══════════════════════════════
 *
 * INVARIANT 45, and `shell-frame.spec` asserts `side-rail` and `order-strip`
 * are both COUNT 0 here. That is not enforced by this component remembering to
 * be bare — it is enforced in `rootRoute.tsx`, which does not render the chrome
 * at all without a session. A screen that has to remember is a screen that will
 * forget.
 *
 * ══ WHAT THE FORM DOES, AND DOES NOT PRETEND TO DO ═════════════════════════
 *
 * There is no authentication surface anywhere in `@titlepipe/contract`: no
 * login endpoint, no session endpoint, no logout. The email/password form is
 * therefore drawn as the design draws it and REFUSES rather than lying — see
 * `CredentialsForm`. The four demo rows are the working path, which is what
 * the design itself calls them ("demo — continue as").
 */
export function SigninScreen() {
  const navigate = useNavigate();
  const setAccount = useSignedIn((s) => s.signIn);
  const actAs = useSession((s) => s.actAs);

  function continueAs(account: DemoAccount) {
    /*
     * TWO STORES, ONE ACT, and the split is deliberate. `signedIn` says whether
     * there is a session (a client-held stand-in for Clerk); `shared/session`
     * holds the role the fetch layer sends as `x-mock-role`, which is what the
     * MOCK SERVER reads to decide the permission projection. Setting only the
     * first would sign you in as somebody whose doors were still the previous
     * role's.
     */
    setAccount(account);
    actAs(account.role);
    void navigate({ to: "/" });
  }

  return (
    <div className="relative flex h-full justify-center overflow-y-auto bg-rail-surface p-12">
      {/* The radial accent glow. Pointer-events off — it is paint, not a
          surface, and a full-bleed div would otherwise eat every click. */}
      <div className="pointer-events-none fixed inset-0 bg-radial-accent-glow" />

      <div className="relative m-auto flex w-full max-w-200 flex-col">
        <div className="mb-12 flex flex-col items-center">
          {/* Rule 7: flat brand mark, typed, never an asset. */}
          <span className="flex h-22 w-22 items-center justify-center rounded-md bg-surface-panel text-subject font-bold leading-flat text-rail-surface">
            TF
          </span>
          <h1 className="mt-6 text-subject font-bold leading-tight tracking-tight text-surface-panel">
            TitlePipe
          </h1>
          {/* Mono: rule 3 permits it for data. This is a product designation,
              which is closer to prose — but it is the design's own mono line
              and the register it sets is the terminal one. Flagged. */}
          <p className="mt-2 font-mono text-label leading-flat text-rail-ink-muted">
            Title abstract production · examiner sign-in
          </p>
        </div>

        <div className="flex flex-col gap-9 rounded-lg bg-surface-panel p-12 shadow-modal">
          <CredentialsForm />

          <div className="flex items-center gap-5">
            <span className="h-px flex-1 bg-line-subtle" />
            {/* The design sets this at 10.5px. Rule 2 allows six sizes and
                10.5 is not one — rendered at 11px. See `ProfileBlock` for the
                full argument; it is flagged at every site, not absorbed. */}
            <span className="text-label font-semibold leading-flat text-ink-faint">
              demo — continue as
            </span>
            <span className="h-px flex-1 bg-line-subtle" />
          </div>

          <ul className="flex flex-col gap-3">
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.id}>
                <AccountRow account={account} onSelect={continueAs} />
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-8 text-center font-mono text-label leading-airy text-rail-ink-muted">
          Sessions are audited · actor identity stamps every ruling
        </p>
      </div>
    </div>
  );
}
