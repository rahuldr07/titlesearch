import { describe, expect, test } from "vitest";
import {
  Field,
  Order,
  OrderContextResponse,
  QueueBandsResponse,
} from "@titlepipe/contract";

/**
 * The order-scoped READ shapes added 2026-07-30 (fidelity Wave 2), pinned here
 * so a later widening cannot quietly undo what each one was added to state.
 * Every assertion is about the SHAPE, never about a fixture's contents — the
 * mocks own those and the mocks are not the contract.
 */

/** Omit one key without `delete` or an unused binding — both are lint errors here. */
function without(source: Record<string, unknown>, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(source).filter(([k]) => k !== key));
}

const ORDER = {
  id: "ord_x",
  client_id: "cli_x",
  external_ref: "4176034-1",
  jurisdiction: "clayton-ga",
  state: "GA",
  county: "Clayton",
  product: "40-Year Search",
  period_label: "40-year period · 07/18/1986 – 07/18/2026",
  pages: 64,
  status: "accepted",
  arrived_at: "2026-07-24T13:05:00Z",
  accepted_at: null,
  delivered_at: null,
};

describe("Order names what was ordered", () => {
  test("product, period_label and pages ride on the entity", () => {
    const order = Order.parse(ORDER);
    expect(order.product).toBe("40-Year Search");
    expect(order.period_label).toBe("40-year period · 07/18/1986 – 07/18/2026");
    expect(order.pages).toBe(64);
  });

  test("all three are nullable — an unresolved order asserts nothing", () => {
    const order = Order.parse({ ...ORDER, product: null, period_label: null, pages: null });
    expect(order.product).toBeNull();
    expect(order.pages).toBeNull();
  });

  test("none of the three is optional — an order may not go silent on them", () => {
    expect(Order.safeParse(without(ORDER, "product")).success).toBe(false);
    expect(Order.safeParse(without(ORDER, "period_label")).success).toBe(false);
    expect(Order.safeParse(without(ORDER, "pages")).success).toBe(false);
  });

  test("pages is an integer count, never a fraction or a string", () => {
    expect(Order.safeParse({ ...ORDER, pages: 63.5 }).success).toBe(false);
    expect(Order.safeParse({ ...ORDER, pages: "64" }).success).toBe(false);
  });
});

describe("GET /api/orders/{id}/context", () => {
  const CONTEXT = {
    order_id: "ord_x",
    order_ref: "4176034-1",
    product: "40-Year Search",
    period_label: "40-year period · 07/18/1986 – 07/18/2026",
    pages: 64,
    stamp: { label: "SIGN-OFF OPEN", tone: "attend" },
  };

  test("carries the human ref the URL id cannot supply", () => {
    expect(OrderContextResponse.parse(CONTEXT).order_ref).toBe("4176034-1");
  });

  test("the stamp is the server's word, with a tone the Stamp component takes", () => {
    for (const label of ["SIGN-OFF OPEN", "DECISIONS OPEN", "PACKAGE INCOMPLETE", "FINALIZED"]) {
      expect(OrderContextResponse.parse({ ...CONTEXT, stamp: { label, tone: "halt" } }).stamp.label).toBe(label);
    }
    for (const tone of ["neutral", "action", "settled", "attend", "halt"]) {
      expect(
        OrderContextResponse.safeParse({ ...CONTEXT, stamp: { label: "FINALIZED", tone } }).success,
      ).toBe(true);
    }
    expect(
      OrderContextResponse.safeParse({ ...CONTEXT, stamp: { label: "FINALIZED", tone: "green" } })
        .success,
    ).toBe(false);
  });

  test("a stamp with no label is refused — there is nothing to print", () => {
    expect(OrderContextResponse.safeParse({ ...CONTEXT, stamp: { tone: "halt" } }).success).toBe(false);
  });
});

describe("GET /api/queue/bands", () => {
  const BAND = {
    id: "held",
    title: "Held",
    note: "stopped · needs someone",
    count: 4,
    orders: [
      {
        id: "ord_y",
        order_ref: "4176011-2",
        addr: "72 Aldergate Rd",
        place: "Greene County · GA",
        waited: "1d 4h",
        waiting_on: "Waiting on the abstractor to add documents",
        state_label: "Package incomplete",
        mine: true,
      },
    ],
  };

  test("a band round-trips, and its count is served beside the rows", () => {
    const parsed = QueueBandsResponse.parse({ bands: [BAND] });
    const band = parsed.bands[0];
    expect(band?.count).toBe(4);
    expect(band?.orders).toHaveLength(1);
  });

  test("count is required — a band may not make the screen derive it", () => {
    expect(QueueBandsResponse.safeParse({ bands: [without(BAND, "count")] }).success).toBe(false);
  });

  test("the four band ids are closed; nothing else is a band", () => {
    for (const id of ["mine", "held", "in_flight", "delivered"]) {
      expect(QueueBandsResponse.safeParse({ bands: [{ ...BAND, id }] }).success).toBe(true);
    }
    expect(QueueBandsResponse.safeParse({ bands: [{ ...BAND, id: "failed" }] }).success).toBe(false);
  });

  test("no row carries a way to take the work", () => {
    const row = QueueBandsResponse.parse({ bands: [BAND] }).bands[0]?.orders[0] ?? {};
    for (const key of ["claim", "assign", "assigned_to", "take", "priority", "rate"]) {
      expect(key in row).toBe(false);
    }
  });
});

describe("a queued field states its question and its reason", () => {
  const FIELD = {
    id: "fld_x",
    order_id: "ord_x",
    path: "owner.names",
    value: null,
    na_reason: null,
    state: "needs_review",
    source_doc_id: null,
    source_page: null,
    source_snippet: null,
    source_line_coords: null,
    engine_id: null,
    engine_confidence_raw: null,
    rule_refs: [],
    approved_by: null,
    approved_at: null,
  };

  test("asking and why parse as strings", () => {
    const field = Field.parse({
      ...FIELD,
      asking: "Is the vested owner MARIA L. ESTRADA or MARIA I. ESTRADA?",
      why: "Two independent readers disagreed on the middle initial.",
    });
    expect(field.asking).not.toBe(field.why);
  });

  test("absent and null are both legal, and are different statements", () => {
    expect(Field.parse(FIELD).asking).toBeUndefined();
    expect(Field.parse({ ...FIELD, asking: null, why: null }).asking).toBeNull();
  });
});
