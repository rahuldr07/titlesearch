import { useId, useRef } from "react";
import type { Door } from "../entities/nav/doors";
import { useModalDialog } from "../shared/modalDialog";
import { Card, CardBody } from "../shared/ui/Card";
import { Eyebrow } from "../shared/ui/Eyebrow";

/**
 * The `?` overlay — the whole keyboard layer, written down.
 *
 * It lists only the doors the acting role holds, from the same table the
 * navigator and the server read. A map naming a screen you cannot open is a map
 * that teaches a shortcut that will refuse you.
 *
 * IT IS MODAL IN THE MARKUP, NOT ONLY IN THE PROSE. This comment used to end at
 * "it is MODAL: while it is up the screen underneath stands its own keys down",
 * and half of that was true: `useGlobalKeysHold` did stand the screen's letter
 * keys down. The overlay itself was a bare `<div class="fixed inset-0 …">` — no
 * `role="dialog"`, no `aria-modal`, no accessible name, no focus move, no trap,
 * and a page behind that was neither `inert` nor hidden, so Tab walked onto
 * controls the scrim was covering. Worse, the queue's keys were bound to the
 * document with no hold at all, so `?` then Enter HANDED THE READER AN ORDER
 * from inside the cheat sheet and `?` then `p` opened the pass field behind the
 * overlay — the exact trap the paragraph above says this is not.
 *
 * `useModalDialog` supplies the structural half: focus moves in, Tab cannot
 * leave, the siblings behind go `inert`, and Escape returns focus where it came
 * from. `key-map-modal.spec` pins each clause.
 *
 * THE DIALOG HAS NO FOCUSABLE CONTENT AND THAT IS DELIBERATE. The export draws
 * no close control; the copy below says Escape closes it, and Escape does. The
 * trap therefore has to hold focus on the panel itself rather than cycle a
 * list, which is why it is written to survive an empty set of tab stops.
 */
export function KeyMap({ doors }: { doors: readonly Door[] }) {
  const overlay = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useModalDialog(panel, overlay);

  return (
    <div
      ref={overlay}
      className="fixed inset-0 z-(--z-overlay) flex items-center justify-center bg-scrim p-9"
    >
      <div
        ref={panel}
        data-testid="key-map"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="w-full max-w-160"
      >
        <Card size="emphasis">
          <CardBody>
            {/*
              Upper-case in the MARKUP, not via `text-transform`:
              `navigation.spec` #1 matches this case-sensitively, and a CSS
              transform does not change what the text actually says. It is also
              the dialog's ACCESSIBLE NAME (`aria-labelledby`), which is a
              second reason the casing has to be real: a screen reader announces
              what the element contains, not what CSS painted.
            */}
            <Eyebrow id={titleId} variant="screen">KEYBOARD AS NAVIGATION</Eyebrow>
            <p className="mt-3 text-base text-ink-secondary">
              Press <span className="font-mono">g</span> then a key.{" "}
              <span className="font-mono">[</span> folds the navigator. Escape
              closes this.
            </p>
            <ul className="mt-8 flex flex-col gap-3">
              {doors.map((door) => (
                <li key={door.path} className="flex items-baseline gap-5">
                  <span className="w-12 font-mono text-md font-semibold text-action">
                    g {door.key}
                  </span>
                  <span className="text-base text-ink-primary">{door.label}</span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
