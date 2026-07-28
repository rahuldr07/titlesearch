import { ScreenTitle } from "../../app/ScreenTitle";
import { Button } from "../../shared/ui/Button";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { useSession } from "../../shared/session";
import { GateClosedBanner, GateOpenBanner } from "./GateBanner";
import { GapCard } from "./GapCard";
import { ProductChangeLogCard } from "./ProductChangeLogCard";
import { useGateState } from "./useGateState";
import { GAPS, PERIOD_BADGE, PRODUCT_NAME, RECORDED_WHEN } from "./gapFixtures";

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
 * THE GATE IS THE SERVER'S. This screen renders gaps and closures; it never
 * decides whether the package is complete. The banner that follows from having
 * no open gaps is a rendering of the fixture set, not a verdict computed here —
 * and when there is a real gate, that state arrives with the gaps.
 *
 * CONTRACT GAP: no completeness-gate resource of any kind in
 * `packages/contract` — no gate, gap, closure, supplemental upload, sign-off
 * amendment, root-of-title assertion, product change or order-history write.
 * The gaps are fixtures (`gapFixtures.ts`) and the closures are local state
 * (`useGateState.ts`); nothing survives a reload.
 *
 * CONTRACT GAP: "Resume processing" has nothing to call. It is rendered
 * enabled/disabled exactly as the design does, without a mutation behind it.
 */
export function CompletenessScreen() {
  const role = useSession((session) => session.role);
  const actor = useSession((session) => session.actor);
  const gate = useGateState();

  /** The design's rule: the client paid for this product, so senior/ops only. */
  const canChangeProduct = role === "senior" || role === "ops" || role === "admin";
  const openGaps = GAPS.filter((gap) => gate.closures[gap.id] === undefined).length;
  const recordedBy = `${actor} (${role}) · ${RECORDED_WHEN}`;

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
        <span className="text-md font-semibold">{PRODUCT_NAME}</span>
        <Chip tone="action" size="sm" shape="mono" bordered className="normal-case">
          {PERIOD_BADGE}
        </Chip>
      </div>

      {openGaps > 0 ? <GateOpenBanner /> : <GateClosedBanner packagePages={gate.packagePages} />}

      {GAPS.filter((gap) => gate.closures[gap.id]?.kind !== "product-changed").map((gap) => (
        <GapCard
          key={gap.id}
          gap={gap}
          closure={gate.closures[gap.id]}
          packagePages={gate.packagePages}
          canChangeProduct={canChangeProduct}
          onUpload={() => gate.upload(gap)}
          onAmend={() => gate.amend(gap)}
          onRecordRoot={(comment) => gate.recordRoot(gap, comment, recordedBy)}
          onChangeProduct={(target, reason) => gate.changeProduct(gap, target, reason, recordedBy)}
        />
      ))}

      {gate.productChange === null ? null : (
        <ProductChangeLogCard record={gate.productChange} />
      )}

      <div className="flex items-center gap-7">
        <p
          className={
            openGaps > 0 ? "flex-1 text-sm text-ink-secondary" : "flex-1 text-sm text-state-settled-ink"
          }
        >
          {openGaps > 0
            ? `${openGaps} gap${openGaps === 1 ? "" : "s"} still open. Close each to resume — nothing has been extracted yet.`
            : "All gaps closed. Extraction will run on the full package."}
        </p>
        <Button size="lg" disabled={openGaps > 0}>
          Resume processing →
        </Button>
      </div>
    </div>
  );
}
