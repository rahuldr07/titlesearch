import { describe, expect, test } from "vitest";
import {
  CompletenessGap,
  LifecycleStage,
  OrderSignoffLine,
} from "@titlepipe/contract";

/**
 * The intake READ shapes added 2026-07-30 (fidelity Wave 2). Same rule as
 * `contractOrderReads.test.ts`: these assert the SHAPE, not a fixture. The
 * product's thirteen sign-off lines and the gate's own gaps live in
 * `packages/mocks` and are tested there.
 */

/** Omit one key without `delete` or an unused binding — both are lint errors here. */
function without(source: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([k]) => k !== key));
}

const LINE = {
  line_id: "L11",
  n: 11,
  label: "Plat map, or tax/GIS map, included",
  group: "Legal",
  answer: null,
  comment: null,
  comment_required: false,
  answers: ["YES", "NO", "N/A"],
  policy_suggestion: null,
  machine_check: "Plat/GIS image segmented",
  period_scoped: false,
  prefilled_from_policy: false,
};

describe("a sign-off line states which answers it accepts", () => {
  test("a YES/NO-only line is expressible — the set is per line, not global", () => {
    const line = OrderSignoffLine.parse({ ...LINE, answers: ["YES", "NO"] });
    expect(line.answers).toEqual(["YES", "NO"]);
    expect(line.answers).not.toContain("N/A");
  });

  test("answers is required — a line may not leave the set to the screen", () => {
    expect(OrderSignoffLine.safeParse(without(LINE, "answers")).success).toBe(false);
    expect(OrderSignoffLine.safeParse(without(LINE, "policy_suggestion")).success).toBe(false);
  });

  test("only the three declared answers are answers", () => {
    expect(OrderSignoffLine.safeParse({ ...LINE, answers: ["YES", "NA"] }).success).toBe(false);
    expect(OrderSignoffLine.safeParse({ ...LINE, answers: ["YES", "MAYBE"] }).success).toBe(false);
  });
});

describe("policy names the answer it suggests", () => {
  test("policy_suggestion is an answer, not a boolean", () => {
    expect(OrderSignoffLine.parse({ ...LINE, policy_suggestion: "N/A" }).policy_suggestion).toBe("N/A");
    expect(OrderSignoffLine.safeParse({ ...LINE, policy_suggestion: true }).success).toBe(false);
  });

  test("null is the honest value where policy suggested nothing", () => {
    expect(OrderSignoffLine.parse(LINE).policy_suggestion).toBeNull();
  });

  test("prefilled_from_policy survives beside it — THAT and WHAT are two facts", () => {
    const line = OrderSignoffLine.parse({
      ...LINE,
      prefilled_from_policy: true,
      policy_suggestion: "N/A",
    });
    expect(line.prefilled_from_policy).toBe(true);
    // A suggestion is never a given answer: ruling Q13 turns on the difference,
    // so the two members stay separate and `answer` stays null here.
    expect(line.answer).toBeNull();
  });
});

describe("a completeness gap cites its sign-off line and its ways out", () => {
  const OPTION = {
    kind: "root_of_title",
    label: "⊢ Root of title reached",
    consequence: "Asserts the search is complete and nothing older exists. A claim — needs a comment.",
    requires_comment: true,
    min_role: null,
  };
  const GAP = {
    id: "g3",
    kind: "period_short",
    line_number: 6,
    line_label: "Deed chain complete",
    claim: "Line 6 requires the search abstracted back to 07/18/1986.",
    evidence: "The earliest instrument segmented is dated 03/14/2011 — only a 15-year span.",
    close_options: [OPTION],
    closed_by: null,
    closed_note: null,
  };

  test("line_number is on the wire — the card's heading claims to print it", () => {
    expect(CompletenessGap.parse(GAP).line_number).toBe(6);
    expect(CompletenessGap.safeParse(without(GAP, "line_number")).success).toBe(false);
  });

  test("close_options are structured, and an opaque string is refused", () => {
    expect(CompletenessGap.safeParse({ ...GAP, close_options: ["Upload the missing pages"] }).success).toBe(false);
  });

  test("the four close kinds are closed", () => {
    for (const kind of ["upload", "amend", "root_of_title", "change_product"]) {
      expect(CompletenessGap.safeParse({ ...GAP, close_options: [{ ...OPTION, kind }] }).success).toBe(true);
    }
    expect(CompletenessGap.safeParse({ ...GAP, close_options: [{ ...OPTION, kind: "resume" }] }).success).toBe(false);
  });

  test("every option ranks itself — consequence, comment and role are required", () => {
    for (const key of ["consequence", "requires_comment", "min_role"]) {
      expect(
        CompletenessGap.safeParse({ ...GAP, close_options: [without(OPTION, key)] }).success,
      ).toBe(false);
    }
    expect(CompletenessGap.parse({ ...GAP, close_options: [{ ...OPTION, min_role: "senior" }] })
      .close_options[0]?.min_role).toBe("senior");
  });
});

describe("a lifecycle stage says what it is and who it waits on", () => {
  const CARD = {
    id: "ord_x",
    order_ref: "4176011-2",
    addr: "72 Aldergate Rd",
    county: "Greene County · GA",
    waiting_on: "Waiting on the abstractor to add documents",
    waited: "1d 4h",
    failed: false,
    mine: true,
    state_label: "Package incomplete",
  };
  const STAGE = {
    id: "intake",
    label: "Intake & sign-off",
    sub: "answering the lines",
    waiting_on: "abstractor",
    kind: "halt",
    count: 3,
    orders: [CARD],
  };

  test("sub and waiting_on are required — an empty column still describes itself", () => {
    expect(LifecycleStage.parse({ ...STAGE, orders: [] }).sub).toBe("answering the lines");
    for (const key of ["sub", "waiting_on"]) {
      expect(LifecycleStage.safeParse(without(STAGE, key)).success).toBe(false);
    }
  });

  test("a card carries the id that opens it, and says whose it is", () => {
    const card = LifecycleStage.parse(STAGE).orders[0];
    expect(card?.id).toBe("ord_x");
    expect(card?.mine).toBe(true);
    for (const key of ["id", "mine"]) {
      expect(
        LifecycleStage.safeParse({ ...STAGE, orders: [without(CARD, key)] }).success,
      ).toBe(false);
    }
  });

  test("state_label is a free label and is null when nothing stopped", () => {
    expect(LifecycleStage.parse({ ...STAGE, orders: [{ ...CARD, state_label: null }] })
      .orders[0]?.state_label).toBeNull();
    // Deliberately NOT an enum: an enum invites a client-side switch, which is
    // the state machine hard rule 3 puts on the server.
    expect(LifecycleStage.safeParse({ ...STAGE, orders: [{ ...CARD, state_label: "Anything" }] }).success).toBe(true);
  });

  test("count stays beside the rows and is never inferred from them", () => {
    const stage = LifecycleStage.parse(STAGE);
    expect(stage.count).toBe(3);
    expect(stage.count).toBeGreaterThan(stage.orders.length);
  });
});
