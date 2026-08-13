import { Link } from "@tanstack/react-router"; // rules-allow: §6 bans a FETCH in entities/, and a <Link> is markup — the same precedent ScreenHeading sets; handing the anchor back to the caller would put this button's copy in two folders, which is the duplication the promotion removes
import { buttonClasses } from "../../shared/ui/buttonClasses";
import { cn } from "../../shared/ui/classNames";

/**
 * The one thing to do about a run, decided by the run's own `gate_halted`.
 *
 * RULE: the gate's outcome is the server's. FAILURE PREVENTED: /processing drew
 * a "Gate outcome · local preview" Halted/Passed toggle above this button, and
 * flipping it swapped the button while every stage row kept printing the phases
 * the server sent — so the button and the run it summarises contradicted each
 * other on screen. The control existed because the passed rendering is
 * unreachable on any fixture; the answer to an unreachable state is a catalogue
 * (`features/gallery`), not a switch on the production screen.
 *
 * IT LIVES IN `entities/` BECAUSE TWO FOLDERS NEED IT. `features/gallery` may
 * not import `features/processing`, and a copy in the catalogue would be a
 * catalogue that documents itself rather than the product — the exact drift the
 * gallery exists to catch. Promoting beat duplicating.
 *
 * THE CALL TO ACTION IS A LINK, NOT A SUBMIT. It never starts, resumes or
 * retries anything; it carries you to whichever screen is holding the run — the
 * completeness gate while the gate is halted, the order under review once it is
 * not. Both are registered routes, so drawing it disabled would have been a lie
 * about a journey the app can actually make.
 */
export function GateCallToAction({
  halted,
  orderId,
}: {
  /** Server state (`OrderPipelineResponse.gate_halted`), never inferred here. */
  halted: boolean;
  orderId: string;
}) {
  if (halted) {
    return (
      <Link
        to="/completeness"
        className={cn(buttonClasses({ size: "xl", tone: "halt" }))}
      >
        Resolve completeness gate →
      </Link>
    );
  }

  return (
    <Link
      to="/orders/$orderId/review"
      params={{ orderId }}
      className={cn(buttonClasses({ size: "xl" }))}
    >
      Open review — the run is waiting on you →
    </Link>
  );
}
