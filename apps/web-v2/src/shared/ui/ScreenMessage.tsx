import type { ReactNode } from "react";
import { Screen, type ScreenMeasure } from "./Screen";
import { cn } from "./classNames";

/**
 * The one line a screen shows INSTEAD of itself: the request has not landed, or
 * it failed.
 *
 * THIS IS NOT AN EMPTY STATE, and the distinction is the reason it is its own
 * component. `EmptyPanel` means *resolved and empty* — the server answered and
 * there is nothing there, which is a fact about the work. This means *not
 * loaded* — nobody knows yet. Rendering "Nothing held" while a request is still
 * in flight states something the app has not been told, and a reader cannot
 * tell the two apart once they look the same.
 *
 * IT CARRIES THE SCREEN'S OWN MEASURE. Seventeen of these were bare `<p>`
 * elements returned before the screen's wrapper, so when the shell stopped
 * supplying padding they rendered flush against the pane edge — and then jumped
 * inward when the data arrived. A status line that moves when it resolves reads
 * as a layout bug even though both frames are "correct".
 */
export interface ScreenMessageProps {
  children: ReactNode;
  /** `halt` when the request failed; `muted` while it is still in flight. */
  tone?: "muted" | "halt";
  /** The measure of the screen this stands in for, so nothing shifts. */
  measure: ScreenMeasure;
}

export function ScreenMessage({ children, tone = "muted", measure }: ScreenMessageProps) {
  return (
    <Screen measure={measure}>
      {/*
       * BODY SIZE, NOT DENSE-BODY SIZE. `text-base` (12px) is the mockup's
       * inside-a-row tier — a county name, a row note, a thing read in a column
       * of its peers. This line has no peers: it is the only content on the
       * screen, standing where a whole screen will be. Drawn a step small it
       * read as a caption for the emptiness rather than the app's own sentence,
       * and it then had to GROW when the data landed and the real prose
       * appeared at 13px, which is the same shift `measure` exists to prevent,
       * arrived at through the type scale instead of the box.
       */}
      <p
        role={tone === "halt" ? "alert" : undefined}
        className={cn(
          "text-lg leading-body",
          tone === "halt" ? "text-state-halt-ink" : "text-ink-secondary",
        )}
      >
        {children}
      </p>
    </Screen>
  );
}
