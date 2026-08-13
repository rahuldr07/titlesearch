import { useEffect, useId, useRef } from "react";
import type { ReactElement } from "react";
import { FieldError } from "@/components/ui/field";

/**
 * The refusal line. §4.6 is a release blocker — a correction needs its reason,
 * an escalation its question, a ruling its citation — and eleven places draw
 * that refusal today. THREE of them render `role="alert"` with no id and no
 * `aria-describedby` back to the control (`CorrectEditor:108`,
 * `EscalateEditor:57`, `ExcludeEditor:56`), so the blocker is announced on some
 * screens and merely visible on others. Omitting the attribute has no visible
 * consequence, which is exactly why a call site cannot be trusted to remember
 * it — the three that forgot look identical on screen to the eight that did not.
 *
 * So the wiring is not a prop the caller passes; it is what this component DOES.
 * Mounting links `controlId`'s `aria-describedby` to this line, unmounting
 * unlinks it. It has to reach for the element because the control is a sibling
 * this component never renders, and the alternative — handing the id back for a
 * parent to spread — is the step three sites already dropped.
 *
 * The link is APPENDED, never assigned: a control already carrying a hint would
 * otherwise lose that hint the moment it was refused, so being refused would
 * make a field LESS described than it was before.
 *
 * Built on the vendored `FieldError`, not `FieldDescription`. FieldError is
 * already `role="alert"` and its `data-slot="field-error"` is what `Field`'s
 * `data-invalid` styling keys off, so a nudge inside a Field turns the whole
 * group. FieldDescription is a muted `<p>` with no role — it would render a
 * release blocker as a hint, both to the eye and to a screen reader.
 *
 * THIS IS UI FEEDBACK, NOT AUTHORITY (§9.14). The contract enforces each of
 * these refusals with `min(1)` and the server refuses the same submissions
 * independently. This layer is a mirror, not a load-bearing wall.
 */
export interface RefusalNudgeProps {
  /** What is missing, in the design's words. Never "invalid" or "required". */
  message: string;
  /** id of the control this refusal is about — wires aria-describedby. */
  controlId: string;
}

export function RefusalNudge({ message, controlId }: RefusalNudgeProps): ReactElement {
  const nudgeId = useId();
  const lineRef = useRef<HTMLDivElement>(null);

  /*
   * `message` is a dependency, and the ref is checked, because FieldError
   * renders NOTHING when its content is empty. Wiring unconditionally would
   * point the control at an id that resolves to no element, which reads to a
   * screen reader as no description at all — the same failure this component
   * exists to close, arrived at from the other side.
   */
  useEffect(() => {
    const control = document.getElementById(controlId);
    if (!control || !lineRef.current) return;

    const read = () =>
      (control.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean);
    const write = (ids: string[]) => {
      if (ids.length > 0) control.setAttribute("aria-describedby", ids.join(" "));
      else control.removeAttribute("aria-describedby");
    };

    write([...read().filter((id) => id !== nudgeId), nudgeId]);
    return () => write(read().filter((id) => id !== nudgeId));
  }, [controlId, nudgeId, message]);

  return (
    /*
     * THE REFUSAL OUT-READS THE CHIPS AROUND IT. `text-sm` (11px) is one step
     * up from the `text-xs` it drew before, and the step is the point: the
     * editors this appears in are dense with 9.5px tracked micro-caps — chip,
     * key hint, no-value tag — and at 10.5px the one line that says WHY the
     * submit did nothing sat in the same visual tier as the decoration. A
     * release blocker (§4.6) that reads as chrome is a release blocker people
     * scan past, and the aria wiring above only helps the reader who is
     * listening. `leading-close` keeps a wrapped refusal from opening a gap
     * that pushes the control it describes off its own row.
     */
    <FieldError
      ref={lineRef}
      id={nudgeId}
      data-testid="nudge"
      className="text-sm leading-close font-semibold text-state-halt-ink"
    >
      {message}
    </FieldError>
  );
}
