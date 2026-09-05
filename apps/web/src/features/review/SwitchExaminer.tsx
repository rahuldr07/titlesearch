import { Button } from "../../components/ui";
import { DEMO_ACCOUNTS } from "../../app/session/demoAccounts";
import { useSignedIn } from "../../app/session/signedIn";
import { useSession } from "../../shared/session";

/**
 * The "Switch user" affordance — a preview control, not a gate: the
 * countersign action stays live whoever is signed in, since the
 * different-examiner rule is the server's 409. Dev-only, same cutover as
 * `x-mock-role`. It does not set the signer and has no way to: switching
 * seats switches the ROLE, and the server resolves the name from that. The
 * typed signature stays a client field the ledger does not read.
 */
export function SwitchExaminer() {
  const signIn = useSignedIn((state) => state.signIn);
  const account = useSignedIn((state) => state.account);
  const actAs = useSession((state) => state.actAs);
  const qc = DEMO_ACCOUNTS.find((candidate) => candidate.seat === "QC");

  if (qc === undefined || account?.id === qc.id) return null;

  return (
    <Button
      variant="secondary"
      data-testid="countersign-switch-user"
      onPress={() => {
        signIn(qc);
        actAs(qc.role);
      }}
    >
      Switch user: {qc.name} ({qc.seat})
    </Button>
  );
}
