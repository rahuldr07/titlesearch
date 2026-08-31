import { cx } from "../../components/ui";

/**
 * The server's lifecycle word, taken whole. `tone` drives the paint and
 * nothing else; `label` is a free string on purpose — an enum here would be
 * an invitation to `switch` on a lifecycle word, which is the client state
 * machine moved one line down.
 */
const TONE = {
  neutral: "border-line-strong bg-surface-sunken text-ink-secondary",
  action: "border-action-border bg-action-surface text-action",
  settled: "border-state-settled-border bg-state-settled-surface text-state-settled",
  attend: "border-state-attend-border bg-state-attend-surface text-state-attend",
  halt: "border-state-halt-border bg-state-halt-surface text-state-halt",
} as const;

export type OrderStampTone = keyof typeof TONE;

export function OrderStamp(props: {
  readonly stamp: { readonly label: string; readonly tone: OrderStampTone };
}) {
  return (
    <span
      data-testid="order-stamp"
      // The tone is the server's: taking the label from the wire and then
      // choosing our own colour would re-implement half the lifecycle
      // machine while looking obedient.
      data-tone={props.stamp.tone}
      className={cx(
        "ml-auto rounded-pill border px-6 py-2 text-label font-semibold leading-flat",
        TONE[props.stamp.tone],
      )}
    >
      {props.stamp.label}
    </span>
  );
}
