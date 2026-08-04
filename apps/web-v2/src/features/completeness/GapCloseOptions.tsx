import { useState } from "react";
import type { GapCloseKind, GapCloseOption } from "@titlepipe/contract";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { GapOptionButton } from "./GapOptionButton";
import { GapClosureForm } from "./GapClosureForm";

/**
 * The ways out of one gap — THE SERVER'S LIST, rendered in the server's own
 * words and never extended here.
 *
 * THE SECOND LINE IS THE SERVER'S TOO (since 2026-07-30). Each option arrives
 * with what it does to the record, so the screen states that consequence
 * rather than applying one sentence to every option because it could not tell
 * them apart.
 *
 * THE RANKING IS KEYED ON `kind`, WHICH IS THE ONLY FACT THAT CARRIES IT. The
 * design tints uploading violet, root-of-title green, and leaves the two that
 * rewrite a signed record plain (:573-591) — adding EVIDENCE, making a CLAIM
 * and CHANGING WHAT WAS SOLD are three different acts and the design says so in
 * three tones. Ranking off `requires_comment` looked close and was wrong at the
 * one place it mattered: it drew "Change the product ordered" in settled green,
 * the reassuring tone, on the option with money attached.
 *
 * NO CHOSEN-TONE. Choosing opens the form directly beneath, headed with the
 * option's own words — the design's own arrangement. Recolouring the button as
 * well would have made the violet upload option and a violet "selected" state
 * the same mark meaning two things on one row.
 *
 * POLICY GAP — the role refusal is NOT drawn, deliberately. `min_role` arrives
 * as a bare role name ("senior") with no entry in `packages/contract/authz.ts`
 * and no ordering over `ROLES`, so deciding whether the current actor satisfies
 * it means inventing a hierarchy in the browser — a second, silently drifting
 * rulebook, which is the thing `GapCloseOption` was widened to prevent. The
 * design dims that option to .55; `GapOptionButton` already carries the
 * `disabled` path for it, and it stays unused until the requirement is a rule.
 * The consequence line states the restriction verbatim in the meantime.
 */
const OPTION_TONE: Record<GapCloseKind, "action" | "settled" | "neutral"> = {
  upload: "action",
  amend: "neutral",
  root_of_title: "settled",
  change_product: "neutral",
};

/**
 * The design writes the count as a WORD — "close it one of two ways", not "one
 * of 2 ways". A numeral in a sentence reads as data, and this heading is not
 * data: it is prose about what you may now do. The one numeral on this card
 * that IS data — the sign-off line the gap was raised against — would stop
 * standing out the moment a second digit appeared beside it.
 *
 * The count still comes from the server's list. Only its spelling is decided
 * here, and only up to four; beyond that a numeral reads more easily than a
 * word and the sentence has bigger problems.
 */
const COUNT_WORD: Record<number, string> = { 2: "two", 3: "three", 4: "four" };

export function GapCloseOptions({
  options,
  onClose,
}: {
  options: readonly GapCloseOption[];
  onClose: (option: string, note: string | null) => void;
}) {
  const [chosen, setChosen] = useState<GapCloseOption | null>(null);

  return (
    <div>
      {/*
        A HEADING OVER THE OPTIONS, not another row label — 10px against the
        9px "You said" / "We found" above it (:572). Drawn at the same size it
        flattened into the label column and the options lost their opening.
      */}
      <Eyebrow variant="cardHeading" as="p" className="mb-4">
        {options.length === 1
          ? "One way to close it"
          : `Close it one of ${COUNT_WORD[options.length] ?? options.length} ways`}
      </Eyebrow>

      <div className="flex flex-wrap gap-5">
        {options.map((option) => (
          <GapOptionButton
            key={option.kind}
            tone={OPTION_TONE[option.kind]}
            title={option.label}
            sub={option.consequence}
            expanded={option.kind === chosen?.kind}
            onClick={() => setChosen(option)}
          />
        ))}
      </div>

      {chosen === null ? null : (
        <GapClosureForm
          option={chosen}
          onRecord={(note) => {
            setChosen(null);
            onClose(chosen.label, note);
          }}
          onCancel={() => setChosen(null)}
        />
      )}
    </div>
  );
}
