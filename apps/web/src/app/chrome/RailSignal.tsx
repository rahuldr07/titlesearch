import { cx } from "../../components/ui";

/**

 * The two things that ride a door, and they are not interchangeable. The design's rail

 * carries `35` on All Orders, `6` on Examination, `1 QC` on QC & Escalations and

 * `v4.2` on Templates Architect.

 */

/**

 * A VOLUME. Mono per rule 3 — a count is data — and tabular so the capsule does not

 * resize between 9 and 10.

 */
export function RailCount(props: { readonly value: number; readonly label: string }) {
  return (
    <span
      data-testid="rail-count"
      // The count is decoration beside a door whose LABEL already names the
      // screen; `aria-label` gives the figure its unit so a screen reader hears
      // "All orders, 13 orders" and not "All orders, 13".
      aria-label={props.label}
      className={cx(
        "ml-auto shrink-0 rounded-pill bg-rail-line px-4 py-1",
        "font-mono text-label font-semibold leading-flat tabular-nums text-rail-ink",
      )}
    >
      {props.value}
    </span>
  );
}

/**

 * AN ATTENTION DOT — rule 66's replacement for a workload count. `title` carries what

 * the dot MEANS in words, because a coloured circle is not a sentence and the count it

 * replaced at least said "1".

 */
export function RailDot(props: {
  readonly path: string;
  readonly title: string;
  readonly tone: "attend" | "halt";
}) {
  return (
    <span
      data-testid={`rail-dot-${props.path}`}
      title={props.title}
      role="img"
      aria-label={props.title}
      className={cx(
        "ml-auto size-3 shrink-0 rounded-pill",
        props.tone === "halt" ? "bg-state-halt" : "bg-state-attend",
      )}
    />
  );
}
