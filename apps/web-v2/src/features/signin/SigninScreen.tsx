import { Link } from "@tanstack/react-router";
import { PipeMark } from "./PipeMark";
import { buttonClasses } from "../../shared/ui/Button";
import { cn } from "../../shared/ui/classNames";

/**
 * Sign-in. THE SCREEN'S ONLY JOB IS TO HAND OFF, AND TO SAY SO OUT LOUD.
 *
 * There is no email field, no password field and no "forgot password" link,
 * and their absence is the design decision — not an unfinished form. Identity
 * lives with the identity provider; this tool never sees a credential, so it
 * must never draw a box that looks like it wants one. A phishing page is
 * exactly a convincing credential box on a familiar-looking screen, and the
 * defence that actually works is that the real screen has never had one.
 *
 * The sentence under the button is therefore load-bearing copy rather than
 * reassurance: it tells someone who expected a password field why there isn't
 * one, at the moment they are looking for it.
 *
 * The control is an anchor, not a button, because it NAVIGATES. A screen-reader
 * user is told "link" and gets the browser's own affordances; a `<button>` here
 * would announce an action that never happens on this page.
 *
 * CONTRACT GAP: no endpoint and no configured identity-provider URL exists, so
 * the hand-off target is the hub. Point this at the IdP authorize URL when the
 * session endpoints land — the copy is already true of that flow.
 */
export function SigninScreen() {
  return (
    <div className="flex min-h-full items-center justify-center py-20">
      <div className="w-full max-w-190 text-center">
        <PipeMark />

        <div className="text-2xl font-bold tracking-stamp text-ink-primary">
          TITLEPIPE
        </div>
        <div className="mt-2 mb-14 text-xs tracking-eyebrow uppercase text-ink-muted">
          Abstractor Review · internal
        </div>

        <Link to="/" data-testid="signin-handoff" className={cn(buttonClasses({ size: "xl" }))}>
          Sign in
        </Link>

        <p className="mt-8 text-xs leading-open text-ink-muted">
          Sign-in, passwords, and MFA are handled by your identity provider on
          its own page. This tool never sees your credentials.
        </p>
      </div>
    </div>
  );
}
