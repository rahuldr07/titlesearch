import { Link } from "@tanstack/react-router";
import { buttonClasses } from "../../shared/ui/buttonClasses";
import { Card } from "../../shared/ui/Card";
import { Screen } from "../../shared/ui/Screen";
import { Wordmark } from "../../shared/ui/Wordmark";
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
  // MEASURE 440, NOT THE EXPORT'S 380. The measure is the width of the CONTENT
  // (`Screen`), and the sheet below spends 28px a side on padding.
  return (
    <Screen measure="440" pad="40" placement="centre">
      {/*
        THE SHEET IS THE SCREEN — `Screen`'s `centre` placement is the export's
        SIX SINGLE-CARD screens, and this is the first of them a person ever
        sees. RULE: the reskin's ground is layered paper; every object in the
        product sits on a sheet above the desk. FAILURE PREVENTED: on the warm
        desk tone a mark, a button and a sentence with nothing under them read as
        a page that failed to finish loading — which is the worst possible first
        impression for a screen whose entire argument is that it is the real one
        and not a copy of it.
      */}
      <Card size="emphasis" className="w-full px-14 py-16 text-center">
        {/*
          THE SAME MARK THE RAIL DRAWS, at hero size. It replaces a three-bar
          "pipe seen end-on" glyph over `TITLEPIPE` in tracked caps — a second,
          independently-drawn identity that the 2026-08-01 reskin left behind
          when the rail moved to the mockup's seal-and-serif. The two are one
          component now, so the first screen anyone sees and every screen after
          it cannot disagree about what this product is called.
        */}
        <Wordmark size="hero" className="mb-3" />
        <div className="mb-14 text-xs tracking-eyebrow uppercase text-ink-muted">
          Abstractor Review · internal
        </div>

        <Link
          to="/"
          data-testid="signin-handoff"
          className={cn(buttonClasses({ size: "xl" }))}
        >
          Sign in
        </Link>

        <p className="mt-8 text-xs leading-open text-ink-muted">
          Sign-in, passwords, and MFA are handled by your identity provider on its own
          page. This tool never sees your credentials.
        </p>
      </Card>
    </Screen>
  );
}
