import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Escalation } from "@titlepipe/contract";
import { escalationsQuery, rulesQuery } from "./queries";
import { ClusterRail, type Cluster } from "./ClusterRail";
import { ClusterDetail } from "./ClusterDetail";
import { EmptyPanel } from "../../shared/ui/EmptyPanel";
import { Screen } from "../../shared/ui/Screen";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";

function clusterBy(escalations: readonly Escalation[]): Cluster[] {
  const byPath = new Map<string, Escalation[]>();
  for (const item of escalations) {
    byPath.set(item.field_path_cluster, [
      ...(byPath.get(item.field_path_cluster) ?? []),
      item,
    ]);
  }
  return [...byPath.entries()].map(([path, items]) => ({
    path,
    items,
    open: items.filter((item) => item.resolution === null),
  }));
}

/**
 * ESCALATION INBOX — a rules backlog. Every item is a reviewer saying "I do not
 * know the rule", and the answer to that is never an answer: it is a rule.
 *
 * OPEN IS `resolution === null`, read off the record. There is no status field
 * in the contract and the client invents none — a locally-tracked "resolved"
 * flag would survive a failed POST and quietly hide an unanswered wall.
 *
 * AN EMPTY INBOX IS A FACT; A PENDING ONE IS NOT. `EmptyPanel` renders only
 * below the two guards above it, where the list has come back and come back
 * with nothing in it. The in-flight and failed cases keep their own lines: an
 * empty-state panel drawn while the request is still out would tell a reviewer
 * that nobody is stuck at the one moment the app has no idea, and once the two
 * look alike there is no reading that tells them apart again.
 *
 * THIS IS A HELD SCREEN AND SAYS SO IN AMBER. The design of record's register
 * is unmistakable — an amber kicker over the h1 and an amber edge on the card
 * in question — and this screen carried none of it: navy on paper, with nothing
 * stating that escalated work is stopped. The kicker is the design's, the shape
 * beneath it is the inbox (conflict C21: `GET /api/escalations` returns a
 * `field_path_cluster` on every row and the contract has no per-field
 * escalation record, so the per-field screen the export draws is unbuildable).
 *
 * NO SIGNATURE ITALIC ON THIS HEADING, DELIBERATELY. The mockup's device sets
 * the CLOSING PHRASE of a heading in Fraunces italic — `Work comes <em>to
 * you.</em>`, `Client settings & <em>overrides</em>` — and it works because
 * there is a phrase there carrying the screen's argument. "Escalation inbox" is
 * a two-word compound noun naming a place; the only candidates are "inbox",
 * which is the least interesting word on the screen, and the whole title, which
 * is the failure the device's own rule warns about. An emphasis with nothing to
 * emphasise reads as decoration, and decoration is what spends a signature.
 *
 * IT HAS AN `<h1>` NOW. `ScreenTitle` renders the kicker alone, so the largest
 * heading on the page was a 10px caption and the next thing under it was a
 * dotted machine path — a screen that read as a caption followed by an
 * identifier. `ScreenHeading` draws the export's pair and keeps the hub link
 * and `data-testid="screen-title"` that `ux.spec` asserts.
 */
export function EscalationsScreen() {
  const escalations = useQuery(escalationsQuery);
  const rules = useQuery(rulesQuery);
  const [selected, setSelected] = useState<string | null>(null);

  if (escalations.isError) {
    return (
      <ScreenMessage tone="halt" measure="1340">
        Inbox unavailable.
      </ScreenMessage>
    );
  }
  if (escalations.isPending) {
    return <ScreenMessage measure="1340">Loading the inbox…</ScreenMessage>;
  }

  const clusters = clusterBy(escalations.data.escalations);
  const fallback = clusters.find((c) => c.open.length > 0) ?? clusters[0];
  const current = clusters.find((c) => c.path === selected) ?? fallback;

  return (
    <Screen measure="1340">
      <div className="flex flex-col gap-8">
        <ScreenHeading
          /*
           * The colour rides on a child rather than on `Eyebrow`'s own `tone`
           * because the kicker is also the hub link and `ScreenHeading` owns
           * that arrangement (ux.spec #7) — the alternative was a second copy
           * of the masthead here, which is the failure the component exists to
           * prevent. Amber because this screen is HELD work, not a live step.
           */
          eyebrow={
            <span className="text-state-attend-ink">
              Held · escalated · senior review
            </span>
          }
          title="Escalation inbox"
          lede={
            <p>
              A rules backlog — every item is a reviewer saying &ldquo;I don&rsquo;t
              know the rule&rdquo;. Answering one order is not the job; writing the rule
              that answers the next fifty is.
            </p>
          }
        />

        {current === undefined ? (
          <EmptyPanel title="No escalations. Nobody is stuck." />
        ) : (
          /* The archive's two columns: a 380px rail and a detail column capped
             at 880px. Unmeasured, the resolve card ran to ~840px and its
             instruction ruled one unbroken line across the window. */
          <div className="grid gap-8 lg:grid-cols-[23.75rem_1fr]">
            <ClusterRail
              clusters={clusters}
              selected={current.path}
              onSelect={setSelected}
            />
            <ClusterDetail
              cluster={current}
              rules={rules.data?.rules ?? []}
              onResolved={() => setSelected(current.path)}
            />
          </div>
        )}
      </div>
    </Screen>
  );
}
