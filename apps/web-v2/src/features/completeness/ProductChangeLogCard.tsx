import { Eyebrow } from "../../shared/ui/Eyebrow";
import type { ProductChangeRecord } from "./useGateState";

/**
 * The product change, restated on the screen that caused it.
 *
 * It stays visible here rather than only in the order's history because this is
 * where it will be questioned: the gap it closed is gone, and without this card
 * the run simply looks complete. Attend, not settled — the gate passing on a
 * shortened product is not the same outcome as the gate passing.
 *
 * The reason is set in serif, this codebase's marker for a person's own words
 * as against machine output.
 */
export function ProductChangeLogCard({ record }: { record: ProductChangeRecord }) {
  return (
    <section className="rounded-9 border border-state-attend-border border-l-(length:--stroke-severity) border-l-state-attend bg-state-attend-surface px-8 py-6">
      <Eyebrow variant="field" as="h2" tone="attend" className="mb-2">
        Product changed · recorded on the order
      </Eyebrow>
      <p className="text-base leading-body text-ink-primary">
        <span className="font-semibold">
          {record.from} → {record.to}
        </span>{" "}
        · {record.by} · {record.when}
      </p>
      <p className="mt-2 font-quote text-sm text-ink-secondary">Reason: {record.reason}</p>
    </section>
  );
}
