import type { StageKind } from "@titlepipe/contract";
import { Chip } from "../../shared/ui/Chip";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * THE ONE MARK IN A STAGE HEADER THAT IS NOT A SENTENCE.
 *
 * RULE: one mark, one meaning. The export tints the Machine run column with a
 * diagonal HATCH to say "the machine owns this, not a person". This codebase
 * already spends the hatch on "the document is silent on this field" — the
 * no-value language that has to survive greyscale with exactly one reading —
 * so `StageColumn` refused it, and that refusal stands. FAILURE PREVENTED: a
 * reader who has learned the hatch on a field would read a whole column as
 * unreadable source.
 *
 * WHAT REPLACES IT IS A WORD, not another fill. Every fill channel in this
 * design is already spoken for (tint = semantic family, hatch = silent source,
 * dashed = provisional), and a word is the one mark that cannot collide:
 * STOPPED and MACHINE differ in greyscale, at 9px, with the colour thrown
 * away. MACHINE names the OWNER, which is what the hatch meant — it is not
 * "running", which would be a live state the server never sent.
 *
 * Both come from `stage.kind`, which is the SERVER'S. A column is not stopped
 * because it has cards in it, and inferring that would make the board disagree
 * with the pipeline.
 *
 * `idle` and `done` take no mark at all. Unassigned and Delivered are held by
 * nobody, and the header's ON line already says so; a chip reading NOBODY
 * would be a third spelling of the same fact.
 */
const MARK: Partial<Record<StageKind, { word: string; tone: "action" | "neutral" }>> = {
  halt: { word: "STOPPED", tone: "action" },
  machine: { word: "MACHINE", tone: "neutral" },
};

export interface StageMarkProps {
  kind: StageKind;
  /**
   * The rail draws the mark as bare text — it has no tinted chip anywhere in
   * its rows, and a chip there would out-weigh the stage label beside it.
   */
  bare?: boolean | undefined;
}

export function StageMark({ kind, bare = false }: StageMarkProps) {
  const mark = MARK[kind];
  if (mark === undefined) return null;

  /*
   * The square is DECORATION and says so. Kept out of the accessible name so
   * the word is the whole of it — and kept in its own element so the word is
   * findable as text rather than as "■ STOPPED", which no test would guess.
   */
  const glyph = <span aria-hidden="true">■</span>;

  if (bare) {
    return (
      <Eyebrow variant="caption" tone={mark.tone === "action" ? "action" : "muted"}>
        {glyph} <span>{mark.word}</span>
      </Eyebrow>
    );
  }

  return (
    <Chip tone={mark.tone} size="micro" bordered>
      {glyph} <span>{mark.word}</span>
    </Chip>
  );
}
