import { useState } from "react";
import { Form } from "react-aria-components";
import { Input } from "../../components/ui/Input";
import { Button } from "../../components/ui/Button";

/**
 * EMAIL + PASSWORD, DRAWN AS THE DESIGN DRAWS IT, AND HONEST ABOUT ITSELF.
 *
 * THE CONTRACT HAS NO AUTHENTICATION SURFACE. Not "not yet wired" — absent:
 * there is no login endpoint, no session endpoint and no logout anywhere in
 * `packages/contract`, and `packages/mocks` ships no handler for one.
 * `ANALYSIS-screens.md` §1 records the resolution: the four-account switcher is
 * "mock-auth only; Clerk at P1."
 *
 * Three ways this could have been built, and why this is the one:
 *
 *   - POST to an invented `/api/auth/login`. That is the UI inventing backend
 *     surface, which root AGENTS.md forbids outright ("Never generate backend
 *     logic from the UI/screens"), and MSW would 404 it in a way that reads as
 *     a broken backend rather than a missing feature.
 *   - Accept any credentials and sign the reader in. A password field that
 *     accepts anything is a lie told in the one place a reader is entitled to
 *     assume otherwise, and it would put a fake authentication step into the
 *     record of a product whose entire subject is provenance.
 *   - Draw it, and refuse with the reason. This.
 *
 * The refusal is client-authored, and that is the ONE case where it is
 * legitimate: `shared/notify.ts` forbids the client composing refusal wording
 * because the SERVER's message must survive verbatim — and here there is no
 * server to have said anything. The sentence names the absence rather than
 * blaming the reader's credentials.
 *
 * Rule 9 is not applicable to the button: it is not disabled. A disabled
 * control with a reason would still be a control that looks like it could work
 * once some condition is met, and none can.
 */
export function CredentialsForm() {
  const [refused, setRefused] = useState(false);

  return (
    <Form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        setRefused(true);
      }}
    >
      {/* Rule 3: an email address is an identifier, so mono is legal here —
          and the design's own field is mono. */}
      <Input label="Work email" type="email" name="email" data autoComplete="username" />
      <Input
        label="Password"
        type="password"
        name="password"
        autoComplete="current-password"
      />
      <Button type="submit" variant="primary" size="lg" className="mt-4 w-full">
        Sign in
      </Button>
      {refused && (
        <p
          data-testid="signin-refusal"
          role="alert"
          className="text-meta leading-body text-state-halt"
        >
          Password sign-in is not connected. This build has no authentication
          service behind it — use a demo account below.
        </p>
      )}
    </Form>
  );
}
