import type { ReactNode } from "react";
import {
  Button as ButtonPrimitive,
  Dialog as DialogPrimitive,
  Heading,
  DialogTrigger,
  Modal,
  ModalOverlay,
  type ModalOverlayProps,
} from "react-aria-components";

import { cx } from "./cx";
import { chordOverlay } from "./overlaySurface";

/**
 * The modal owes the chord layer two things: role="dialog" (supplied by
 * react-aria's Dialog) and the explicit data-chord-scope="own", which sits
 * on the overlay rather than the dialog so it exists from the moment the
 * scrim mounts — before focus moves inside. React Aria holds the unmount
 * until the exit animation ends. `isDismissable` defaults true, so Esc
 * closes, and nothing was unbound while the dialog was open — the very next
 * keystroke after close is live again.
 */
export type DialogProps = Omit<ModalOverlayProps, "className" | "children"> & {
  /** The dialog's accessible name. Required: an unnamed dialog is unnavigable. */
  readonly title: string;
  /** Handle for the invariant specs, which assert on the dialog NODE. */
  readonly testId?: string | undefined;
  readonly children: ReactNode;
};

export function Dialog({
  title,
  testId,
  children,
  isDismissable = true,
  ...props
}: DialogProps) {
  return (
    <ModalOverlay
      {...props}
      {...chordOverlay}
      isDismissable={isDismissable}
      data-slot="dialog-overlay"
      className="tp-fade tp-scrim tp-z-overlay fixed inset-0 flex items-center justify-center p-12"
    >
      <Modal className="tp-enter w-full max-w-320 outline-none">
        <DialogPrimitive
          data-slot="dialog"
          data-testid={testId}
          /*
           * aria-modal is set on the node because React Aria drops it as a
           * prop — it marks everything outside the overlay `inert` instead.
           * key-map-modal.spec asserts the attribute.
           */
          ref={(node) => node?.setAttribute("aria-modal", "true")}
          className={cx(
            "flex flex-col overflow-hidden rounded-lg bg-surface-panel shadow-modal outline-none",
          )}
        >
          {({ close }) => (
            <>
              {/* The dismiss is drawn only when there is one: a dialog opened
                  with `isDismissable={false}` is blocking on purpose, and an
                  ✕ that closes it would contradict the reason it is modal. */}
              <DialogHeaderBand
                title={title}
                {...(isDismissable ? { onClose: close } : {})}
              />
              {children}
            </>
          )}
        </DialogPrimitive>
      </Modal>
    </ModalOverlay>
  );
}

/**
 * The header band — no border box, radius or shadow of its own, since nested
 * cards are forbidden. `slot="title"` is what gives the dialog its accessible
 * name; react-aria wires `aria-labelledby` from it, which is why the title is
 * not merely a styled span.
 */
function DialogHeaderBand({
  title,
  onClose,
}: {
  readonly title: string;
  readonly onClose?: (() => void) | undefined;
}) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-line-subtle bg-control-fill px-12 py-6">
      <Heading
        slot="title"
        data-slot="dialog-title"
        className="min-w-0 truncate font-sans text-label leading-flat font-bold text-ink-muted"
      >
        {title}
      </Heading>
      {onClose !== undefined && (
        /*
         * 32px round dismiss, as the design draws on every modal. `-my-2`
         * takes its extra height back out of flow so the band keeps the
         * rhythm the rubric alone gave it.
         */
        <ButtonPrimitive
          data-slot="dialog-close"
          aria-label={`Close ${title}`}
          onPress={onClose}
          className="tp-state tp-press tp-ring -my-2 flex size-16 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-line-faint text-ink-muted outline-none hover:bg-line-strong hover:text-ink-primary"
        >
          <svg
            aria-hidden
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </ButtonPrimitive>
      )}
    </div>
  );
}

/** The dialog's body. One padding rung, so no screen invents a second. */
export function DialogBody({ children }: { readonly children: ReactNode }) {
  return (
    <div
      data-slot="dialog-body"
      className="flex flex-col gap-8 p-12 font-sans text-body leading-body text-ink-primary"
    >
      {children}
    </div>
  );
}

/**
 * The action row. Sunken, hairline above, actions right. At most one primary
 * button here — a modal is usually the screen's decision.
 */
export function DialogFooter({ children }: { readonly children: ReactNode }) {
  return (
    <div
      data-slot="dialog-footer"
      className="flex justify-end gap-6 border-t border-line-subtle bg-control-fill px-12 py-8"
    >
      {children}
    </div>
  );
}

export { DialogTrigger };
