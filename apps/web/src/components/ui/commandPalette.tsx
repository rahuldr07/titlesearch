import type { ReactNode } from "react";

import { Command } from "./command";
import { Dialog } from "./dialog";

/**
 * THE PALETTE: the command menu, in a modal.
 *
 * Split from `command.tsx` so the SHELL (filtering, input, list, item) can be
 * rendered inline in a panel without dragging a modal in with it — a palette
 * embedded in a screen and a palette over a screen are the same widget with
 * different chord consequences, and only this one is an overlay.
 *
 * The chord contract is covered THREE ways here and none is redundant:
 *
 *   1. `Dialog` renders `role="dialog"` — `overlayIsUp()`'s first clause.
 *   2. `Dialog`'s overlay carries `data-chord-scope="own"` — the second clause,
 *      live from the moment the scrim mounts, before focus moves inside.
 *   3. The list is `role="menu"` with `role="menuitem"` children and the input
 *      is a real `<input>`, all three in `focusRoles.ts`'s tables — which is
 *      what covers the INLINE form, where neither of the first two applies.
 *
 * `chords.ts` pins the prototype bug in this component's exact shape: "? then c
 * CONFIRMS A RULING from inside the cheat sheet — on a field carrying T1
 * exposure". A palette is opened BY a chord, is full of single letters, and
 * sits over a screen whose fields those same letters act on.
 */
export type CommandPaletteProps = {
  /** The palette's accessible name, e.g. "Commands". */
  readonly title: string;
  readonly isOpen: boolean;
  readonly onOpenChange: (isOpen: boolean) => void;
  readonly children: ReactNode;
};

export function CommandPalette({ title, isOpen, onOpenChange, children }: CommandPaletteProps) {
  return (
    <Dialog title={title} isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Command>{children}</Command>
    </Dialog>
  );
}

