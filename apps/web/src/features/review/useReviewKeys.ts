import { useEffect, useMemo, useRef } from "react";
import { useChords } from "../../shared/chords";

/**
 * THE WORKSTATION'S CHORDS — C / E / Q / J / K / Z, AND THEY ARE PANE-LOCAL.
 *
 * `app/keyboard/GlobalKeys.tsx` says outright why they are not in the global
 * registry: "C/E/Q/J/K/Z belong to the review screen and are installed by that
 * screen, not here — INVARIANT 50 makes keys pane-local." Until now no screen
 * installed them, while `WorkstationBar` printed a legend advertising five of
 * them. Rule 11 says a screen may not advertise a key it does not install; the
 * bar was lying, and this is the half that makes it true.
 *
 * SUSPENSION IS `useChords`', NOT OURS. A chord typed into the correction
 * editor is text, and an open listbox owns its own typeahead — both are
 * decided by scope inside `shared/chords.ts`, so nothing here inspects a tag.
 *
 * THE HANDLERS RIDE A REF. `useChords` re-installs its listener whenever the
 * bindings object changes identity, and a review handler closes over the
 * selection, so it changes every render. Binding through a ref keeps ONE
 * listener for the screen's lifetime — the alternative is a tear-down and
 * rebuild on every keystroke, which is the exact window `chords.ts` says must
 * not exist ("there is no window in which a chord is lost").
 */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/** J / K — walk the server's queue. Live while an editor is open. */
export function useQueueKeys(props: {
  readonly enabled: boolean;
  readonly onNext: () => void;
  readonly onPrevious: () => void;
}) {
  const latest = useLatest(props);
  const bindings = useMemo(
    () => ({
      j: (event: KeyboardEvent) => {
        event.preventDefault();
        latest.current.onNext();
      },
      k: (event: KeyboardEvent) => {
        event.preventDefault();
        latest.current.onPrevious();
      },
    }),
    [latest],
  );

  useChords(bindings, { enabled: props.enabled });
}

/**
 * The acts. `enabled` is false while an editor is open — not because the
 * editor's focus would leak (it would not), but because `c` must not confirm a
 * field whose correction is half-written behind the panel.
 */
export function useDecisionKeys(props: {
  readonly enabled: boolean;
  readonly onConfirm: () => void;
  readonly onCorrect: () => void;
  readonly onEscalate: () => void;
}) {
  const latest = useLatest(props);
  const bindings = useMemo(
    () => ({
      c: (event: KeyboardEvent) => {
        event.preventDefault();
        latest.current.onConfirm();
      },
      e: (event: KeyboardEvent) => {
        event.preventDefault();
        latest.current.onCorrect();
      },
      q: (event: KeyboardEvent) => {
        event.preventDefault();
        latest.current.onEscalate();
      },
    }),
    [latest],
  );

  useChords(bindings, { enabled: props.enabled });
}

/** Z — zoom the source page to the citation. A VIEW toggle; it files nothing. */
export function useZoomKey(props: {
  readonly enabled: boolean;
  readonly onToggle: () => void;
}) {
  const latest = useLatest(props);
  const bindings = useMemo(
    () => ({
      z: (event: KeyboardEvent) => {
        event.preventDefault();
        latest.current.onToggle();
      },
    }),
    [latest],
  );

  useChords(bindings, { enabled: props.enabled });
}
