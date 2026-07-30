import type {
  ClientRecord,
  ConfigProduct,
  EffectiveChecklist,
} from "@titlepipe/contract";

import { Card, CardBody, CardFooter, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";
import { DividedSection } from "../../shared/ui/ListRow";

import { ConflictBanner } from "./ConflictBanner";
import { EffectiveRow } from "./EffectiveRow";
import { overrideFor } from "./compare";
import { ProductChips } from "./ProductChips";

/**
 * Baseline behind, overrides on top — the checklist an order would actually get.
 *
 * This panel is the ANSWER, not a preview of one: the server resolved it, and
 * at intake the same resolution freezes onto the order stamped with a config
 * version. Later config edits never reach an order in flight; the footer says
 * so, because otherwise a change made here looks like it retroactively rewrites
 * work already delivered.
 *
 * Conflicts are hoisted ABOVE the list rather than marked inline. A waive the
 * product's meaning depends on is not a row you scroll past — it is the thing
 * on this screen most worth arguing about, and burying it thirteen rows down
 * among lines nobody disputes is how it gets applied without anyone deciding to.
 */
export function EffectivePanel({
  client,
  product,
  products,
  checklist,
  configVersion,
  onSelectProduct,
}: {
  client: ClientRecord;
  product: ConfigProduct;
  products: readonly ConfigProduct[];
  checklist: EffectiveChecklist | undefined;
  configVersion: string;
  onSelectProduct: (productId: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-col items-start gap-4">
        <Eyebrow variant="section" as="h2">
          Effective sign-off · baseline behind, overrides on top
        </Eyebrow>
        <ProductChips products={products} value={product.id} onChange={onSelectProduct} />
      </CardHeader>

      {checklist === undefined ? (
        /*
          A NAMED STATE, never a blank panel. A blank one here would read as
          "this client differs on nothing", which is the opposite of "nobody has
          told us how this resolves".
        */
        <CardBody data-testid="no-resolution">
          <p className="text-base leading-body text-ink-secondary">
            No resolved checklist for {client.name} against {product.full}.
          </p>
          <p className="mt-3 text-xs leading-body text-ink-muted">
            Resolution is server work — one resolver has to serve both intake and
            this screen or they disagree. The server has not resolved this
            pairing, and nothing is guessed on its behalf.
          </p>
        </CardBody>
      ) : (
        <>
          {checklist.conflict === null ? null : (
            <div className="flex flex-col gap-4 px-8 pt-6">
              <ConflictBanner
                conflict={checklist.conflict}
                productName={product.full}
                acknowledged={checklist.conflict_acknowledged}
              />
            </div>
          )}

          {/*
            The rows carry their own gutter now, so the list runs edge to edge
            between the header band and the footer — the junction at each band
            is one hairline instead of the row's stacked on the band's.
          */}
          <DividedSection>
            {checklist.lines.map((line) => {
              const override = overrideFor(line, client.overrides);
              return (
                <EffectiveRow
                  key={line.line_id}
                  line={line}
                  override={override}
                  source={
                    override?.type === "add"
                      ? `added for ${client.name}`
                      : `${product.full} baseline`
                  }
                />
              );
            })}
          </DividedSection>

          <CardFooter className="leading-body">
            Every effective line carries its origin — a line with no traceable
            source is a config defect, the same discipline as field provenance.
            At intake this resolves to a frozen checklist stamped{" "}
            <span className="font-mono font-semibold text-action">{configVersion}</span>{" "}
            on the order; later config edits never change an order in flight.
            {/*
              CONTRACT GAP: an "add" override carries `line_id: null` and gets no
              row of its own in `EffectiveChecklist.lines`, so a client-added
              line shows in the delta list above and nowhere in the resolution.
            */}
          </CardFooter>
        </>
      )}
    </Card>
  );
}
