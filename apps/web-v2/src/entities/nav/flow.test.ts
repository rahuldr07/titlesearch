import { describe, expect, test } from "vitest";
import { FLOW, flowFor, flowRoute, flowSectionLabel } from "./flow";

/**
 * The defect these pin: `AppChrome` spliced Review in only when the URL carried
 * an order, so off an order screen Delivered numbered 5 where the export
 * numbers it 6 — while `LifecycleRail`'s own comment claimed `n` was "drawn
 * even with no active order". Two files asserting opposite rules about one
 * number is worse than either rule on its own.
 */
describe("the flow is six positions, always", () => {
  test("six steps, in the export's order", () => {
    expect(FLOW.map((step) => step.label)).toEqual([
      "Upload",
      "Questions",
      "Processing",
      "Completeness",
      "Review",
      "Delivered",
    ]);
  });

  test("Delivered is position six with an order and without one", () => {
    // The position is the INDEX IN THE DEFINITION, so no filter can shift it.
    expect(FLOW.findIndex((step) => step.label === "Delivered") + 1).toBe(6);
    expect(FLOW.findIndex((step) => step.label === "Review") + 1).toBe(5);
  });

  test("only Review is order-scoped", () => {
    expect(FLOW.filter((step) => step.orderScoped).map((s) => s.label)).toEqual([
      "Review",
    ]);
  });
});

/**
 * The second defect these pin: `AppChrome` filtered the rail with
 * `to.startsWith("/orders/") || held.has(to)`, and the first clause
 * short-circuits the second — the Review row drew for any role at all,
 * including one `canAccess` refuses.
 */
describe("every stage passes the same authz gate the doors pass", () => {
  const labels = (role: Parameters<typeof flowFor>[0]) =>
    flowFor(role).map(({ step }) => step.label);

  test("a role without /orders gets NO Review row", () => {
    // The typist is the one role the table refuses `screen.review.enter`.
    expect(labels("typist")).not.toContain("Review");
  });

  test("a role the table admits still gets it", () => {
    expect(labels("reviewer")).toContain("Review");
    expect(labels("admin")).toContain("Review");
  });

  test("the gate is the door gate — Upload follows /ingest, not the flow", () => {
    // /ingest is ops+admin, so a reviewer's rail opens on Questions.
    expect(labels("reviewer")).not.toContain("Upload");
    expect(labels("ops")).toContain("Upload");
  });

  test("a filtered stage never renumbers the ones after it", () => {
    const positions = new Map(
      flowFor("reviewer").map(({ step, n }) => [step.label, n]),
    );
    expect(positions.get("Questions")).toBe(2);
    expect(positions.get("Review")).toBe(5);
    expect(positions.get("Delivered")).toBe(6);
  });
});

describe("a step resolves to a route, or says it cannot", () => {
  const review = FLOW[4];
  const delivered = FLOW[5];

  test("the plain steps resolve with or without an order", () => {
    expect(delivered && flowRoute(delivered, null)).toBe("/delivered");
    expect(delivered && flowRoute(delivered, "ord_demo_1")).toBe("/delivered");
  });

  test("Review resolves only with an order in view", () => {
    expect(review && flowRoute(review, "ord_demo_1")).toBe("/orders/ord_demo_1/review");
    // null, never a plausible URL: a rail row that navigates somewhere it
    // invented is worse than one that says it cannot go yet.
    expect(review && flowRoute(review, null)).toBeNull();
  });
});

describe("the header never names an order there is none of", () => {
  test("with an order it is the export's own words", () => {
    expect(flowSectionLabel("ord_demo_1")).toBe("THIS ORDER");
  });

  test("without one it names the flow instead", () => {
    expect(flowSectionLabel(null)).toBe("THE FLOW");
  });
});
