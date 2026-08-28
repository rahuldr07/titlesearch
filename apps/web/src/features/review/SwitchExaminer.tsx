import { Button } from "../../components/ui";
import { DEMO_ACCOUNTS } from "../../app/session/demoAccounts";
import { useSignedIn } from "../../app/session/signedIn";
import { useSession } from "../../shared/session";

/**
 * THE DESIGN'S "Switch user: R. Menon (QC)" AFFORDANCE — and it is a preview
 * control, not a gate. The countersign action stays live whoever is signed in;
 * rule 13 is the server's 409. This only saves a trip through the sign-in
 * screen when the ruling examiner is the one holding the keyboard.
 *
 * DEV-ONLY, same cutover as `shared/session.ts`'s `x-mock-role`: it sets the
 * role the fetch layer sends. It does NOT set the signer — `session.actor` has
 * no setter on purpose (a signature the client can type is not a signature),
 * so the second reader's name is the one typed into the signature field.
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
        actAs({ role: qc.role, actor: qc.name });
      }}
    >
      Switch user: {qc.name} ({qc.seat})
    </Button>
  );
}
