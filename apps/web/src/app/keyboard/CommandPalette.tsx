import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import type { GrantedPermissionSchema } from "@titlepipe/contract";
import { PaletteBody } from "./PaletteBody";
import { useOverlayOpen, useOverlays } from "./overlays";

/**
 * THE COMMAND PALETTE — the shell only. Everything inside it, including the
 * read that fills it, is `PaletteBody`, which mounts only while it is open.
 *
 * ══ FOCUS, AND WHY THE SUPPRESSION IS AUTOMATIC ════════════════════════════
 *
 * The query box is a real `<input>`, so `focusOwnsKeys` returns "text-entry"
 * for every keystroke inside it and the entire global chord layer stands down.
 * That is `chord-suppression.spec` #5: with the palette up, typing "?/" fills
 * the input, no key map appears and the URL does not move. Nothing in this file
 * had to know that — it follows from the input being an input, which is the
 * whole point of guarding by SCOPE rather than by a flag.
 *
 * `data-chord-scope="own"` is set as well, covering the frame between "open"
 * and "focused" — `chords.ts` records that one frame is enough for a held key
 * to repeat.
 *
 * ARROW/ENTER ARE LOCAL, never on the window. They are the palette's keys while
 * the palette has focus and nobody's otherwise; a window-level Enter handler is
 * exactly the defect `queue-keys.spec` describes, where "every Enter anywhere
 * navigated to review and the focused control never activated."
 */
export function CommandPalette(props: {
  readonly rules: readonly GrantedPermissionSchema[] | undefined;
}) {
  const open = useOverlayOpen("palette");
  const close = useOverlays((s) => s.close);

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) close("palette");
      }}
      isDismissable
      className="fixed inset-0 z-overlay flex items-start justify-center bg-scrim p-8 pt-40 backdrop-blur-sm"
    >
      <Modal className="w-full max-w-280">
        <Dialog
          aria-label="Command palette"
          data-chord-scope="own"
          // No `tp-ring`: focus moves into the input, not onto this container.
          className="flex flex-col overflow-hidden rounded-lg bg-surface-panel shadow-modal"
        >
          <PaletteBody rules={props.rules} />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
