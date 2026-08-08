import { Link } from "@tanstack/react-router";
import { ScreenFailure } from "../../shared/ui/ScreenFailure";
import { buttonClasses } from "../../shared/ui/buttonClasses";
import { Screen } from "../../shared/ui/Screen";
import { cn } from "../../shared/ui/classNames";

/**
 * The guard around the CONFIG SURFACE — products, rulebook, states gallery.
 *
 * Those three screens share one view-model, so a throw while building it takes
 * all three down together. The design wraps exactly that seam and no more,
 * which is the point worth preserving: a blast radius of three screens is a
 * deliberate choice, not a leftover. Widening the guard to the whole app would
 * mean one bad rule row blanks the queue; narrowing it per-screen would mean
 * three copies of the same failure and no signal that they are one fault.
 *
 * The card copy is `ScreenFailure`'s, unchanged, and it must stay shared:
 * "rather than showing a blank that could be mistaken for real configuration"
 * is orphan rule O6, and it bites hardest HERE. A half-built rulebook that
 * renders as an empty list looks exactly like a rulebook with no rules in it —
 * and someone acting on that difference is how a live rule gets re-authored.
 *
 * The two additions below the card are what this seam needs and the generic
 * component should not carry: WHERE the detail is (console, with the stack —
 * this screen never prints one, because a stack on screen is noise to the
 * person reading it and a gift to anyone else), and a way OUT that does not
 * require guessing which screens still work.
 */
export function SurfaceFailureScreen({
  reference,
}: {
  reference?: string | undefined;
}) {
  return (
    <Screen measure="440" pad="40" placement="centre">
      <div data-testid="surface-failure" className="flex flex-col gap-6">
        <ScreenFailure reference={reference} />

        <p className="text-xs leading-open text-ink-muted">
          The error is in the console with its stack. Reload, or switch to another
          screen and back.
        </p>

        <div>
          <Link to="/queue" className={cn(buttonClasses({ size: "lg" }))}>
            Back to the queue
          </Link>
        </div>
      </div>
    </Screen>
  );
}
