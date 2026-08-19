import { useEffect, type RefObject } from "react";

/** Tab stops, for the trap below. `-1` is reachable by script, never by Tab. */
const FOCUSABLE =
  "a[href], button:not([disabled]), input:not([disabled])," +
  " select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

/**
 * MODAL, STRUCTURALLY — not just painted over the page.
 *
 * `role="dialog"` and a scrim are markup; what makes a dialog modal is focus
 * going IN, staying in, and coming back out where it started, and the page
 * behind being unreachable. The `?` map claimed modality in prose while Tab
 * walked onto controls the scrim covered (`key-map-modal.spec`).
 *
 * `inert` rather than a hand-rolled "is it behind the overlay" test: one
 * attribute removes the subtree from the tab order, hit-testing and the
 * accessibility tree, with `aria-hidden` beside it for AT that predates inert.
 * Siblings come from the overlay's own parent, so this assumes nothing about
 * where the overlay is mounted.
 *
 * Tab is ALWAYS defaulted-out and re-issued by hand — that is what keeps a
 * dialog with no focusable content, like this one, from losing focus to the
 * browser's own chrome on the first press.
 */
export function useModalDialog<D extends HTMLElement, O extends HTMLElement>(
  dialog: RefObject<D | null>,
  overlay: RefObject<O | null>,
): void {
  useEffect(() => {
    const panel = dialog.current;
    const top = overlay.current;
    if (panel === null || top === null) return;

    // Read BEFORE anything is made inert: inerting an ancestor blurs focus.
    const restoreTo = document.activeElement;
    const behind = [...(top.parentElement?.children ?? [])].filter((el) => el !== top);
    for (const el of behind) {
      el.setAttribute("inert", "");
      el.setAttribute("aria-hidden", "true");
    }
    panel.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      event.preventDefault();
      const stops = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const back = event.shiftKey;
      const at = stops.indexOf(document.activeElement as HTMLElement);
      const first = back ? stops[stops.length - 1] : stops[0];
      const next = at === -1 ? first : stops[(at + (back ? -1 : 1) + stops.length) % stops.length];
      (next ?? panel).focus();
    };
    panel.addEventListener("keydown", onKeyDown);

    return () => {
      panel.removeEventListener("keydown", onKeyDown);
      for (const el of behind) {
        el.removeAttribute("inert");
        el.removeAttribute("aria-hidden");
      }
      if (restoreTo instanceof HTMLElement) restoreTo.focus();
    };
  }, [dialog, overlay]);
}
