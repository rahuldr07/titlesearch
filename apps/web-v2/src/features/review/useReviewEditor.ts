import { useState } from "react";
import type { FieldReading } from "@titlepipe/contract";
import type { ReviewMode } from "./ReviewEditors";

/**
 * A reading whose recorded line is drawn on the page.
 *
 * The seat letter travels WITH the reading rather than being recomputed at the
 * pin: it is the ordinal of the reading in the array the server sent, and
 * recovering it from a `FieldReading` alone is impossible once the reading has
 * left the list it came from. `review.spec` #10 reads that letter back out of
 * the pin caption.
 */
export interface Pinned {
  seat: string;
  reading: FieldReading;
}

/**
 * Which editor is open, and what it is holding.
 *
 * These four pieces of state are one thing, not four: every transition between
 * them has to move more than one, and the bugs come from moving only some.
 * Selecting a different field while the correction editor is open must close
 * the editor, drop the pinned reading AND clear the blank-confirm note —
 * leaving any of the three behind carries one field's working state onto the
 * next one, which is how a reviewer ends up looking at field B with field A's
 * reading pinned beside it.
 *
 * `reselect` wraps the URL-owned `select` rather than replacing it: selection
 * stays the router's (`?field=` is a deep link, `review.spec` #9), and this only
 * adds the teardown that must happen alongside it.
 */
export interface ReviewEditor {
  mode: ReviewMode;
  setMode: (mode: ReviewMode) => void;
  pinned: Pinned | null;
  setPinned: (pinned: Pinned | null) => void;
  seed: string | null;
  blankNote: boolean;
  setBlankNote: (note: boolean) => void;
  /** Move to another field, tearing down everything that belonged to this one. */
  reselect: (path: string) => void;
  /** Adopt a reading: open the editor already holding it, so nobody retypes. */
  adopt: (value: string) => void;
  /** Open the editor empty — the reviewer types their own value. */
  openCorrect: () => void;
}

export function useReviewEditor(select: (path: string) => void): ReviewEditor {
  const [mode, setMode] = useState<ReviewMode>("idle");
  const [pinned, setPinned] = useState<Pinned | null>(null);
  const [seed, setSeed] = useState<string | null>(null);
  const [blankNote, setBlankNote] = useState(false);

  return {
    mode,
    setMode,
    pinned,
    setPinned,
    seed,
    blankNote,
    setBlankNote,
    reselect: (path) => {
      setMode("idle");
      setPinned(null);
      setBlankNote(false);
      select(path);
    },
    adopt: (value) => {
      setSeed(value);
      setMode("correct");
    },
    openCorrect: () => {
      setSeed(null);
      setMode("correct");
    },
  };
}
