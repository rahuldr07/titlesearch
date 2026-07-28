import { useState } from "react";

import { Button } from "../../shared/ui/Button";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";
import { ToggleGroup, Toggle } from "../../shared/ui/ToggleGroup";

import { DERIVATION_CHOICES } from "./catalogue";

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
export function ProductForm({ isNew, onCancel }: { isNew: boolean; onCancel: () => void }) {
  const [kind, setKind] = useState<readonly string[]>(["year"]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow variant="field" as="label" htmlFor="product-name">Name</Eyebrow>
        <TextField id="product-name" className="mt-3" placeholder="e.g. 30-Year Search" />
      </div>

      <div>
        <Eyebrow variant="field" as="label" htmlFor="product-code">Code</Eyebrow>
        <TextField id="product-code" className="mt-3" placeholder="e.g. 30 Year" />
      </div>

      <div>
        <Eyebrow variant="field" as="h3">How the period is derived</Eyebrow>
        <ToggleGroup
          className="mt-3"
          aria-label="How the period is derived"
          value={kind}
          onValueChange={setKind}
        >
          {DERIVATION_CHOICES.map((k) => (
            <Toggle key={k.value} value={k.value} className="rounded-5">{k.label}</Toggle>
          ))}
        </ToggleGroup>
      </div>

      {kind.includes("year") ? (
        <div>
          <Eyebrow variant="field" as="label" htmlFor="product-years">Years back</Eyebrow>
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
          A new product starts <span className="font-semibold">not applicable</span>{" "}
          for every line — opt each line in from the baseline grid.
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
        CONTRACT GAP: there is no products endpoint. Save is disabled rather than
        silently discarding what you typed.
      </p>
    </div>
  );
}
