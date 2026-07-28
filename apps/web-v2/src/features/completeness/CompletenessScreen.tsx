import { useQuery } from "@tanstack/react-query";
import { ScreenTitle } from "../../app/ScreenTitle";
import { Button } from "../../shared/ui/Button";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
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
 * CONTRACT GAP: `close_options` are opaque strings with no kind, so the role
 * gate the design put on changing the product — the client paid for it, senior
 * and ops only — cannot be applied without matching on the server's copy. It is
 * left off rather than faked.
 */
export function CompletenessScreen() {
  const actor = useSession((session) => session.actor);
  const role = useSession((session) => session.role);
  const gate = useGateState();
  const { data, isPending, isError } = useQuery(orderCompletenessQuery(COMPLETENESS_ORDER_ID));

  if (isError) return <p className="text-base text-state-halt-ink">Completeness gate unavailable.</p>;
  if (isPending) return <p className="text-base text-ink-secondary">Loading the gate…</p>;

  const openGaps = data.gaps.filter(
    (gap) => gap.closed_by === null && gate.closures[gap.id] === undefined,
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <ScreenTitle>Between segment &amp; extract</ScreenTitle>
        <h1 className="text-3xl font-semibold">Completeness gate</h1>
        <p className="text-md leading-body text-ink-secondary">
          Your intake claims, checked against what was actually segmented —
          before a single field is extracted.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-5">
        <Eyebrow variant="caption">Product ordered</Eyebrow>
        <span className="text-md font-semibold">{data.product_name}</span>
        <Chip tone="action" size="sm" shape="mono" bordered className="normal-case">
          {data.period_label}
        </Chip>
      </div>

      {data.gate_open ? <GateOpenBanner /> : <GateClosedBanner />}

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
  );
}
