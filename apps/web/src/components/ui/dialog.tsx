import type { ReactNode } from "react";
import {
  Dialog as DialogPrimitive,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  type ModalOverlayProps,
} from "react-aria-components";

import { cx } from "./cx";
import { chordOverlay } from "./overlaySurface";

/**
 * THE MODAL, AND THE TWO THINGS IT OWES THE CHORD LAYER.
 *
 * First: `role="dialog"`, which react-aria's Dialog supplies, is the FIRST
 * clause of `overlayIsUp()` in `shared/chords.ts`. Second: the explicit
 * `data-chord-scope="own"` is the SECOND clause, and it is on the OVERLAY
 * rather than on the dialog so it exists from the moment the scrim mounts —
 * before focus moves inside.
 *
 * That second one is not belt-and-braces. `chords.ts` pins the prototype bug
 * where "? then c CONFIRMS A RULING from inside the cheat sheet — on a field
 * carrying T1 exposure". A help overlay is a dialog; a dialog stands the
 * vocabulary down; the ruling cannot fire.
 *
 * ══ ADAPTED FROM THE REGISTRY ═══════════════════════════════════════════════
 *
 * The registry drew `bg-black/10` with `backdrop-blur-xs` and a `ring-1
 * ring-foreground/10` card at `rounded-xl`. RECIPES.md §Elevation asks for a
 * `rgba(20,18,30,.45)` BLURRED scrim and `--shadow-modal`, so: `tp-scrim`
 * (ui.css — the 3px blur is not on Tailwind's scale and check-rules bans the
 * arbitrary value), `shadow-modal`, `rounded-lg` (14, rule 5's surface rung),
 * and the ring is dropped — a shadow that heavy needs no hairline as well.
 *
 * MOTION: the scrim FADES (`tp-fade`) and the card RISES (`tp-enter`). The
 * design note's "220ms pop" is spent as the entry token, 260ms
 * cubic-bezier(.32,.72,0,1): rule 10 ships three timings and 220 is not one of
 * them, and that curve decelerates to rest rather than overshooting. Nothing
 * bounces. React Aria holds the unmount until the exit animation ends.
 *
 * `isDismissable` defaults TRUE, and Esc therefore closes. `chords.ts` calls
 * resumption-without-a-click a test: nothing was unbound while this was open,
 * so the very next keystroke after close is live again.
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
      <Modal className="tp-enter w-full max-w-280 outline-none">
        <DialogPrimitive
          data-slot="dialog"
          data-testid={testId}
          /*
           * `aria-modal` is set on the NODE because React Aria drops it as a
           * prop — it marks everything outside the overlay `inert` instead,
           * which is stronger. `key-map-modal.spec` asserts the attribute, and
           * an assertion is not weakened to match an implementation.
           */
          ref={(node) => node?.setAttribute("aria-modal", "true")}
          className={cx(
            "flex flex-col overflow-hidden rounded-lg bg-surface-panel shadow-modal outline-none",
          )}
        >
          <DialogHeaderBand title={title} />
          {children}
        </DialogPrimitive>
      </Modal>
    </ModalOverlay>
  );
}

/**
 * The header BAND, not a header card. RECIPES.md §Card: "11px w700 #8A8E98
 * sentence case on #FBFBFD with a #EDEFF3 rule" — and nested cards are
 * forbidden, so this has no border box, no radius and no shadow of its own.
 *
 * `slot="title"` is what gives the dialog its accessible name; react-aria
 * wires `aria-labelledby` from it, which is why the title is not merely a
 * styled span.
 */
function DialogHeaderBand({ title }: { readonly title: string }) {
  return (
    <div className="border-b border-line-subtle bg-control-fill px-12 py-6">
      <Heading
        slot="title"
        data-slot="dialog-title"
        className="font-sans text-label leading-flat font-bold text-ink-muted"
      >
        {title}
      </Heading>
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
 * The action row. Sunken, hairline above, actions right — and rule 1 binds
 * here harder than anywhere: AT MOST ONE primary button in this row, because a
 * modal is usually the screen's decision and the accent is spent once.
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
