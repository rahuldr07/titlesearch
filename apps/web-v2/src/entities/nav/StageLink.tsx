import { cn } from "../../shared/ui/classNames";

/**
 * THE SPINE BETWEEN TWO STAGES — the line the six flow discs are strung on.
 *
 * RULE: the segment's colour is the EARLIER stage's `done`, never this one's and
 * never "we are past it". FAILURE PREVENTED: a rail coloured from the active row
 * runs green all the way to wherever you happen to be standing — progress
 * claimed by navigation, which is exactly the progress nobody recorded. Ahead of
 * the current stage the line stays grey because the server has not said
 * otherwise.
 *
 * IT IS ABSOLUTE, AND IT SPANS CENTRE TO CENTRE. `-top-1/2 h-full` starts half a
 * row ABOVE its own — the previous disc's centre line — and ends at this disc's,
 * so consecutive segments abut exactly. Both percentages resolve against the
 * row wrapper's height, so this holds at either rail width and at any type size.
 *
 * THAT GEOMETRY IS THE FIX, not a refactor. The connector used to be an 8px box
 * laid out in the flow BETWEEN two rows, which left the ~10px above and below
 * each 20px disc unlined: the six stages drew as six ticks with dashes floating
 * between them, and a done step stopped reading as "behind you" because there
 * was no line for it to be behind you on.
 *
 * The first stage draws no segment and the last one's ends at its own centre —
 * the mockup's `:first-child{top:50%}` / `:last-child{bottom:50%}` arrived at
 * from the other direction. The line is bounded by the discs it connects rather
 * than running off the ends of the group.
 *
 * Named for the stage BELOW it (`rail-link-<path>`) so a test can ask "is the
 * line into Completeness filled?" without counting rows.
 */
export interface StageLinkProps {
  /** The stage below this segment — its testid, and how a test names it. */
  to: string;
  collapsed: boolean;
  /** The stage ABOVE this segment is done. Server-cited, never inferred. */
  filled: boolean;
}

export function StageLink({ to, collapsed, filled }: StageLinkProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute -top-1/2 flex h-full",
        // `left-12` is 24px — the row's 3px accent border plus its 21px padding
        // (`pl-10.5`) — and `w-10` below is the disc's own width, so
        // `justify-center` lands the 1px rule exactly on the disc's centre line.
        // It was `left-11.5`, carried over from a 20px inset the row no longer
        // has, which put the rule 1px left of every disc it runs into.
        collapsed ? "inset-x-0 justify-center" : "left-12",
      )}
    >
      <span
        data-testid={`rail-link-${to}`}
        data-done={filled ? "1" : "0"}
        className="flex w-10 justify-center"
      >
        <span className={cn("h-full w-px", filled ? "bg-state-settled" : "bg-line-strong")} />
      </span>
    </div>
  );
}
