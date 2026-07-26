import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { OrderFieldsResponse } from "@titlepipe/contract";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { api } from "../../api";
import { parseLineCoords, type NormRect, type PdfHighlight } from "../../components/coords";
import { PdfPane } from "../../components/PdfPane";
import { FieldRow } from "../../entities/field/FieldRow";
import { OrderRail } from "../../components/OrderRail";
import { DecisionPanel } from "./DecisionPanel";
import { PassOrder } from "./PassOrder";
import { QueueKeys } from "./QueueKeys";

/**
 * Review — the assembled report, field by field.
 *
 * Built so far: the field list with selection, the A/B reading comparison, the
 * three field decisions, pass-order, and the J/K keyboard path.
 *
 * STILL ABSENT, deliberately rather than stubbed: the document pane and
 * click-to-source, the bug channel, the report section grouping, the read-only
 * intake sign-off block, and finalize. The last two are gated on rulings Q5/Q6.
 *
 * Everything here renders server state verbatim. Nothing computes `state`,
 * nothing derives whether a field needs review, and nothing keys off a null
 * value except the NoValue hand-off.
 *
 * CONTRACT GAP: OrderFieldsResponse carries no queue count, so "N remaining"
 * is counted here from the server's own `state` values. That is list arithmetic
 * over data the server sent — not a re-derivation of state, and not a domain
 * count like #OF MTGS (which CONTEXT §7 forbids the UI from computing).
 * It should still move server-side so the two cannot drift; the server already
 * owns the queue ordering.
 */
