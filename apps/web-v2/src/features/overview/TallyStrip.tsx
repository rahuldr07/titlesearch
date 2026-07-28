import { Card } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { cn } from "../../shared/ui/classNames";

/**
 * Four figures, and every one of them is a CENSUS — how many orders are sitting
 * where, right now. None is a rate, a throughput, an average or a target.
 *
 * That distinction is the reason "Stopped on a person" is drawn in violet
 * rather than red. It is not a backlog and not a failure: most of the pipeline
 * is meant to be waiting on somebody, and colouring it as an alarm would teach
 * everyone to read the normal operation of the product as a problem.
 *
 * "Off the pipeline" is the only halt-coloured figure, because it is the only
 * one where the order is in no stage at all and nothing will move it.
 *
 * The figures arrive from the server. This component adds nothing up.
 */
export function TallyStrip({
  total,
  halted,
  moving,
  failed,
}: {
  total: number;
  halted: number;
  moving: number;
  failed: number;
}) {
  return (
    <Card className="flex flex-wrap">
      <Tally value={total} label="Orders in flight" divided />
      <Tally value={halted} label="Stopped on a person" ink="text-action" divided />
      <Tally value={moving} label="Moving on its own" ink="text-ink-secondary" divided />
      <Tally value={failed} label="Off the pipeline" ink="text-state-halt-ink" />
    </Card>
  );
}

function Tally({
  value,
  label,
  ink = "text-ink-primary",
  divided = false,
}: {
  value: number;
  label: string;
  ink?: string;
  divided?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex-1 basis-75 px-8 py-6",
        divided && "border-r border-line-subtle",
      )}
    >
      <p className={cn("font-mono text-3xl leading-flat font-semibold", ink)}>{value}</p>
      <Eyebrow variant="stat" className="mt-2 block">{label}</Eyebrow>
    </div>
  );
}
