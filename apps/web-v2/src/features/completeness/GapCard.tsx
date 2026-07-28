import { Card, CardBody, CardHeader } from "../../shared/ui/Card";
import { Chip, type ChipProps } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";
import { GapCloseOptions } from "./GapCloseOptions";
import { GapClosedNote } from "./GapClosedNote";
import type { Gap } from "./gapFixtures";
import type { GapClosure } from "./useGateState";

/**
 * One disagreement, laid out as claim against finding.
 *
 * THE TWO LINES ARE DELIBERATELY SYMMETRICAL. "You said" and "We found" get the
 * same label column and the same weight, because the screen is not entitled to
 * decide which one is right — the machine misses documents that are plainly in
 * the package, and a layout that presented the finding as the correction would
 * teach people to amend answers that were true.
 *
 * PROVISIONAL IS LOUDER THAN THE FINDING IT QUALIFIES. Where the check behind a
 * card cannot be trusted yet, the card says so in a dashed attend block rather
 * than a footnote — a gate that halts a run on evidence it cannot vouch for
 * must be the one to admit it.
 */
const STATUS: Record<GapClosure["kind"], { label: string; tone: ChipProps["tone"] }> = {
  uploaded: { label: "Closed · document added", tone: "settled" },
  amended: { label: "Closed · answer amended", tone: "action" },
  rooted: { label: "Closed · root of title", tone: "settled" },
  "product-changed": { label: "Closed · product changed", tone: "attend" },
};

export function GapCard({
  gap,
  closure,
  packagePages,
  canChangeProduct,
  onUpload,
  onAmend,
  onRecordRoot,
  onChangeProduct,
}: {
  gap: Gap;
  closure: GapClosure | undefined;
  packagePages: number;
  canChangeProduct: boolean;
  onUpload: () => void;
  onAmend: () => void;
  onRecordRoot: (comment: string) => void;
  onChangeProduct: (target: string, reason: string) => void;
}) {
  const status =
    closure === undefined
      ? { label: gap.openStatusLabel, tone: "halt" as const }
      : STATUS[closure.kind];

  return (
    <Card
      className={cn(
        "border-l-(length:--stroke-severity)",
        closure === undefined ? "border-l-state-halt" : "border-l-state-settled",
      )}
    >
      <CardHeader>
        <h2 className="text-md font-semibold">{gap.title}</h2>
        <Chip className="ml-auto" shape="pill" size="micro" tone={status.tone}>
          {status.label}
        </Chip>
      </CardHeader>

      <CardBody className="flex flex-col gap-6">
        {closure === undefined ? (
          <>
            <div className="flex gap-5">
              <Eyebrow variant="field" as="p" className="basis-42 shrink-0">
                You said
              </Eyebrow>
              <p className="text-base leading-body text-ink-primary">{gap.claimText}</p>
            </div>

            <div className="flex gap-5">
              <Eyebrow variant="field" as="p" tone="halt" className="basis-42 shrink-0">
                We found
              </Eyebrow>
              <p className="text-base leading-body text-state-halt-ink">{gap.foundText}</p>
            </div>

            {gap.provisionalNote === null ? null : (
              <div className="flex gap-5 rounded-7 border border-dashed border-state-attend bg-state-attend-surface px-6 py-5">
                <Eyebrow variant="field" as="p" tone="attend" className="basis-42 shrink-0">
                  Provisional
                </Eyebrow>
                <p className="text-xs leading-open text-ink-secondary">{gap.provisionalNote}</p>
              </div>
            )}

            <GapCloseOptions
              gap={gap}
              canChangeProduct={canChangeProduct}
              onUpload={onUpload}
              onAmend={onAmend}
              onRecordRoot={onRecordRoot}
              onChangeProduct={onChangeProduct}
            />
          </>
        ) : (
          <GapClosedNote gap={gap} closure={closure} packagePages={packagePages} />
        )}
      </CardBody>
    </Card>
  );
}
