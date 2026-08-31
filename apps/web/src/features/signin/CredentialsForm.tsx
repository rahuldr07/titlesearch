import { useState } from "react";
import { Form, TextField } from "react-aria-components";
import { Field, Label, Input } from "../../components/ui";
import { Button } from "../../components/ui";

/**
 * Email + password, drawn as designed and honest about itself. The contract
 * has no authentication surface — no login, session, or logout endpoint —
 * so the form refuses with the reason rather than posting to an invented
 * endpoint or accepting any credentials. The refusal is client-authored,
 * and this is the one case where that is legitimate: there is no server to
 * have said anything, and the sentence names the absence rather than
 * blaming the reader's credentials. The button is not disabled — a disabled
 * control with a reason would look like it could work once some condition
 * is met, and none can.
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
      {/* An email address is an identifier, so the field is mono. */}
      <Field>
        <TextField name="email" type="email" className="flex flex-col gap-3">
          <Label>Work email</Label>
          <Input data autoComplete="username" />
        </TextField>
      </Field>
      <Field>
        <TextField name="password" type="password" className="flex flex-col gap-3">
          <Label>Password</Label>
          <Input autoComplete="current-password" />
        </TextField>
      </Field>
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
