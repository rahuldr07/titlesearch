import { describe, expect, test } from "vitest";
import { FLOW_ORDERS, flowOrderFor, screenOrderFor } from "./flowOrders";
import { COMPLETENESS_ORDER_ID } from "../../features/completeness/queries";
import { PIPELINE_ORDER_ID } from "../../features/processing/queries";
import { SIGNOFF_ORDER_ID } from "../../features/questions/queries";

/**
 * THE DEFECT THIS FILE EXISTS FOR. The rail resolved its order from the URL
 * while each flow screen held a private constant, so `/completeness`,
 * `/processing` and `/questions` — none of which carry an order in the path —
 * handed the rail `null`: six grey numbers, no checkmark, no badge, beside a
 * screen rendering that very order's gate.
 *
 * The agreement below is the half that matters. A comment saying "keep these in
 * sync" is what was there before, in three files, and three literals kept in
 * sync by prose are three literals waiting to drift.
 */
describe("a flow route resolves to the order its screen is about", () => {
  test("each of the three, by name", () => {
    expect(flowOrderFor("/completeness")).toBe("ord_demo_1");
    expect(flowOrderFor("/processing")).toBe("ord_demo_1");
    expect(flowOrderFor("/questions")).toBe("ord_demo_4");
  });

  test("sign-off is deliberately a DIFFERENT order from the other two", () => {
    // `ord_demo_1` is already signed, and the answering screen would have
    // nothing left to answer. The rail must show this order's state, not a
    // single continuous journey stitched across three unrelated orders.
    expect(flowOrderFor("/questions")).not.toBe(flowOrderFor("/processing"));
  });

  test("anything else is null — never a plausible stand-in", () => {
    for (const path of ["/queue", "/ingest", "/delivered", "/orders/ord_demo_1/review", "/"]) {
      expect(flowOrderFor(path), path).toBeNull();
    }
  });

  test("`/ingest` and `/delivered` are absent from the map, not merely unmapped", () => {
    // Upload CREATES the order — before the press there is none to name.
    // Delivered picks its own record out of `GET /api/deliveries`; a constant
    // here would be a second answer, free to disagree with the receipt shown.
    expect(Object.keys(FLOW_ORDERS)).toEqual(["/questions", "/processing", "/completeness"]);
  });
});

describe("the screen's order and the rail's order are the same fact", () => {
  test("every flow screen queries the order the resolver hands the rail", () => {
    // Read from the features' own exports, over the module boundary the rail
    // crosses: if either side is edited alone, this fails rather than the rail
    // quietly drawing somebody else's progress.
    expect(COMPLETENESS_ORDER_ID).toBe(flowOrderFor("/completeness"));
    expect(PIPELINE_ORDER_ID).toBe(flowOrderFor("/processing"));
    expect(SIGNOFF_ORDER_ID).toBe(flowOrderFor("/questions"));
  });

  test("the map has an entry for every screen constant, and no spares", () => {
    expect(new Set(Object.values(FLOW_ORDERS))).toEqual(
      new Set([COMPLETENESS_ORDER_ID, PIPELINE_ORDER_ID, SIGNOFF_ORDER_ID]),
    );
  });
});

describe("the URL wins wherever the route carries one", () => {
  test("an order-scoped path resolves to ITS order, not a flow constant", () => {
    expect(screenOrderFor("/orders/ord_demo_9/review")).toBe("ord_demo_9");
    expect(screenOrderFor("/orders/ord_demo_2/review?field=owner.zip")).toBe("ord_demo_2");
  });

  test("a flow route falls through to the map", () => {
    expect(screenOrderFor("/questions")).toBe("ord_demo_4");
  });

  test("everywhere else there is no order, and none is invented", () => {
    expect(screenOrderFor("/queue")).toBeNull();
    expect(screenOrderFor("/rulebook")).toBeNull();
  });

  test("it is a PURE function of the path — no order is remembered", () => {
    // Two tabs on two orders is a normal way to work. Walking a route twice
    // with a different path in between must not change what the second visit
    // resolves to.
    const first = screenOrderFor("/completeness");
    screenOrderFor("/orders/ord_demo_9/review");
    expect(screenOrderFor("/completeness")).toBe(first);
  });
});
