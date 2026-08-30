import { Button } from "../../components/ui";
import { useSignedIn } from "../../app/session/signedIn";
import { ACCOUNT_LICENSES } from "../../app/session/demoAccounts";

/**
 * THE FOOTER — one signature line, one helper, ONE act.
 *
 * ⚠ RULED 2026-08-29 (RULING-2026-08-29.md): the reference's footer is one
 * primary press — "Sign for Package & Begin Dual-Engine Extraction →" — and
 * the ruling supersedes the two-act staging INVARIANT 47 imposed, so this
 * button performs upload-and-accept as one act (`useSignForPackage`). The
 * "Examiner signature:" line is drawn here too, printing the demo session's
 * name and licence (`ACCOUNT_LICENSES`) — the refusal that kept it off the
 * upload footer is superseded by the same ruling. The signature of RECORD is
 * still the server's, derived from the session on the accept call.
 *
 * The button is disabled only until a file is chosen (and while in flight):
 * a press with client or product unpicked goes to the server, and the
 * SERVER's refusal names what is missing (INVARIANTS 60-61). The helper
 * notes are the reference's own three sentences, drawn beside the act.
 */
export function SignFooter(props: {
  readonly note: string | null;
  readonly hasFile: boolean;
  readonly pending: boolean;
  readonly onSign: () => void;
}) {
  const account = useSignedIn((s) => s.account);
  const license = account === null ? undefined : ACCOUNT_LICENSES[account.id];

  return (
    <div className="flex flex-wrap items-center justify-between gap-8 border-t border-line-subtle px-12 py-8">
      <span
        data-testid="examiner-signature"
        className="font-mono text-meta leading-close text-ink-faint"
      >
        {account === null
          ? "Examiner signature: no session — sign in to sign for a package"
          : `Examiner signature: ${account.name}${license === undefined ? "" : ` (${license})`}`}
      </span>
      <span className="flex flex-wrap items-center gap-8">
        {props.note !== null && (
          <span
            data-testid="sign-note"
            className="font-sans text-meta leading-close text-ink-faint"
          >
            {props.note}
          </span>
        )}
        {/* RULE 1: the screen's one accent spend — the act that matters. */}
        <Button
          variant="primary"
          data-testid="sign-btn"
          onPress={props.onSign}
          disabledBecause={
            props.pending
              ? "Signing for the package…"
              : props.hasFile
                ? undefined
                : "Drop the package to begin"
          }
        >
          Sign for Package &amp; Begin Dual-Engine Extraction →
        </Button>
      </span>
    </div>
  );
}
