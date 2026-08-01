import type { ReactNode } from "react";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

/**
 * RESOLVED AND EMPTY — the server answered, and the answer is that there is
 * nothing there. No clients configured, no orders held, no deltas against the
 * baseline. That is a fact about the work, and stating it is safe.
 *
 * IT NEVER MEANS *NOT LOADED*. `./ScreenMessage.tsx` is the component for a
 * request still in flight or failed. Rendering "Nothing held" while the request
 * is in flight asserts something the app has not been told — and once the two
 * look alike, a reader has no way to tell an empty account from a broken fetch.
 * That is not a styling slip; it is the app claiming knowledge it does not
 * have. If you cannot say which of the two you are in, you are in
 * `ScreenMessage`.
 *
 * THE DASHED OUTLINE IS WHAT CARRIES THAT. A solid card says "here is a
 * thing", and an empty list is not a thing — it is a hole with an instruction
 * in it. Every "nothing yet" panel in the config layer is drawn this way, so
 * three blank screens read as one state rather than three accidents.
 *
 * AND IT IS THE ONE PANEL THAT DOES NOT FLOAT. `Card` now separates itself with
 * a shadow, because the register layers paper on paper. A hole in the paper is
 * the opposite claim and takes no elevation at all — nothing is resting here.
 * The dashed edge is drawn in `--color-line-dashed`, the token that exists for
 * exactly this: a step heavier than the ordinary rule, so a broken line still
 * reads as a line rather than as flecks.
 */

/**
 * The vendored ground is `p-6 md:p-12` and `flex-1`, and both are overridden
 * here rather than accepted:
 *
 *  - `md:p-15` is not a duplicate of `p-15`. Without it the panel would drop
 *    from 30px of padding to 24px at the breakpoint this app spends nearly all
 *    of its life above, so the design's padding would be the one nobody sees.
 *  - `flex-none` because `flex: 1 1 0%` makes the panel stretch to fill any
 *    flex-column parent. A panel that grows to the height of the space left
 *    over reads as a layout that lost its content, not as a resolved answer.
 */
const panel =
  "flex-none gap-7 rounded-8 border border-dashed border-line-dashed bg-surface-panel p-15 md:p-15";

export interface EmptyPanelProps {
  title: ReactNode;
  /** One sentence on what would put something here. */
  body?: ReactNode;
  /** The way in, when there is one — buttons, laid in a row. */
  actions?: ReactNode;
}

export function EmptyPanel({ title, body, actions }: EmptyPanelProps) {
  return (
    <Empty className={panel}>
      <EmptyHeader>
        {/* Re-imposed on the new scale: `--text-2xl` IS the panel-title step and
            `--text-lg` the body default. On the old scale these read 13px over
            11px — a title one notch above its own caption, which is not a
            heading, and a sentence set at the size reserved for field labels. */}
        <EmptyTitle className="text-2xl font-semibold tracking-normal text-ink-primary">
          {title}
        </EmptyTitle>
        {body === undefined ? null : (
          <EmptyDescription className="text-lg leading-body text-ink-secondary">
            {body}
          </EmptyDescription>
        )}
      </EmptyHeader>
      {actions === undefined ? null : (
        <EmptyContent className="flex-row flex-wrap justify-center gap-4">
          {actions}
        </EmptyContent>
      )}
    </Empty>
  );
}

/**
 * The same fact at the smaller register: one line inside a container that is
 * otherwise doing its job — a stage column with no orders in it, a client with
 * no deltas. It says the same thing `EmptyPanel` says and is held to the same
 * line: resolved and empty, never *not loaded*.
 *
 * THE ITALIC IS THE SIGNAL, not decoration. It marks the line as the app
 * talking ABOUT an absence rather than as a row of data — which is exactly the
 * confusion a blank column produces, since a column collapsed to nothing and a
 * column that never loaded draw identically.
 *
 * IT CARRIES NO PADDING OF ITS OWN, and is not built on `Empty` for that
 * reason: `Empty` is a self-padded centred frame, and the sites that need a
 * note each space it differently — inside a card body, inside a board column,
 * inline in a flex row. The container keeps that decision; the note only
 * supplies the voice.
 */
export interface EmptyNoteProps {
  children: ReactNode;
}

export function EmptyNote({ children }: EmptyNoteProps) {
  return <p className="text-base italic text-ink-muted">{children}</p>;
}
