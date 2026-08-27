import type { ReactNode } from "react";
import {
  DialogTrigger,
  Modal,
  ModalOverlay,
  Dialog as AriaDialog,
  Heading,
  type ModalOverlayProps,
} from "react-aria-components";
import { cx } from "./cx";

/**
 * THE MODAL, AND THE TWO THINGS IT OWES THE CHORD LAYER.
 *
 * First: `role="dialog"`, which react-aria's Dialog supplies, is the FIRST
 * clause of `overlayIsUp()` in `shared/chords.ts`. Second: the explicit
 * `data-chord-scope="own"` below is the second clause, and it is on the
 * OVERLAY rather than on the dialog so it exists from the moment the scrim
 * mounts — before focus moves inside.
 *
 * That second one is not belt-and-braces. `chords.ts` pins the prototype bug
 * where "? then c CONFIRMS A RULING from inside the cheat sheet — on a field
 * carrying T1 exposure", and `e2e/invariants/chord-suppression.spec.ts` tests
 * it. A help overlay is a dialog; a dialog stands the vocabulary down; the
 * ruling cannot fire.
 *
 * `isDismissable` defaults TRUE, and Esc therefore closes. `chords.ts` calls
 * resumption-without-a-click a test: nothing was unbound while this was open,
 * so the very next keystroke after close is live again.
 *
 * MOTION: scrim fades and the card rises, both on `tp-enter` (260ms, the entry
 * token). Nothing bounces. React Aria holds the unmount until the exit
 * animation ends, which is why this needs no JS.
 */
export type DialogProps = Omit<ModalOverlayProps, "className" | "children"> & {
  /** The dialog's accessible name. Required: an unnamed dialog is unnavigable. */
  readonly title: string;
  readonly children: ReactNode;
};

export function Dialog({ title, children, isDismissable = true, ...props }: DialogProps) {
  return (
    <ModalOverlay
      {...props}
      isDismissable={isDismissable}
      data-chord-scope="own"
      className={cx(
        "tp-enter fixed inset-0 z-overlay flex items-center justify-center bg-scrim p-12",
      )}
    >
      <Modal className="tp-enter w-full max-w-280 outline-none">
        <AriaDialog className="flex flex-col gap-8 rounded-lg bg-surface-panel p-15 shadow-modal outline-none">
          {/*
           * Rule 2: `--text-subject` (20px) is the size for "the subject of a
           * panel". Rule 4: sentence case, so no `uppercase` here.
           */}
          <Heading
            slot="title"
            className="font-sans text-subject leading-close font-semibold text-ink-primary"
          >
            {title}
          </Heading>
          {children}
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

/** The trigger half. Re-exported so a screen imports one module, not two. */
export { DialogTrigger };
