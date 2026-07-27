import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField, TextArea } from "../../shared/ui/TextField";

/**
 * A THIRD VALUE CARRIES ITS WHY.
 *
 * Picking A or B means agreeing with a reading a trained person already stood
 * behind. Entering a third means both of them were wrong, and that claim is the
 * one most likely to be a senior's memory rather than the document — so it does
 * not travel without its reasoning.
 */
export function ThirdValue({
  path,
  value,
  why,
  onValue,
  onWhy,
}: {
  path: string;
  value: string;
  why: string;
  onValue: (next: string) => void;
  onWhy: (next: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <Eyebrow variant="field">The third value</Eyebrow>
        <TextField
          data-testid={`third-val-${path}`}
          value={value}
          onChange={(event) => onValue(event.target.value)}
        />
      </label>
      <label className="flex flex-col gap-2">
        <Eyebrow variant="field">Why both readings are wrong</Eyebrow>
        <TextArea
          data-testid={`third-why-${path}`}
          value={why}
          onChange={(event) => onWhy(event.target.value)}
        />
      </label>
    </div>
  );
}
