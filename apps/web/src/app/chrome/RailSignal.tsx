import { cx } from "../../components/ui";

/**
 * THE TWO THINGS THAT RIDE A DOOR, AND THEY ARE NOT INTERCHANGEABLE.
 *
 * ══ THE DESIGN ASKS FOR FOUR COUNT BADGES. TWO ARE BUILT. ═══════════════════
 *
 * The design's rail carries `35` on All Orders, `6` on Examination, `1 QC` on
 * QC & Escalations and `v4.2` on Templates Architect. `INVARIANTS:174` (rule
 * 66) reads, verbatim: "Attention rides the doors as DOTS, NEVER COUNTS."
 *
 * These do not contradict each other once you separate the two kinds of number
 * the design draws with one capsule:
 *
 *   - A VOLUME — "there are 13 orders in the shop". It describes the world, it
 *     is the same for everyone who may see it, and looking at it does not ask
 *     you to do anything. `35` is this. It is BUILT, as `RailCount`, and it is
 *     the server's own `total` from `GET /api/lifecycle` — never
 *     `orders.length`, because the list is role-scoped and the census is not
 *     (`intake.ts:218-221`), so a count derived from the array would SHRINK as
 *     your permissions narrow and read as work disappearing.
 *
 *   - AN ATTENTION COUNT — "6 fields await your ruling", "1 QC determination is
 *     yours". It is a WORKLOAD, it is personal, and rule 66 exists precisely to
 *     stop the rail becoming a tally of how far behind you are. `6` and `1 QC`
 *     are this. They are REFUSED, and the attention becomes a DOT: the door
 *     still says "something is waiting here", which is the whole navigational
 *     job, and the number lives on the screen that can explain it.
 *
 * `v4.2` is neither — it is a template version, and there is no Templates door
 * in `authz.ts:62-81` to hang it on. Absent for want of a screen, not refused.
 *
 * If rule 66 is meant to cover volumes too, then `RailCount` is the line to
 * delete and the design's `35` goes with it. That is the owner's ruling; it is
 * flagged here rather than decided quietly in a className.
 */

/**
 * A VOLUME. Mono per rule 3 — a count is data — and tabular so the capsule does
 * not resize between 9 and 10.
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
 * AN ATTENTION DOT — rule 66's replacement for a workload count.
 *
 * `title` carries what the dot MEANS in words, because a coloured circle is not
 * a sentence and the count it replaced at least said "1". The tone is the
 * server's own axis (`LifecycleStamp.tone`), never a client-side severity.
 *
 * Six pixels, not the design's eight: eight is the BRAND status dot's size in
 * the header, and two dots of the same size in one column that mean unrelated
 * things is exactly the icon soup rule 7 bans.
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
