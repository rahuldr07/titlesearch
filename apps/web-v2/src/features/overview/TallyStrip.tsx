import { Card } from "../../shared/ui/Card";
import { CensusTile } from "../../shared/ui/CensusTile";

/**
 * Four figures, and every one of them is a CENSUS — how many orders are sitting
 * where, right now. None is a rate, a throughput, an average or a target.
 *
 * The NAME of the primitive is what keeps it that way. This drew its own private
 * `Tally`, whose `value`/`label`/`ink` signature would have accepted a rate
 * without complaint — nothing in it argued against one. `CensusTile` is the same
 * markup with the refusal built into what it is called, so the next request for
 * an orders-per-hour figure has to be made against the component's name.
 *
 * That distinction is the reason "Stopped on a person" is drawn in violet
 * rather than red. It is not a backlog and not a failure: most of the pipeline
 * is meant to be waiting on somebody, and colouring it as an alarm would teach
 * everyone to read the normal operation of the product as a problem.
 *
 * "Off the pipeline" is the only halt-coloured figure, because it is the only
 * one where the order is in no stage at all and nothing will move it.
 *
 * "Moving on its own" is the one deliberately RECEDED figure: it is the column
 * nobody has to act on, and it must not out-shout the one that needs a person.
 * `tone="muted"` is that choice stated, where the old free-form `ink` prop left
 * it as a colour somebody happened to pass.
 *
 * The figures arrive from the server. This component adds nothing up, and
 * `CensusTile` cannot — it has no arithmetic in it at all.
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
      <CensusTile value={total} caption="Orders in flight" edge />
      <CensusTile value={halted} caption="Stopped on a person" tone="action" edge />
      <CensusTile value={moving} caption="Moving on its own" tone="muted" edge />
      <CensusTile value={failed} caption="Off the pipeline" tone="halt" />
    </Card>
  );
}
