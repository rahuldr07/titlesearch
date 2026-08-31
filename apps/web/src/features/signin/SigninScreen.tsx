import { useNavigate } from "@tanstack/react-router";
import { useSignedIn, type DemoAccount } from "../../app/session/signedIn";
import { useSession } from "../../shared/session";
import { DEMO_ACCOUNTS } from "../../app/session/demoAccounts";
import { AccountRow } from "./AccountRow";
import { CredentialsForm } from "./CredentialsForm";

/**
 * The sign-in screen. Dark canvas, radial accent glow, flat white TF mark,
 * white card under the modal shadow. The overlay scrolls at short viewports
 * while the app frame does not — this screen is a pane inside the
 * overflow-hidden document, and `margin:auto` on the card keeps it centred
 * when it fits and lets it scroll when it does not (`items-center` would
 * clip the top). The bare chrome is enforced by `rootRoute.tsx`, which does
 * not render the rail or strip at all without a session — a screen that has
 * to remember to be bare is a screen that will forget. There is no
 * authentication surface in the contract, so the credentials form refuses
 * rather than lying (`CredentialsForm`); the demo rows are the working path.
 */
export function SigninScreen() {
  const navigate = useNavigate();
  const setAccount = useSignedIn((s) => s.signIn);
  const actAs = useSession((s) => s.actAs);

  function continueAs(account: DemoAccount) {
    /*
     * Two stores, one act — the split is deliberate: `signedIn` says whether
     * there is a session; `shared/session` holds the role the fetch layer
     * sends as `x-mock-role`, which the mock server reads to decide the
     * permission projection. Setting only the first would sign you in as
     * somebody whose doors were still the previous role's.
     */
    setAccount(account);
    actAs({ role: account.role, actor: account.name });
    void navigate({ to: "/" });
  }

  return (
    <div className="relative flex h-full justify-center overflow-y-auto bg-rail-surface p-12">
      {/* The radial accent glow. Pointer-events off — it is paint, not a
          surface, and a full-bleed div would otherwise eat every click. */}
      <div className="pointer-events-none fixed inset-0 bg-radial-accent-glow" />

      <div className="relative m-auto flex w-full max-w-200 flex-col">
        <div className="mb-12 flex flex-col items-center">
          {/* Flat brand mark, typed, never an asset. */}
          <span className="flex h-22 w-22 items-center justify-center rounded-md bg-surface-panel text-subject font-bold leading-flat text-rail-surface">
            TF
          </span>
          <h1 className="mt-6 text-subject font-bold leading-tight tracking-tight text-surface-panel">
            TitlePipe
          </h1>
          {/* The design's own mono line; the register it sets is the
              terminal one. */}
          <p className="mt-2 font-mono text-label leading-flat text-rail-ink-muted">
            Title abstract production · examiner sign-in
          </p>
        </div>

        <div className="flex flex-col gap-9 rounded-lg bg-surface-panel p-12 shadow-modal">
          <CredentialsForm />

          <div className="flex items-center gap-5">
            <span className="h-px flex-1 bg-line-subtle" />
            {/* The design sets this at 10.5px; the type scale has no such
                size, so it renders at 11px. */}
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

        {/* The footer — two lines, mono, centred, with our product name in
            place of the fixture firm's. */}
        <p className="mt-8 text-center font-mono text-label leading-airy text-rail-ink-muted">
          Sessions are audited · actor identity stamps every ruling
          <br />
          TitlePipe Abstracting · v2 prototype
        </p>
      </div>
    </div>
  );
}
