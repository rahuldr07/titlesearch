import { Dialog, Modal, ModalOverlay, Heading } from "react-aria-components";
import { useOverlayOpen, useOverlays } from "./overlays";

/**
 * THE `?` KEY MAP — and "modal" here is a STRUCTURAL claim, not a paint job.
 *
 * `key-map-modal.spec` pins four things the previous build's bare
 * `<div class="fixed inset-0">` failed: it must carry `role="dialog"` and
 * `aria-modal`, take an accessible name from its own heading, MOVE focus into
 * itself, TRAP focus so Tab never lands behind the scrim, and return focus
 * where it came from on close. `react-aria-components`' `Modal` + `Dialog` does
 * all five — including marking the page behind it inert, which is what makes
 * the spec's programmatic-focus clause pass.
 *
 * ══ STANDING THE SCREEN CHORDS DOWN — THE BUG THE PROTOTYPE SHIPS ══════════
 *
 * `chords.ts`'s header: "the prototype never guards on its own help overlay.
 * Press `?` then `c` and you CONFIRM A RULING from inside the cheat sheet — on
 * a field carrying T1 exposure."
 *
 * That is closed HERE, structurally, by TWO mechanisms rather than one:
 *
 *   1. `overlayIsUp()` finds `role="dialog"` in the document, so every chord
 *      routed through `useChords` suspends while this is rendered. That covers
 *      the global layer and every screen layer at once, without either knowing
 *      this component exists.
 *   2. `data-chord-scope="own"` on the dialog. `chords.ts` documents this as
 *      the escape hatch for the gap between "open" and "focused" — one frame,
 *      "and one frame is enough for a held key to repeat."
 *
 * Two mechanisms because the failure is silent and the consequence is a ruling.
 *
 * ══ THE CONTENT IS THE DESIGN'S OWN COPY, MINUS WHAT DOES NOT EXIST ════════
 *
 * `ANALYSIS-behavior.md` §1 quotes the prototype's `shortcutSections` as "the
 * shipping text for the `?` overlay". The review section is reproduced from it.
 * Two edits, both flagged:
 *
 *   - The NA taxonomy section is NOT listed as key bindings. The analysis is
 *     explicit: "The digits are NOT bound in the handler. The NA grid is
 *     mouse-only in the prototype." Listing 1/2/3/4 as keys would document a
 *     binding that does not exist.
 *   - `/` is described as what it does here (opens the palette), not as
 *     "focuses search" — there is no search surface; see `GlobalKeys.tsx`.
 */
const GLOBAL_KEYS = [
  { key: "⌘K / Ctrl K", desc: "Open the command palette and order switcher" },
  { key: "/", desc: "Open the command palette" },
  { key: "?", desc: "Toggle this keyboard map" },
  { key: "Esc", desc: "Close the innermost layer, or clear field focus" },
];

const REVIEW_KEYS = [
  { key: "C", desc: "Confirm the highlighted value as verified" },
  { key: "E", desc: "Open the inline correction editor" },
  { key: "Q", desc: "Escalate the current field" },
  { key: "J", desc: "Jump to the next pending decision" },
  { key: "K", desc: "Jump to the previous field in the record list" },
  { key: "Z", desc: "Zoom the evidence page to the focused citation" },
  { key: "Double-click", desc: "Enter rapid inline editing on a row" },
];

export function KeyMap() {
  const open = useOverlayOpen("key-map");
  const close = useOverlays((s) => s.close);

  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) close("key-map");
      }}
      isDismissable
      className="fixed inset-0 z-overlay flex items-center justify-center bg-scrim p-8 backdrop-blur-sm"
    >
      <Modal className="w-full max-w-280">
        <Dialog
          data-testid="key-map"
          data-chord-scope="own"
          /*
           * `aria-modal` IS SET ON THE DOM NODE, and the reason is measured
           * rather than assumed: passing `aria-modal` as a prop to `Dialog`
           * OR to `Modal` renders nothing. React Aria owns the ARIA on both
           * and drops it — checked in the built page's `outerHTML`, twice.
           *
           * It does that on purpose. Modern React Aria marks everything
           * OUTSIDE the overlay `inert` instead, which is a stronger mechanism
           * than the attribute and is genuinely in force here — that is what
           * makes `key-map-modal.spec`'s programmatic-focus clause pass.
           *
           * But the same spec asserts the ATTRIBUTE, and an assertion is not
           * weakened to match an implementation. A ref callback is the only
           * place left that touches the real node, so it is used, once, with
           * the reason attached. Both facts are now true of this dialog.
           */
          ref={(node) => node?.setAttribute("aria-modal", "true")}
          /*
           * NO `tp-ring` HERE. React Aria moves focus to the dialog itself on
           * open (tabindex=-1), so a focus ring on this element paints an
           * accent outline around the whole card the instant it appears —
           * measured in a screenshot. That is rule 1's accent spent on a
           * container nobody is traversing to. The ring belongs on the
           * controls inside, which is where keyboard focus actually lands.
           */
          className="flex flex-col gap-10 rounded-lg bg-surface-panel p-14 shadow-modal"
        >
          <Heading
            slot="title"
            className="text-subject font-bold leading-tight text-ink-primary"
          >
            Keyboard as navigation
          </Heading>
          <Group title="Global" rows={GLOBAL_KEYS} />
          <Group title="Review" rows={REVIEW_KEYS} />
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

function Group(props: {
  readonly title: string;
  readonly rows: readonly { key: string; desc: string }[];
}) {
  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-label font-bold uppercase leading-flat tracking-caps text-ink-faint">
        {props.title}
      </h3>
      <dl className="flex flex-col gap-3">
        {props.rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[120px_minmax(0,1fr)] gap-8">
            {/* Rule 3: kbd IS a legal home for mono. */}
            <dt className="rounded-xs border border-line-strong bg-surface-sunken px-4 py-1 text-center font-mono text-label leading-airy text-ink-secondary">
              {row.key}
            </dt>
            <dd className="text-meta leading-airy text-ink-secondary">{row.desc}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
