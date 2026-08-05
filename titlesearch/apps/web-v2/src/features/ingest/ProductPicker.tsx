import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card } from "../../shared/ui/Card";
import { ChoiceCardGrid } from "../../shared/ui/ChoiceCardGrid";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { TextField } from "../../shared/ui/TextField";
import { configProductsQuery } from "./queries";

/**
 * WHICH PRODUCT WAS ORDERED — it sets the questions and the scope.
 *
 * RULE: never emit a value you cannot cite, and never let a control imply an
 * effect it does not have. The six cards are the server's catalogue, and
 * `retired` is the server's flag, rendered rather than second-guessed — a
 * retired product must not be orderable.
 *
 * CONTRACT GAP: `CreateOrderRequest` carries no product and no prior effective
 * date (`packages/contract/src/endpoints.ts`), so neither choice is submitted.
 * The block is drawn anyway, with the gap stated ON SCREEN: the design asks
 * this question at intake, and silently dropping it would leave a person
 * believing the product on their order came from them. Stating it is the
 * refusal rule applied to the screen's own honesty.
 *
 * FAILURE PREVENTED: a picker that looks like it sets the scope but posts
 * nothing — the worst of the three options, because it is indistinguishable
 * from one that works.
 *
 * The choice is held here, not lifted, precisely BECAUSE it has nowhere to go.
 * Threading it up to the submit handler would suggest a wire it does not have.
 */
export function ProductPicker() {
  const config = useQuery(configProductsQuery);
  const [productId, setProductId] = useState<string | null>(null);

  if (config.isError) {
    return (
      <p role="alert" className="text-xs leading-body text-state-halt-ink">
        The product catalogue could not be loaded.
      </p>
    );
  }
  if (config.isPending) {
    return <p className="text-xs leading-body text-ink-secondary">Loading products…</p>;
  }

  const offered = config.data.products.filter((product) => !product.retired);
  const chosen = offered.find((product) => product.id === productId);

  return (
    <fieldset className="flex flex-col gap-4">
      <Eyebrow as="legend" variant="field">
        PRODUCT ORDERED &middot; SETS THE QUESTIONS AND THE SCOPE
      </Eyebrow>

      <ChoiceCardGrid
        name="product"
        columns={3}
        value={productId}
        onSelect={setProductId}
        options={offered.map((product) => ({
          id: product.id,
          title: product.code,
          sub: product.sub,
        }))}
      />

      {chosen?.derivation === "update" ? <PriorEffectiveDate /> : null}

      <p className="text-tiny leading-body text-state-attend-ink">
        CONTRACT GAP &middot; the order carries no product field yet, so this
        choice is not sent. The question is asked here because intake is where
        it is answered.
      </p>
    </fieldset>
  );
}

/**
 * The one text input the design's upload screen has, and it appears only for an
 * Update — where the whole scope of the search is "since that date".
 */
function PriorEffectiveDate() {
  const [value, setValue] = useState("");
  return (
    <Card tone="action" size="nested" className="flex flex-col gap-3 px-7 py-6">
      <Eyebrow as="label" variant="field" tone="action" htmlFor="prior-effective-date">
        PRIOR SEARCH EFFECTIVE DATE — REQUIRED FOR AN UPDATE
      </Eyebrow>
      <TextField
        id="prior-effective-date"
        size="sm"
        tone="action"
        placeholder="MM/DD/YYYY"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-85 font-mono"
      />
      <p className="text-tiny leading-body text-ink-secondary">
        Without it, three sign-off lines have no defined scope.
      </p>
    </Card>
  );
}
