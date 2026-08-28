import { cx } from "../../components/ui";

/**
 * THE SERVER'S LIFECYCLE WORD, TAKEN WHOLE.
 *
 * `tone` drives the paint and NOTHING ELSE (`intake.ts:290-294`). `label` is a
 * free string on purpose — an enum here would be an invitation to `switch` on a
 * lifecycle word, which is the client state machine moved one line down. The
 * strip that composed `signed_by === null ? "Not signed" : "Signed"` is what
 * this replaced.
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
      // The tone is the SERVER'S, and it is readable as such: a strip that took
      // the label from the wire and then chose its own colour would have
      // re-implemented half the lifecycle machine while looking obedient.
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
