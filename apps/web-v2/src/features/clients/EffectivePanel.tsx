import { Card, CardBody, CardFooter, CardHeader } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

import { ConflictBanner } from "./ConflictBanner";
import { conflictsFor, effectiveLines, RESOLVED_KEY } from "./effective";
import { EffectiveRow } from "./EffectiveRow";
import { ProductChips } from "./ProductChips";
import { CONFIG_VERSION, type ClientRecord, type ProductChip } from "./registry";

/**
 * Baseline behind, overrides on top — the checklist an order would actually get.
 *
 * This panel is the ANSWER, not a preview of one. At intake the same resolution
 * freezes onto the order stamped with a config version, and later config edits
 * never reach an order in flight; the footer says so, because otherwise a
 * change made here looks like it retroactively rewrites work already delivered.
 *
 * Conflicts are hoisted ABOVE the list rather than marked inline. A waive on a
 * load-bearing line is not a row you scroll past — it is the thing on this
 * screen most worth arguing about, and burying it thirteen rows down among
 * lines nobody disputes is how it gets applied without anyone deciding to.
 */
export function EffectivePanel({
  client,
  product,
  onSelectProduct,
}: {
  client: ClientRecord;
  product: ProductChip;
  onSelectProduct: (productId: string) => void;
}) {
  const resolved = product.gridKey === RESOLVED_KEY;
  const lines = resolved ? effectiveLines(client.id) : [];
  const conflicts = resolved ? conflictsFor(client.id) : [];

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-4">
        <Eyebrow variant="section" as="h2">
          Effective sign-off · baseline behind, overrides on top
        </Eyebrow>
        <ProductChips value={product.id} onChange={onSelectProduct} />
      </CardHeader>

      {resolved ? (
        <>
          {conflicts.length === 0 ? null : (
            <div className="flex flex-col gap-4 px-8 pt-6">
              {conflicts.map((c) => (
                <ConflictBanner
                  key={c.key}
                  conflict={c}
                  productName={product.name}
                  acknowledged={false}
                />
              ))}
            </div>
          )}

          <CardBody className="py-4">
            <ul>
              {lines.map((line) => (
                <EffectiveRow
                  key={line.key}
                  line={line}
                  source={
                    line.treatment === "added"
                      ? `added for ${client.name}`
                      : `${product.name} baseline`
                  }
                />
              ))}
            </ul>
          </CardBody>

          <CardFooter className="leading-body">
            Every effective line carries its origin — a line with no traceable
            source is a config defect, the same discipline as field provenance.
            At intake this resolves to a frozen checklist stamped{" "}
            <span className="font-mono font-semibold text-action">{CONFIG_VERSION}</span>{" "}
            on the order; later config edits never change an order in flight.
          </CardFooter>
        </>
      ) : (
        /*
          A NAMED STATE, never a blank panel. A blank one here would read as
          "this client differs on nothing", which is the opposite of "nobody has
          told us how this resolves".
        */
        <CardBody data-testid="no-resolution">
          <p className="text-base leading-body text-ink-secondary">
            No resolved checklist for {client.name} against {product.name}.
          </p>
          <p className="mt-3 text-xs leading-body text-ink-muted">
            CONTRACT GAP: resolution is server work — one resolver has to serve
            both intake and this screen or they disagree. There is no endpoint,
            and the only transcribed fixture covers the year-search baseline, so
            nothing is guessed for the other products.
          </p>
        </CardBody>
      )}
    </Card>
  );
}
