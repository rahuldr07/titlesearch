/**
 * WHO IS ABOUT TO SIGN — displayed, never typed, and never sent.
 *
 * `session.ts:27` pins the rule and names the spec it came from: "the signer is
 * not a client field — it's shown read-only from the session". The contract
 * says the same from the other side (`endpoints.ts:261-268`):
 * `GoldenCorrectionRequest` has four members and none of them is a signer, so
 * there is no body field for a name to travel in even if somebody typed one.
 *
 * The server derives the identity from the session — `shared/api.ts` carries it
 * as a header standing in for the JWT claim until the real API lands. So this
 * component is not an input with the editing removed; it is a statement of
 * consequence, placed where a signature line goes on paper, because the reader
 * is about to attach their name permanently to a change in the ruler.
 *
 * An empty identity is drawn as an absence rather than a blank (rule 14), and
 * `correctionHold` refuses to file on it.
 */
export function SignedBy(props: { readonly signature: string }) {
  const named = props.signature.trim().length > 0;
  return (
    <div className="flex flex-col gap-2">
      <span className="font-sans text-label leading-flat font-bold text-ink-faint">
        Signed by
      </span>
      {/* Rule 3: a recorded identity on a permanent log is data. */}
      <span
        data-testid="correction-signature"
        className={
          named
            ? "font-mono text-meta leading-close text-ink-secondary"
            : "font-mono text-meta leading-close text-state-halt"
        }
      >
        {named ? props.signature : "no session identity"}
      </span>
      <span className="font-sans text-label leading-body text-ink-muted">
        Read-only, and not part of the request. The server stamps the signer from
        the session — a signature the client can type is not a signature
        (endpoints.ts:265).
      </span>
    </div>
  );
}
