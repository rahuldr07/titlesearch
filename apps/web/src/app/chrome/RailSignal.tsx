import { cx } from "../../components/ui";

/**

 * The one signal that rides a door. `RailCount` — a volume capsule the design's

 * rail carries (`35` on All Orders, `6` on Examination) — used to live beside

 * this and was DELETED, not rehomed: INVARIANT 66 says attention rides the

 * doors as dots, never counts, and its only call site was a `/dashboard` door

 * `doors.ts` does not contain.

 */

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
