import { useQuery } from "@tanstack/react-query";
import type { OrderPagesResponse } from "@titlepipe/contract";
import { pagesQuery } from "./queries";
import { PageSpine } from "../../entities/document/PageSpine";
import { coverageCells } from "../../entities/document/pageCoverage";
import { Card, CardBody } from "../../shared/ui/Card";
import { Eyebrow } from "../../shared/ui/Eyebrow";

/**
 * Coverage over the whole package, in the review pane.
 *
 * RULE: the summary quotes the SERVER'S page count, and the grid beneath it is
 * drawn by the one component that draws coverage grids. FAILURE PREVENTED: this
 * file used to carry its own copy of the four tiers, their labels, their
 * classifier and their `coverage-cell` testid, identical string for identical
 * string to `entities/document`. Two producers of a testid a release gate counts
 * is a gate that fails on the duplicate instead of on the regression, and two
 * copies of the classifier are two chances for `partial` and `unseen` to
 * collapse in one of them and not the other.
 *
 * THE GRID IS A PICTURE HERE, NOT A CONTROL. `onSelect` is omitted deliberately:
 * the page the facsimile shows is `DocumentColumn`'s own state, and a cell that
 * looked clickable from this card would move nothing. `PageSpine` renders real
 * buttons for the host that can wire them.
 *
 * The tiers themselves, and why the export's six are refused, are documented
 * once — in `entities/document/pageCoverage.ts` — rather than restated here
 * where the second copy could go stale against the first.
 */
export function CoverageSpine({ coverage }: { coverage: OrderPagesResponse }) {
  return (
    <Card data-testid="coverage-spine">
      <CardBody className="flex flex-col gap-5">
        <Eyebrow variant="section">Coverage</Eyebrow>
        <p className="text-xs text-ink-secondary">
          Coverage · all {coverage.total_pages} pages
        </p>
        <PageSpine cells={coverageCells(coverage.total_pages, coverage.pages)} />
      </CardBody>
    </Card>
  );
}

/**
 * The connected host. Runs the SAME query key `DocumentColumn` already fetches
 * (React Query dedupes by key, so this costs no extra request), separately —
 * a partial failure in one region must not blank the other (`errors.spec` #2).
 * Renders nothing until the package's page list resolves, rather than a
 * spine drawn against a stale or zero total.
 */
export function OrderCoverageSpine({ orderId }: { orderId: string }) {
  const { data } = useQuery(pagesQuery(orderId));
  return data ? <CoverageSpine coverage={data} /> : null;
}
