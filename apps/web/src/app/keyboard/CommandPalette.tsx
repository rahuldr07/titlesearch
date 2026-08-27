import { useState } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import type { GrantedPermissionSchema } from "@titlepipe/contract";
import { useCommands } from "./commands";
import { useOverlayOpen, useOverlays } from "./overlays";
import { cx } from "../../components/ui";

/**
 * THE COMMAND PALETTE — arrow/enter navigation over the commands in
 * `commands.ts` (which is where the "no orders" refusal is argued).
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
  const commands = useCommands(props.rules);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const matches = commands.filter((command) =>
    command.label.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const selected = matches[Math.min(index, Math.max(matches.length - 1, 0))];

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) close("palette");
        setQuery("");
        setIndex(0);
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
          <input
            data-testid="command-palette-input"
            autoFocus
            aria-label="Search screens and actions"
            placeholder="Search screens and actions"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setIndex(0);
            }}
            onKeyDown={(event) => {
              const count = matches.length;
              if (count === 0) return;
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setIndex((i) => (i + 1) % count);
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setIndex((i) => (i - 1 + count) % count);
              } else if (event.key === "Enter") {
                event.preventDefault();
                selected?.run();
              }
            }}
            className="h-22 border-b border-line-subtle px-12 text-body leading-flat text-ink-primary placeholder:text-ink-faint focus:outline-none"
          />
          <ul className="flex max-h-160 flex-col gap-1 overflow-y-auto p-4">
            {matches.map((command) => (
              <li key={command.id}>
                <button
                  type="button"
                  onClick={command.run}
                  data-selected={command.id === selected?.id ? "1" : "0"}
                  className={cx(
                    "tp-state flex h-16 w-full items-center justify-between rounded-sm px-8 text-left text-meta leading-flat",
                    command.id === selected?.id
                      ? "bg-action-surface font-semibold text-action"
                      : "text-ink-secondary hover:bg-surface-sunken",
                  )}
                >
                  {command.label}
                  <span className="text-label leading-flat text-ink-faint">
                    {command.group}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {/* The refusal, stated on screen rather than left as an absence. */}
          <p className="border-t border-line-subtle px-12 py-6 text-label leading-airy text-ink-faint">
            Orders are not listed here — the queue hands over one order and there is
            no browse endpoint to pick from.
          </p>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
