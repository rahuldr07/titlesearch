import type { ReactNode } from "react";

import { Command } from "./command";
import { Dialog } from "./dialog";

/**
 * The command menu, in a modal. Split from command.tsx so the shell can be
 * rendered inline without dragging a modal in with it.
 *
 * The chord contract is covered three ways, none redundant: the dialog role,
 * the overlay's data-chord-scope="own" (live from the moment the scrim
 * mounts, before focus moves inside), and the menu/menuitem/input roles —
 * which are what cover the inline form, where the first two do not apply.
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

