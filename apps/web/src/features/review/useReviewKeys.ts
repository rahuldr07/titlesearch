import { useEffect, useMemo, useRef } from "react";
import { useChords } from "../../shared/chords";

/**
 * The workstation's chords — C / E / Q / J / K / Z, pane-local: this screen
 * installs them, not `GlobalKeys`. Suspension is `useChords`', not ours — a
 * chord typed into the correction editor is text, and an open listbox owns
 * its own typeahead; nothing here inspects a tag. The handlers ride a ref:
 * a review handler closes over the selection and changes every render, and
 * binding through a ref keeps one listener for the screen's lifetime
 * instead of a tear-down and rebuild on every keystroke.
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

/**
 * Z — zoom the evidence page to the focused citation, Escape — back to fit
 * (`ScanPane`). A view toggle; it files nothing. `Escape` is not a review
 * chord in the registry — it is the exit for this one view state, and it
 * stands down behind overlays and text entry exactly as `z` does.
 */
export function useZoomKey(props: {
  readonly enabled: boolean;
  readonly onToggle: () => void;
  readonly onExit: () => void;
}) {
  const latest = useLatest(props);
  const bindings = useMemo(
    () => ({
      z: (event: KeyboardEvent) => {
        event.preventDefault();
        latest.current.onToggle();
      },
      Escape: () => {
        latest.current.onExit();
      },
    }),
    [latest],
  );

  useChords(bindings, { enabled: props.enabled });
}
