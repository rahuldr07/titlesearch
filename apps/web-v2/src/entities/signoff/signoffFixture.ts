import type { OrderSignoffLine, OrderSignoffResponse } from "@titlepipe/contract";

/**
 * The story fixture for the sign-off entity, in ONE place.
 *
 * RULE: a fixture is a shape, not a screen's private data. FAILURE PREVENTED:
 * two story files each spelling their own `OrderSignoffLine` drift the moment
 * the contract gains a field — one file compiles, the other is quietly a
 * different sign-off — and the row and the block would then be checked against
 * two different products.
 *
 * SEVEN OF THESE LINES ARE YES/NO AND SIX ADMIT N/A, which is the product's own
 * split. `answers` is therefore never the full enum here either: a fixture that
 * offered all three on every line would let a component pass the rule it is
 * supposed to enforce.
 */
export function signoffLine(
  n: number,
  over: Partial<OrderSignoffLine> = {},
): OrderSignoffLine {
  return {
    line_id: `L${String(n).padStart(2, "0")}`,
    n,
    label: `Sign-off line ${n}`,
    group: "Search",
    answer: "YES",
    comment: null,
    comment_required: true,
    answers: ["YES", "NO"],
    policy_suggestion: null,
    machine_check: null,
    period_scoped: false,
    prefilled_from_policy: false,
    ...over,
  };
}

export const SIGNED_SIGNOFF: OrderSignoffResponse = {
  order_id: "ord_demo_1",
  signed_by: "R. Delacroix (abstractor)",
  signed_at: "07/18/2026 09:14 MST",
  product_name: "40-Year Search",
  period_label: "40-year period · 07/18/1986 – 07/18/2026",
  lines: [
    signoffLine(1, { label: "Chain of title searched for the ordered period" }),
    signoffLine(2, {
      label: "Easements and restrictions of record reported",
      answer: "NO",
      comment:
        "No plat or survey was in the package — only prior deed exhibits could be checked.",
    }),
    signoffLine(3, {
      label: "Assessor parcel data reconciled",
      answer: "N/A",
      answers: ["YES", "NO", "N/A"],
      comment_required: false,
    }),
  ],
};

export const UNSIGNED_SIGNOFF: OrderSignoffResponse = {
  ...SIGNED_SIGNOFF,
  signed_by: null,
  signed_at: null,
  lines: SIGNED_SIGNOFF.lines.map((line) => ({
    ...line,
    answer: null,
    comment: null,
    prefilled_from_policy: true,
    policy_suggestion: line.answers.includes("YES") ? "YES" : null,
  })),
};
