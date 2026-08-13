import { useQuery } from "@tanstack/react-query";
import type { OrderCompletenessResponse } from "@titlepipe/contract";
import { GateClosedBanner, GateOpenBanner } from "../../entities/order/GateBanner";
import { OrderContextRow } from "../../entities/order/OrderContextRow";
import { Button } from "../../shared/ui/Button";
import { Screen } from "../../shared/ui/Screen";
import { ScreenHeading } from "../../shared/ui/ScreenHeading";
import { ScreenMessage } from "../../shared/ui/ScreenMessage";
import { useSession } from "../../shared/session";
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
 * RULE: `gate_open` IS THE VERDICT and this screen only renders it. FAILURE
 * PREVENTED: a "Gate verdict · local preview" toggle used to ride in the order
 * row, and switching it to Closed drew "Package complete — every gap is closed"
 * directly above three cards still stamped GAP with their close buttons live —
 * a screen stating the opposite of what it shows. The banner pair now lives in
 * `entities/order/GateBanner`; the rendering no fixture reaches is catalogued
 * on `features/gallery`, which exists for exactly that.
 *
 * Closing every card here records intent, and the gate re-runs on the server or
 * not at all.
 *
 * CONTRACT GAP: no closure write of any kind — no supplemental upload, no
 * sign-off amendment, no root-of-title assertion, no product change, no resume.
 * Closures are local state and vanish on reload; "Resume processing" is drawn
 * as the design draws it and disabled.
 *
 * CONTRACT GAP: the response carries no open-gap count, so the footer sentence
 * counts the cards this screen is holding. It is a statement about this screen,
 * not the gate's own tally, and it must never be read as one — which is why it
 * never touches the banner above it.
 */
export function CompletenessScreen() {
  const { data, isPending, isError } = useQuery(
    orderCompletenessQuery(COMPLETENESS_ORDER_ID),
  );

  if (isError)
    return (
      <ScreenMessage tone="halt" measure="720">
        Completeness gate unavailable.
      </ScreenMessage>
    );
  if (isPending) return <ScreenMessage measure="720">Loading the gate…</ScreenMessage>;

  return <GateBody gate={data} />;
}

function GateBody({ gate: data }: { gate: OrderCompletenessResponse }) {
  const actor = useSession((session) => session.actor);
  const role = useSession((session) => session.role);
  const gate = useGateState();

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
            cannot disagree about what was ordered. Its trailing slot is empty
            here on purpose: the design's product row is eyebrow, product and
            period badge and nothing else.

            THE GATE'S CAPTION IS `PRODUCT ORDERED`, which is what the export
            writes here — Review's strip says `ORDERED` for the same pair, and
            this screen was printing Review's word. The difference is carried by
            a prop rather than a second copy of the row: forking the component
            over one caption is how the row came to exist three ways, one of
            them fabricated. */}
        <OrderContextRow
          label="PRODUCT ORDERED"
          productName={data.product_name}
          periodLabel={data.period_label}
        />

        {data.gate_open ? <GateOpenBanner /> : <GateClosedBanner />}

        {data.gaps.map((gap) => (
          <GapCard
            key={gap.id}
            gap={gap}
            closure={gate.closures[gap.id]}
            onClose={(option, note) =>
              gate.close(gap.id, { option, note, by: `${actor} (${role})` })
            }
          />
        ))}

        {/*
          THE BLOCKED CASE IS SET IN HALT INK, the resolved case in settled ink
          (design :3753, `resumeNoteColor`). Drawn in the secondary grey it used
          to wear, the one sentence saying the run is still stopped was the
          quietest text in the footer — beside a disabled button, which reads as
          a control that is merely unavailable rather than a run that is held.
        */}
        <div className="flex items-center gap-7">
          <p
            className={
              openGaps > 0
                ? "flex-1 text-sm text-state-halt-ink"
                : "flex-1 text-sm text-state-settled-ink"
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
