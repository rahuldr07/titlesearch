import type { Reconciliation } from "@titlepipe/contract";
import { cn } from "../../shared/ui/classNames";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * TWO INDEPENDENT READINGS, SIDE BY SIDE AND EQUALLY WEIGHTED.
 *
 * THE MACHINE IS NOT A PARTY TO THIS CONVERSATION — its draft appears nowhere on
 * this screen, and neither does any engine's name. This is the screen that
 * produces the ground truth the machine is graded against; showing its answer
 * here would make the grading circular in exactly the way that is hardest to
 * notice afterwards.
 *
 * CONTRACT GAP: `Reconciliation` carries `value_a` and `value_b` and nothing
 * else per side. The design's per-side citations, confidences, page numbers and
 * highlights have no shape in the contract, so the cards are bare values rather
 * than invented provenance.
 */
export function PickPanel({
  divergence,
  pick,
  onPick,
}: {
  divergence: Reconciliation;
  pick: "A" | "B" | "third" | null;
  onPick: (pick: "A" | "B" | "third") => void;
}) {
  const path = divergence.path;

  const side = (which: "A" | "B", value: string | null) => (
    <button
      type="button"
      data-testid={`pick-${which}-${path}`}
      aria-pressed={pick === which}
      onClick={() => onPick(which)}
      className={cn(
        "flex flex-col gap-2 rounded-5 border p-6 text-left",
        pick === which
          ? "border-action bg-action-surface"
          : "border-line-strong bg-surface-panel",
      )}
    >
      <Eyebrow variant="caption">Typist {which}</Eyebrow>
      <span className="font-mono text-md text-ink-primary">{value ?? "—"}</span>
    </button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {side("A", divergence.value_a)}
        {side("B", divergence.value_b)}
      </div>
      <div>
        <button
          type="button"
          aria-pressed={pick === "third"}
          onClick={() => onPick("third")}
          className={cn(
            "rounded-5 border border-dashed px-6 py-3 text-xs",
            pick === "third"
              ? "border-action text-action"
              : "border-line-strong text-ink-secondary",
          )}
        >
          both are wrong — enter a third value
        </button>
      </div>
    </div>
  );
}
