import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import type { GrantedPermissionSchema } from "@titlepipe/contract";
import { PaletteBody } from "./PaletteBody";
import { useOverlayOpen, useOverlays } from "./overlays";

/**
 * The command palette — the shell only. Everything inside it, including the
 * read that fills it, is `PaletteBody`, which mounts only while it is open.
 * The query box is a real `<input>`, so chord suppression is automatic;
 * `data-chord-scope="own"` covers the one frame between "open" and
 * "focused". Arrow/Enter are local, never on the window — a window-level
 * Enter handler navigates on every Enter anywhere and the focused control
 * never activates.
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