export function ReviewScreen() {
  const { orderId } = useParams({ from: "/orders/$orderId/review" });
  const search = useSearch({ from: "/orders/$orderId/review" });
  const navigate = useNavigate();
  /** the reading whose line is pinned on the page, if any */
  const [pinned, setPinned] = useState<{
    engineId: string;
    seat: string;
    rects: NormRect[];
    page: number;
  } | null>(null);

  const fields = useQuery({
    queryKey: ["orders", orderId, "fields"],
    queryFn: () =>
      api(OrderFieldsResponse, `/api/orders/${orderId}/fields`),
  });

  if (fields.isPending) {
    return (
      <div data-testid="review-loading" className="p-8 text-sm text-ink-muted">
        Loading the assembled report…
      </div>
    );
  }

  if (fields.isError) {
    // Named, never a blank. A failure here is the reviewer's whole screen.
    return (
      <div
        data-testid="review-unavailable"
        className="m-8 max-w-prose rounded-lg border border-state-halt-border bg-state-halt-surface p-5"
      >
        <div className="font-semibold text-state-halt-ink">
          Report unavailable.
        </div>
        <div className="mt-1 text-sm text-ink-secondary">
          {fields.error.message}
        </div>
      </div>
    );
  }

  const all = fields.data.fields;
  // The queue is exactly what the server marked needs_review. The UI does not
  // add to it, reorder it, or infer membership from anything else.
  const queued = all.filter((f) => f.state === "needs_review");

  /*
   * A deep link can name a field this order does not have. That is not
   * hypothetical: a complaint deep-links by `field_path`, and a complaint can be
   * about a field that never made it into the assembled report — `cmp_1` points
   * at `assessment.city_tax`, which is exactly the case (a delinquent city-tax
   * line that was never extracted).
   *
   * Ignoring the parameter silently would leave the reviewer looking at some
   * other field believing it is the one they clicked, and an empty panel with no
   * explanation is worse still (orphan O6: never a silent blank, and a stale
   * reference names itself). So: say the requested field is not here, and fall
   * back to the queue so the screen stays usable.
   */
  const requested = search.field;
  const requestedField =
    requested === undefined
      ? undefined
      : all.find((f) => f.path === requested);
  const missingRequest =
    requested !== undefined && requestedField === undefined ? requested : null;

  const selectedPath = requestedField?.path ?? queued[0]?.path ?? all[0]?.path;
  const selected = all.find((f) => f.path === selectedPath);

  const select = (path: string) => {
    void navigate({
      to: "/orders/$orderId/review",
      params: { orderId },
      search: { field: path },
      replace: true,
    });
  };

  /*
   * Click-to-source. A pinned reading is what the reviewer asked to SEE, so it
   * wins over the field's own merged citation while set — that is the whole point
   * of the interaction: "show me where READER B got that."
   *
   * Only readings that DECLARED coordinates are pinnable. An engine without them
   * declares none (CONTEXT §8.1 — capabilities are declared, not faked), so
   * there is no box to draw and its name is not clickable. A faked box over a
   * plausible-looking region would be the worst outcome available here: a
   * citation pointing somewhere wrong is principle 6's failure shape aimed at
   * the page itself.
   */
  const highlights: PdfHighlight[] =
    pinned !== null
      ? [
          {
            id: `pin-${pinned.engineId}`,
            rects: pinned.rects,
            tone: "pin",
            chip: `READER ${pinned.seat} LINE — ${pinned.engineId}`,
          },
        ]
      : selected === undefined
        ? []
        : (() => {
            const rects = parseLineCoords(selected.source_line_coords);
            if (rects.length === 0 && selected.source_snippet === null) return [];
            return [
              {
                id: `src-${selected.path}`,
                rects,
                tone: "attend" as const,
                chip: `CITED — ${selected.path}`,
                snippet: selected.source_snippet ?? undefined,
              },
            ];
          })();

  /**
   * Move to the next field the SERVER has queued, after this one. Called only on
   * ACCEPTANCE — a refusal (a 409) leaves the reviewer on the field they were
   * refused on, so they can read the server's message against the thing refused.
   *
   * The queue is the server's. This walks it in the order it arrived; it does not
   * sort, re-rank, or skip.
   */
  const advance = () => {
    const here = queued.findIndex((f) => f.path === selectedPath);
    const next = queued[here + 1] ?? queued.find((f) => f.path !== selectedPath);
    if (next !== undefined) select(next.path);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-app">
      {/*
        Renders nothing — it owns the J/K listener. A component rather than a
        hook in this function because the loading and error branches above return
        early, and a conditionally-called hook is a bug waiting to happen.
      */}
      <QueueKeys queued={queued} selectedPath={selectedPath} onSelect={select} />
      <div className="flex flex-wrap items-baseline gap-3 border-b border-line-strong bg-surface-panel px-5 py-3">
        <span className="text-micro font-bold tracking-eyebrow text-page-ref uppercase">
          Assembled report
        </span>
        <span className="font-mono text-sm text-ink-secondary">{orderId}</span>
        <span className="ml-auto text-sm text-ink-secondary">
          {queued.length} remaining
        </span>
        <PassOrder orderId={orderId} />
      </div>

      {/*
        The order's spine. An order is not a screen, it is a thread through
        screens, and any screen showing the order shows the thread — so nobody
        has to ask what happened to it. Server-authored (GET .../timeline); the
        UI never re-derives pipeline history.
      */}
      <OrderRail orderId={orderId} fields={all} />

      {missingRequest === null ? null : (
        <div
          data-testid="stale-field-link"
          className="border-b border-state-attend-border bg-state-attend-surface px-5 py-2.5 text-sm text-state-attend-ink"
        >
          <span className="font-semibold">
            No field <span className="font-mono">{missingRequest}</span> on this
            order.
          </span>{" "}
          The link that brought you here points at a field the assembled report
          does not contain — often a complaint about something never extracted.
          Showing the review queue instead.
        </div>
      )}

      {/*
        The two-pane workbench: the scanned document on the left, the report on
        the right. The document is the evidence — every decision on the right is
        answerable only by looking left, which is why it gets half the screen
        (master §0.9: the scanned document is the dominant visual).
      */}
      <div className="flex min-h-0 flex-1">
        <section className="flex min-w-0 flex-1 basis-1/2 flex-col border-r border-line-strong">
          <PdfPane
            fileUrl={null}
            page={pinned?.page ?? selected?.source_page ?? 1}
            pageStamp={`PAGE ${pinned?.page ?? selected?.source_page ?? 1}`}
            highlights={highlights}
            scrollKey={`${selectedPath ?? ""}:${pinned?.engineId ?? ""}`}
          />
        </section>

        <section className="flex min-w-0 flex-1 basis-1/2 flex-col overflow-auto">
          {selected === undefined ? null : (
            <DecisionPanel
              field={selected}
              orderId={orderId}
              onSettled={advance}
              onPin={(p) =>
                setPinned({
                  engineId: p.engineId,
                  seat: p.seat,
                  rects: p.rects,
                  page: p.rects[0]?.page ?? selected.source_page ?? 1,
                })
              }
            />
          )}

          <div className="min-h-0 flex-1">
            {all.map((f) => (
              <FieldRow
                key={f.id}
                field={f}
                selected={f.path === selectedPath}
                onSelect={() => select(f.path)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
