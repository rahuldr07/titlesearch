import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { OrderCompletenessResponse } from "@titlepipe/contract";
import { OrderContextRow } from "../../entities/order/OrderContextRow";
import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { Screen } from "../../shared/ui/Screen";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";
import { Toggle, ToggleGroup } from "../../shared/ui/ToggleGroup";
import { useSession } from "../../shared/session";
import { GateClosedBanner, GateOpenBanner } from "./GateBanner";
import { GapCard } from "./GapCard";
import { useGateState } from "./useGateState";
import { COMPLETENESS_ORDER_ID, orderCompletenessQuery } from "./queries";

/**
 * THE COMPLETENESS GATE — the run stops here, between segmentation and
 * extraction, and does not move until every gap is closed.
 *
 * WHY THE STOP IS PLACED EXACTLY HERE: extraction is where the money goes. A
 * package that contradicts the intake claims will produce fields nobody can
 * rely on, at full cost, and the person who could have spotted it will only see
 * the result days later at review. Halting after segmentation buys the check
 * for nothing — the pages are already classified, and nothing has been
 * extracted, so closing a gap and resuming costs one run of the cheap half.
 *
 * THE GATE IS THE SERVER'S. `gate_open` decides which banner renders; the count
 * of gaps still open on this screen never does. Closing every card here records
 * intent, and the gate re-runs on the server or not at all.
 *
 * CONTRACT GAP: no closure write of any kind — no supplemental upload, no
 * sign-off amendment, no root-of-title assertion, no product change, no resume.
 * Closures are local state and vanish on reload; "Resume processing" is drawn
 * as the design draws it and disabled.
 *
 * Since 2026-07-30 `close_options` carry their kind, their consequence, whether
 * they require a comment and the `min_role` the server requires — so the role
 * gate the design put on changing the product is the server's fact rather than
 * a match on its copy. Applying it to the control is Wave 4's; the wire is here.
 */
export function CompletenessScreen() {
  const { data, isPending, isError } = useQuery(orderCompletenessQuery(COMPLETENESS_ORDER_ID));

  if (isError) return <ScreenMessage tone="halt" measure="720">Completeness gate unavailable.</ScreenMessage>;
  if (isPending) return <ScreenMessage measure="720">Loading the gate…</ScreenMessage>;

  return <GateBody gate={data} />;
}

/**
 * Mounted only once the gate has arrived, so the banner preview can be SEEDED
 * FROM THE SERVER'S `gate_open` instead of guessing and correcting itself.
 *
 * THE PREVIEW IS NOT A SECOND GATE. Closing every card on this screen still
 * does not flip the banner, and neither does an empty gap list — the verdict
 * arrives as its own field precisely so no screen can reach it by counting.
 * This control is labelled as what it is, a local view of the other rendering,
 * because the closed state is otherwise unreachable and an unreachable state
 * is one nobody can check.
 */
function GateBody({ gate: data }: { gate: OrderCompletenessResponse }) {
  const actor = useSession((session) => session.actor);
  const role = useSession((session) => session.role);
  const gate = useGateState();
  const [gateOpen, setGateOpen] = useState(data.gate_open);

  const openGaps = data.gaps.filter(
    (gap) => gap.closed_by === null && gate.closures[gap.id] === undefined,
  ).length;

  return (
    <Screen measure="720" pad="32x40">
      <div className="flex flex-col gap-6">
        <ScreenHeading
          eyebrow="Between segment & extract"
          title="Completeness gate"
          lede="Your intake claims, checked against what was actually segmented — before a single field is extracted."
        />

        {/* One row, shared with the delivered screen and Review, so the three
            cannot disagree about what was ordered. The local-preview toggle
            rides in the trailing slot exactly as it stood; moving it to
            features/gallery is Wave 4's, not this row's. */}
        <OrderContextRow
          productName={data.product_name}
          periodLabel={data.period_label}
          trailing={
            <div className="flex items-center gap-4">
              <Eyebrow variant="caption">Gate verdict · local preview</Eyebrow>
              <ToggleGroup
                aria-label="Gate verdict (local preview)"
                value={[gateOpen ? "open" : "closed"]}
                onValueChange={(value) => setGateOpen(value[0] !== "closed")}
              >
                <Toggle value="open">Open</Toggle>
                <Toggle value="closed">Closed</Toggle>
              </ToggleGroup>
            </div>
          }
        />

        {gateOpen ? <GateOpenBanner /> : <GateClosedBanner />}

        {data.gaps.map((gap) => (
          <GapCard
            key={gap.id}
            gap={gap}
            closure={gate.closures[gap.id]}
            onClose={(option, note) => gate.close(gap.id, { option, note, by: `${actor} (${role})` })}
          />
        ))}

        <div className="flex items-center gap-7">
          <p
            className={
              openGaps > 0 ? "flex-1 text-sm text-ink-secondary" : "flex-1 text-sm text-state-settled-ink"
            }
          >
            {openGaps > 0
              ? `${openGaps} gap${openGaps === 1 ? "" : "s"} still open. Close each to resume — nothing has been extracted yet.`
              : "Every gap has a closure recorded here. Re-running the gate is the server's, and nothing on this screen reopens it."}
          </p>
          <Button size="lg" disabled>
            Resume processing →
          </Button>
        </div>
      </div>
    </Screen>
  );
}
