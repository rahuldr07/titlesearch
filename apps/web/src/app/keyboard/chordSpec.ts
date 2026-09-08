/** What a chord does. The overlay never names an action with no handler. */
export type ChordAction = "open-palette" | "toggle-key-map" | "pop-layer";

/** Sentence case. Sections are the design's grouping, not new facts. */
export type ChordSection =
  "In the review workstation" | "Moving around" | "Leaving a layer";

export interface ChordSpec {
  readonly id: string;
  /** The `tinykeys` pattern actually installed. */
  readonly chord: string;
  /** The cap the overlay prints. Key NAMES, passed through — `Kbd` casing. */
  readonly cap: string;
  readonly desc: string;
  /** The join to `GlobalKeys`' handlers. Null when a screen installs the row. */
  readonly action: ChordAction | null;
  /** Which layer binds it: the window, or the review workstation's own panes. */
  readonly install: "global" | "review";
  /**
   * Escape alone opts out of chord suppression: it is how you LEAVE a text
   * surface or an overlay, so it must fire from inside both (`chords.ts`).
   */
  readonly alwaysOn: boolean;
  readonly section: ChordSection;
}
