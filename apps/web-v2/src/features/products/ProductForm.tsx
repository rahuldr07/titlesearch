import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";

import { ChoiceField } from "./ChoiceField";

/**
 * FORM VOCABULARY, not config. The served product carries a `derivation` code;
 * these three are how the form asks the question, and no endpoint accepts the
 * answer back.
 */
const DERIVATION_CHOICES = [
  { value: "year", label: "Fixed years back" },
  { value: "owner", label: "Current / owners" },
  { value: "update", label: "From prior effective date" },
] as const;

/**
 * Authoring a product.
 *
 * The derivation choice is a BRANCH, not a label: "fixed years back" needs a
 * span, "current / owners" needs a count, "from prior effective date" needs
 * neither. Showing all three inputs at once would let a product be saved
 * carrying a years value it does not use, and the next person to read the
 * record cannot tell which number is live.
 *
 * The closing note is the thing a new product most needs said: it starts NOT
 * APPLICABLE for every line. Creating a product cannot, on its own, start
 * demanding answers — you opt each line in from the baseline grid, deliberately.
 */
export function ProductForm({
  isNew,
  onCancel,
}: {
  isNew: boolean;
  onCancel: () => void;
}) {
  const [kind, setKind] = useState<readonly string[]>(["year"]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow variant="field" as="label" htmlFor="product-name">
          Name
        </Eyebrow>
        <TextField
          id="product-name"
          className="mt-3"
          placeholder="e.g. 30-Year Search"
        />
      </div>

      <div>
        <Eyebrow variant="field" as="label" htmlFor="product-code">
          Code
        </Eyebrow>
        <TextField id="product-code" className="mt-3" placeholder="e.g. 30 Year" />
      </div>

      <ChoiceField
        label="How the period is derived"
        options={DERIVATION_CHOICES}
        value={kind}
        onValueChange={setKind}
        toggleClassName="rounded-5"
      />

      {kind.includes("year") ? (
        <div>
          <Eyebrow variant="field" as="label" htmlFor="product-years">
            Years back
          </Eyebrow>
          <TextField
            id="product-years"
            inputMode="numeric"
            className="mt-3 w-60 font-mono"
            placeholder="e.g. 30"
          />
        </div>
      ) : null}

      {kind.includes("owner") ? (
        <div>
          <Eyebrow variant="field" as="label" htmlFor="product-owners">
            Number of owners
          </Eyebrow>
          <TextField
            id="product-owners"
            inputMode="numeric"
            className="mt-3 w-60 font-mono"
            placeholder="1 or 2"
          />
        </div>
      ) : null}

      <div>
        <Eyebrow variant="field" as="label" htmlFor="product-sub">
          One-line description
        </Eyebrow>
        <TextField id="product-sub" className="mt-3" />
      </div>

      {isNew ? (
        <p className="text-xs leading-body text-ink-muted">
          A new product starts <span className="font-semibold">not applicable</span> for
          every line — opt each line in from the baseline grid.
        </p>
      ) : null}

      {/* CONTRACT GAP: no endpoint accepts a product record. */}
      <div className="flex gap-4">
        <Button size="lg" block disabled data-testid="save-product">
          Save product
        </Button>
        <Button size="lg" fill="outlined" tone="neutral" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      <p className="text-xs leading-body text-ink-muted">
        CONTRACT GAP: the products endpoint reads only. Save is disabled rather than
        silently discarding what you typed.
      </p>
    </div>
  );
}
