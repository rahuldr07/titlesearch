import { useState } from "react";
import type { GapCloseOption } from "@titlepipe/contract";
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
 * them apart. `settled` marks the options that require a comment — the ones
 * that add a claim rather than add evidence.
 *
 * The form opens in place rather than in a dialog. It asks for a sentence about
 * a claim on the card above; a modal would cover the very evidence the sentence
 * is supposed to answer.
 */

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
  onClose: (option: string, note: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div>
      <Eyebrow variant="field" as="p" className="mb-4">
        {options.length === 1
          ? "One way to close it"
          : `Close it one of ${COUNT_WORD[options.length] ?? options.length} ways`}
      </Eyebrow>

      <div className="flex flex-wrap gap-5">
        {options.map((option) => (
          <GapOptionButton
            key={option.kind}
            tone={
              option.label === chosen
                ? "action"
                : option.requires_comment
                  ? "settled"
                  : "neutral"
            }
            title={option.label}
            sub={option.consequence}
            onClick={() => setChosen(option.label)}
          />
        ))}
      </div>

      {chosen === null ? null : (
        <GapClosureForm
          option={chosen}
          onRecord={(note) => {
            setChosen(null);
            onClose(chosen, note);
          }}
          onCancel={() => setChosen(null)}
        />
      )}
    </div>
  );
}
