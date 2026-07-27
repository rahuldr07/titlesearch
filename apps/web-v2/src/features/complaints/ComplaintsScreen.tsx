import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { complaintsQuery } from "./queries";
import { CaptureList } from "./CaptureList";
import { ResolvePanel } from "./ResolvePanel";
import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Chip } from "../../shared/ui/Chip";
import { Button } from "../../shared/ui/Button";
import { Link } from "@tanstack/react-router";
import { ScreenTitle } from "../../app/ScreenTitle";

const GROUP_LABEL: Record<string, string> = {
  auto_confirmed: "AUTO-CONFIRMED — NO HUMAN SAW IT",
  human_confirmed: "A REVIEWER CONFIRMED THIS",
};

/**
 * Complaints, grouped by HOW THEY GOT THROUGH — the only grouping that leads
 * anywhere.
 *
 * An auto-confirmed complaint means no human ever saw the field, which makes
 * it a THRESHOLD error, not a reviewer error. A human-confirmed one is a
 * different investigation entirely. Grouping by client, or by date, or by
 * severity would bury that distinction under something easier to sort by.
 *
 * THERE ARE NO PER-REVIEWER COMPLAINT COUNTS HERE, and the screen says so out
 * loud (`delivery-complaints.spec` #3). The moment complaints attach to people,
 * people stop surfacing them.
 */
export function ComplaintsScreen() {
  const { data, isPending, isError } = useQuery(complaintsQuery);
  const [resolving, setResolving] = useState<string | null>(null);

  if (isError) return <p className="text-base text-state-halt-ink">Complaints unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading complaints…</p>;

  const groups = new Map<string, typeof data.complaints>();
  for (const c of data.complaints) {
    groups.set(c.how_it_got_through, [...(groups.get(c.how_it_got_through) ?? []), c]);
  }

  return (
    <div className="flex flex-col gap-8">
      <ScreenTitle>Complaints</ScreenTitle>
      <p className="text-base text-ink-secondary">
        No per-reviewer complaint counts exist here. A complaint is evidence
        about the pipeline, not about a person.
      </p>

      {[...groups.entries()].map(([how, complaints]) => (
        <Card key={how} accent={how === "auto_confirmed" ? "halt" : "none"}>
          <CardHeader filled>
            <Eyebrow variant="section" data-testid={`group-${how}`}>
              {GROUP_LABEL[how] ?? how.toUpperCase()}
            </Eyebrow>
          </CardHeader>
          <CardBody className="p-0">
            <ul>
              {complaints.map((c) => (
                <li
                  key={c.id}
                  data-testid={c.resolution ? `complaint-resolved-${c.id}` : `complaint-${c.id}`}
                  className="border-t border-line-subtle first:border-t-0"
                >
                  <div className="flex flex-wrap items-baseline gap-5 px-8 py-5">
                    <span className="font-mono text-base text-ink-primary">{c.field_path}</span>
                    <span className="flex-1 text-base text-ink-secondary">
                      client says {c.client_value ?? "—"} · we shipped{" "}
                      {c.shipped_value ?? "nothing"}
                    </span>
                    {how === "auto_confirmed" ? (
                      <Chip tone="halt" size="micro" bordered>
                        no human ever saw it
                      </Chip>
                    ) : null}
                    {/*
                      CONTEXT TRAVELS THROUGH THE LINK. A complaint names an
                      order and a field; the destination is never asked to
                      re-derive which field was complained about.
                    */}
                    <Link
                      to="/orders/$orderId/review"
                      params={{ orderId: c.order_id }}
                      search={{ field: c.field_path }}
                      data-testid={`complaint-open-${c.id}`}
                      className="text-xs font-semibold text-action underline"
                    >
                      Open the field
                    </Link>
                    {c.resolution ? (
                      <Chip tone="settled" size="sm">resolved</Chip>
                    ) : (
                      <Button
                        size="sm"
                        fill="outlined"
                        tone="neutral"
                        data-testid={`resolve-open-${c.id}`}
                        onClick={() => setResolving(c.id)}
                      >
                        Resolve
                      </Button>
                    )}
                    {c.golden_offer_accepted ? (
                      <Chip tone="action" size="micro" bordered>GOLDEN CASE</Chip>
                    ) : null}
                  </div>

                  {resolving === c.id && !c.resolution ? (
                    <ResolvePanel complaintId={c.id} />
                  ) : null}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ))}

      <CaptureList orderId="ord_demo_1" />
    </div>
  );
}
