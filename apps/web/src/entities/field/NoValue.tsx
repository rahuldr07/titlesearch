import { describeNoValue, type NoValue as NoValueState } from "./noValue";

/**
 * Renders a field that has no value — one of four NA states, or "not yet
 * extracted".
 *
 * Pixel spec: design-mock/ (four treatments) — see
 * docs/frontend/component-inventory.md §2.1. The `pending` treatment is NOT
 * drawn in the design; it is a coverage gap reported in state-coverage.md §2.1,
 * and is designed here to be unmistakably not-an-NA-state: unboxed, so it
 * cannot be read as one of the four chips.
 *
 * The distinction between states is carried by BORDER STYLE and FILL PATTERN as
 * well as colour, so it survives greyscale and colour-blindness. Do not
 * "simplify" these into colour-only variants.
 *
 * Token note: this uses only tokens that do NOT collide with the legacy
 * palette — see the collision list in src/index.css. That is why the page chip
 * uses `page-ref` rather than `action`.
 */

/** Chip treatment per state. Keyed by testId so it cannot drift from the descriptor. */
const CHIP: Record<string, string> = {
  // structurally absent — correct, and recedes. Dashed + italic serif is the
  // quietest treatment in the system; it must never read as a defect.
  "nv-not-present":
    "border border-dashed border-na-not-present-border font-quote text-na-not-present-ink italic",
  // a real gap in the record — solid box, plainly present
  "nv-not-found":
    "border border-na-not-found-border text-na-not-found-ink",
  // the document is silent — a hatch separates it from not-found at a glance
  // without introducing a second colour
  "nv-not-stated":
    "border border-na-not-found-border text-na-silent-ink bg-[repeating-linear-gradient(135deg,transparent,transparent_4px,var(--color-na-silent-hatch)_4px,var(--color-na-silent-hatch)_5px)]",
  // on the page and unreadable — the loudest of the four, and the only one
  // that cites
  "nv-unreadable":
    "border border-na-unreadable-border bg-na-unreadable-surface font-semibold text-na-unreadable-ink",
};

export function NoValue({ state }: { state: NoValueState }) {
  const d = describeNoValue(state);

  // `pending` is deliberately unboxed — a pipeline state, not a document state.
  // Giving it the same chip shape as the four would be the collapse this
  // module exists to prevent.
  if (d.tone === "pipeline") {
    return (
      <span data-testid={d.testId} className="text-xs text-ink-muted italic">
        {d.label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-baseline gap-2">
      <span
        data-testid={d.testId}
        className={`inline-flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-xs ${CHIP[d.testId] ?? ""}`}
      >
        {state.kind === "unreadable" ? <span aria-hidden="true">◑</span> : null}
        {d.label}
      </span>
      {/*
        Only `unreadable` carries a page, and it must: it is the one state that
        asserts something IS on a specific page. A page-less unreadable would be
        a claim with nothing behind it (principle 6).
      */}
      {d.carriesPage && state.kind === "unreadable" && state.page !== null ? (
        <span
          data-testid="nv-unreadable-page"
          className="rounded-xs border border-page-ref-border bg-page-ref-surface px-1.5 py-px font-mono text-tiny font-semibold text-page-ref"
        >
          p{state.page}
        </span>
      ) : null}
    </span>
  );
}
