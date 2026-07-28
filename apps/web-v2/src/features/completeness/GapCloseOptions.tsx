import { useState } from "react";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { GapOptionButton } from "./GapOptionButton";
import { GapClosureForm } from "./GapClosureForm";

/**
 * The ways out of one gap — THE SERVER'S LIST, rendered in the server's own
 * words and never extended here.
 *
 * Every option carries the same consequence line because every closure costs
 * the same thing: a sentence saying why. The wire does not say which options
 * add evidence and which rewrite a signed assertion, and guessing from the copy
 * would put a second, drifting rulebook in the browser.
 *
 * The form opens in place rather than in a dialog. It asks for a sentence about
 * a claim on the card above; a modal would cover the very evidence the sentence
 * is supposed to answer.
 */
const CONSEQUENCE = "Needs a reason — it is recorded on the order.";

export function GapCloseOptions({
  options,
  onClose,
}: {
  options: readonly string[];
  onClose: (option: string, note: string) => void;
}) {
  const [chosen, setChosen] = useState<string | null>(null);

  return (
    <div>
      <Eyebrow variant="field" as="p" className="mb-4">
        {options.length === 1 ? "One way to close it" : `Close it one of ${options.length} ways`}
      </Eyebrow>

      <div className="flex flex-wrap gap-5">
        {options.map((option) => (
          <GapOptionButton
            key={option}
            tone={option === chosen ? "action" : "neutral"}
            title={option}
            sub={CONSEQUENCE}
            onClick={() => setChosen(option)}
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
