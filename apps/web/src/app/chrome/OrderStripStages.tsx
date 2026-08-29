import { useQuery } from "@tanstack/react-query";
import { orderPipeline } from "../../shared/queries";
import { get } from "../../shared/api";
import { cx } from "../../components/ui";
import { StageMark } from "./StageMark";

/**
 * The strip's second row — the design's stage tabs, on the same server list the
 * rail draws and with the same positional numerals.
 *
 * THEY ARE NOT TABS. The design's tabs navigate; no route in this app addresses
 * a stage, and a control that looks like a tab and moves nothing is a lie about
 * what it does. This is an ordered list with the tab's chrome.
 *
 * It WRAPS rather than dropping stages, shortening their labels or scrolling
 * sideways: nine server-written labels do not fit a 1600px strip, and the first
 * two alternatives are the browser editing the server's words while the third
 * clips them out of sight. The design's own first row wraps for the same reason.
 */
export function OrderStripStages(props: { readonly orderId: string }) {
  const descriptor = orderPipeline(props.orderId);
  const pipeline = useQuery({
    queryKey: descriptor.key,
    queryFn: () => get(descriptor.path, descriptor.schema),
  });

  if (pipeline.data === undefined) return null;

  return (
    <ol
      data-testid="order-strip-stages"
      className="flex flex-wrap items-center gap-2 border-t border-line-faint pt-4"
    >
      {pipeline.data.stages.map((stage, index) => (
        <li
          key={stage.id}
          data-slot="strip-stage"
          data-phase={stage.phase}
          className={cx(
            "flex shrink-0 items-center gap-4 rounded-lg px-6 py-2",
            "text-meta leading-flat whitespace-nowrap",
            stage.phase === "running"
              ? "bg-action-surface font-bold text-ink-secondary"
              : "font-medium text-ink-muted",
          )}
        >
          <StageMark phase={stage.phase} ordinal={index + 1} ground="strip" />
          {stage.label}
        </li>
      ))}
    </ol>
  );
}
