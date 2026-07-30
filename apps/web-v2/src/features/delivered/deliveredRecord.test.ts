import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { DeliveriesResponse, type DeliveryWithReport } from "@titlepipe/contract";
import { mockServer } from "@titlepipe/mocks/node";
import { pickDelivered } from "./deliveredRecord";

/**
 * WHICH DELIVERY THE ORDER-LESS ROUTE CONFIRMS.
 *
 * The bug: two demo orders carry the SAME `delivered_at` — the fixture derives
 * the stamp from the stage — and the tie was broken by version, a comparison
 * that only means something inside one order. The higher number belonged to the
 * reissued order, so `/delivered` opened on REISSUED · v2 and its struck-through
 * disputed field. Every visitor met the exception instead of the case.
 *
 * The first case reads the list OVER HTTP, because a hand-written pair would
 * pass while the served fixture kept the tie. The rest assert the rule itself,
 * so this survives the fixture's timestamps changing.
 */

/** msw's resolver rebases relative handler paths against `location`; Node has none. */
globalThis.location = { href: "http://localhost/" } as Location;

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

describe("pickDelivered", () => {
  test("the order-less route confirms a finalized order, not the reissue", async () => {
    const response = await fetch("http://localhost/api/deliveries");
    expect(response.ok).toBe(true);
    const { deliveries } = DeliveriesResponse.parse(await response.json());

    expect(pickDelivered(deliveries)?.version).toBe(1);
  });

  test("a later version of ANOTHER order does not win a tie", () => {
    const picked = pickDelivered([
      delivery("del_a", "ord_a", 1, "2026-07-24T17:20:00Z"),
      delivery("del_b", "ord_b", 2, "2026-07-24T17:20:00Z"),
    ]);
    expect(picked?.orderId).toBe("ord_a");
  });

  test("a later version of the SAME order still supersedes", () => {
    const picked = pickDelivered([
      delivery("del_a", "ord_a", 1, "2026-07-24T17:20:00Z"),
      delivery("del_b", "ord_a", 2, "2026-07-24T17:20:00Z"),
    ]);
    expect(picked?.version).toBe(2);
  });

  test("a later timestamp still wins outright", () => {
    const picked = pickDelivered([
      delivery("del_a", "ord_a", 3, "2026-07-24T17:20:00Z"),
      delivery("del_b", "ord_b", 1, "2026-07-24T18:00:00Z"),
    ]);
    expect(picked?.orderId).toBe("ord_b");
  });
});

function delivery(
  id: string,
  orderId: string,
  version: number,
  at: string,
): DeliveryWithReport {
  return {
    id,
    report_id: `rep_${id}`,
    method: "email",
    status: "delivered",
    attempted_at: at,
    delivered_at: at,
    evidence: null,
    report: { id: `rep_${id}`, order_id: orderId, version, shape: "A", rendered_at: at },
  };
}
