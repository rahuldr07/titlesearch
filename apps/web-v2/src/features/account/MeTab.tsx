import { useQuery } from "@tanstack/react-query";
import { ROLES, type Role } from "@titlepipe/contract";
import { myWorldQuery } from "./queries";
import { useSession } from "../../shared/session";
import { doorsFor } from "../../entities/nav/doors";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Button } from "../../shared/ui/Button";

/**
 * "What I can do" — rendered from the SERVER'S projection, never from a local
 * table (`authz.spec` #4). The client asks who it is and prints the answer.
 *
 * THE PROJECTION IS PER-ROLE AND NAMES NO OTHER WORLD. A typist's payload does
 * not mention escalations, the dashboard or the queue — `authz.spec` #3 asserts
 * that at the wire, and this renders only what arrives, so a leak here would
 * mean a leak there.
 *
 * The role switcher below is DEV-ONLY (conflict C12) and must not ship. See
 * shared/session.ts.
 */
export function MeTab() {
  const role = useSession((s) => s.role);
  const actAs = useSession((s) => s.actAs);
  const { data, isPending, isError } = useQuery(myWorldQuery(role));

  return (
    <div className="flex flex-col gap-8">
      <Card>
        <CardHeader filled>
          <Eyebrow variant="section">What I can do</Eyebrow>
        </CardHeader>
        <CardBody>
          {isError ? (
            <p className="text-base text-state-halt-ink">Your world could not be loaded.</p>
          ) : isPending ? (
            <p className="text-base text-ink-secondary">Loading…</p>
          ) : (
            <div data-testid="my-world" className="flex flex-col gap-5">
              <div>
                <Eyebrow variant="field">Acting as</Eyebrow>
                <p className="mt-1 font-mono text-md text-ink-primary">{data.role}</p>
              </div>
              <div>
                <Eyebrow variant="field">Doors</Eyebrow>
                <ul className="mt-1 flex flex-wrap gap-4">
                  {doorsFor(data.role as Role).map((door) => (
                    <li key={door.path} className="font-mono text-base text-ink-primary">
                      {door.path}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <Eyebrow variant="field">Actions</Eyebrow>
                <ul className="mt-1 flex flex-col gap-1">
                  {data.rules.map((granted) => (
                    <li key={granted.action} className="font-mono text-base text-ink-primary">
                      {granted.action}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card accent="attend">
        <CardHeader filled>
          <Eyebrow variant="section" tone="attend">Preview control — not in production</Eyebrow>
        </CardHeader>
        <CardBody>
          <p className="text-base text-ink-secondary">
            Switching here changes only which world the mock backend serves. The
            server enforces authorization independently and never trusts a
            client-asserted identity.
          </p>
          <div className="mt-6 flex flex-wrap gap-4">
            {ROLES.map((r) => (
              <Button
                key={r}
                size="sm"
                data-testid={`role-${r}`}
                fill={r === role ? "solid" : "outlined"}
                tone={r === role ? "action" : "neutral"}
                onClick={() => actAs(r)}
              >
                {r}
              </Button>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
