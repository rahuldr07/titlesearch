import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  OrderContextResponse,
  PreferencesResponse,
  QueueBandsResponse,
  QueueNextResponse,
} from "@titlepipe/contract";
import { mockServer } from "@titlepipe/mocks/node";

/**
 * ROUND TRIPS OVER THE WIRE for the reads added 2026-07-30 (fidelity Wave 2):
 * `/api/queue/next`, `/api/queue/bands`, `/api/orders/{id}/context`, and the
 * preference PATCH → GET.
 *
 * These deliberately go through `mockServer` rather than calling the handler
 * functions directly. `packages/mocks` IS the backend until the FastAPI core
 * lands, and what a screen actually receives is the SERIALISED body — a test
 * that calls the projection function proves the projection and nothing about
 * the route, the status code or the JSON that survives the round trip.
 *
 * Every assertion here is about a SERVED SHAPE or a number the 2026-07-28
 * export pins. None of them recomputes something the server said: `count` is
 * read, never compared to a length the test derived itself, and the four band
 * ids are asserted as the server ordered them.
 *
 * The mock's handlers carry RELATIVE paths for the browser Service Worker,
 * which resolves them against the page's `location`. Node has no such global,
 * so this supplies just the `.href` msw's `getAbsoluteUrl` reads — the same
 * shim `src/app/preferences.test.ts` documents, scoped to this file.
 */
globalThis.location = { href: "http://localhost/" } as Location;

const BASE = "http://localhost";

async function getJson(path: string, role?: string): Promise<unknown> {
  const response = await fetch(
    `${BASE}${path}`,
    role === undefined ? {} : { headers: { "x-mock-role": role } },
  );
  expect(response.ok).toBe(true);
  return response.json();
}

describe("the mock serves one order set", () => {
  beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
  afterEach(() => mockServer.resetHandlers());
  afterAll(() => mockServer.close());

  describe("GET /api/queue/next", () => {
    test("hands over the export's own first order, package anchors and all", async () => {
      const body = QueueNextResponse.parse(await getJson("/api/queue/next"));
      const order = body.order;
      expect(order?.external_ref).toBe("4176034-1");
      // Quoted from the shared set, which quotes the export: 64, not 38.
      expect(order?.pages).toBe(64);
      expect(order?.product).toBe("40-Year Search");
      expect(order?.period_label).toBe("40-year period · 07/18/1986 – 07/18/2026");
    });
  });

  describe("GET /api/queue/bands", () => {
    test("a senior is served four bands, in the export's order and copy", async () => {
      const body = QueueBandsResponse.parse(
        await getJson("/api/queue/bands", "senior"),
      );
      expect(body.bands.map((band) => [band.id, band.title, band.note])).toEqual([
        ["mine", "Mine", "in progress"],
        ["held", "Held", "stopped · needs someone"],
        ["in_flight", "In flight", "processing · senior · ops view"],
        ["delivered", "Recently delivered", "get back to a recent one"],
      ]);
    });

    test("a reviewer is served no in-flight band at all — absent, not empty", async () => {
      const body = QueueBandsResponse.parse(
        await getJson("/api/queue/bands", "reviewer"),
      );
      expect(body.bands.map((band) => band.id)).toEqual(["mine", "held", "delivered"]);
    });

    test("a reviewer's held list narrows to their own work", async () => {
      const body = QueueBandsResponse.parse(
        await getJson("/api/queue/bands", "reviewer"),
      );
      const held = body.bands.find((band) => band.id === "held");
      expect(held?.orders.every((order) => order.mine)).toBe(true);
      expect(held?.orders.map((order) => order.order_ref)).toEqual([
        "4176011-2",
        "4175994-0",
      ]);
    });

    test("the census does not shrink with your permissions", async () => {
      const asSenior = QueueBandsResponse.parse(
        await getJson("/api/queue/bands", "senior"),
      );
      const asReviewer = QueueBandsResponse.parse(
        await getJson("/api/queue/bands", "reviewer"),
      );
      const seniorHeld = asSenior.bands.find((band) => band.id === "held");
      const reviewerHeld = asReviewer.bands.find((band) => band.id === "held");
      // Same served count on both sides; only the row list narrowed. A count
      // that fell would read as work disappearing rather than as work the
      // reviewer is not allowed to open.
      expect(reviewerHeld?.count).toBe(seniorHeld?.count);
      expect(reviewerHeld?.orders.length).toBeLessThan(seniorHeld?.orders.length ?? 0);
    });

    test("count is served beside the rows and is never smaller than them", async () => {
      for (const role of ["reviewer", "senior", "ops", "admin"]) {
        const body = QueueBandsResponse.parse(await getJson("/api/queue/bands", role));
        for (const band of body.bands) {
          expect(band.count).toBeGreaterThanOrEqual(band.orders.length);
        }
      }
    });

    test("no served row carries a way to take the work", async () => {
      // Asserted on the RAW body: `QueueBandsResponse.parse` strips unknown
      // keys, so a post-parse check could not see a claim token if one were
      // ever served. /api/queue/next stays the only hand-over.
      const raw = (await getJson("/api/queue/bands", "senior")) as {
        bands: { orders: Record<string, unknown>[] }[];
      };
      const rows = raw.bands.flatMap((band) => band.orders);
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        for (const key of [
          "claim",
          "assign",
          "assigned_to",
          "take",
          "priority",
          "rate",
        ]) {
          expect(key in row).toBe(false);
        }
      }
    });
  });

  describe("GET /api/orders/{id}/context", () => {
    /**
     * The ids are DISCOVERED from what the server already served — the bands
     * plus the one order `/api/queue/next` hands over, which is served by no
     * band. Reading them out of the fixture module instead would test the
     * fixture against itself.
     */
    async function servedOrderIds(): Promise<string[]> {
      const bands = QueueBandsResponse.parse(
        await getJson("/api/queue/bands", "admin"),
      );
      const next = QueueNextResponse.parse(await getJson("/api/queue/next"));
      const ids = bands.bands.flatMap((band) => band.orders.map((order) => order.id));
      const served = next.order?.id;
      return served === undefined ? ids : [...new Set([...ids, served])];
    }

    test("round-trips for every order the server will name", async () => {
      const ids = await servedOrderIds();
      expect(ids.length).toBeGreaterThan(0);
      for (const id of ids) {
        const parsed = OrderContextResponse.safeParse(
          await getJson(`/api/orders/${id}/context`),
        );
        expect(parsed.success).toBe(true);
        expect(parsed.success && parsed.data.order_id).toBe(id);
        expect(parsed.success && parsed.data.order_ref.length).toBeGreaterThan(0);
      }
    });

    test("names the human ref the URL id cannot supply, with a decided stamp", async () => {
      const body = OrderContextResponse.parse(
        await getJson("/api/orders/ord_demo_1/context"),
      );
      expect(body.order_ref).toBe("4176034-1");
      expect(body.product).toBe("40-Year Search");
      expect(body.period_label).toBe("40-year period · 07/18/1986 – 07/18/2026");
      expect(body.pages).toBe(64);
      // The word arrives already chosen — the export computes it from a
      // five-branch if/else in the browser, which is a state machine.
      expect(body.stamp).toEqual({ label: "Package incomplete", tone: "halt" });
    });

    test("an unreadable package reports null pages, never zero", async () => {
      const contexts = await Promise.all(
        (await servedOrderIds()).map(async (id) =>
          OrderContextResponse.parse(await getJson(`/api/orders/${id}/context`)),
        ),
      );
      const failed = contexts.find((context) => context.order_ref === "4175998-9");
      expect(failed?.pages).toBeNull();
      // Nothing in the served set claims a zero-page package: 0 is a count and
      // a count is a claim somebody counted.
      expect(contexts.some((context) => context.pages === 0)).toBe(false);
    });

    test("an id that names no order is refused rather than invented", async () => {
      const response = await fetch(`${BASE}/api/orders/ord_nope/context`);
      expect(response.status).toBe(404);
    });
  });

  describe("PATCH then GET /api/me/preferences", () => {
    async function patchPrefs(body: Record<string, unknown>): Promise<unknown> {
      const response = await fetch(`${BASE}/api/me/preferences`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      expect(response.ok).toBe(true);
      return response.json();
    }

    test("a chosen nav_collapsed survives the next GET", async () => {
      PreferencesResponse.parse(await patchPrefs({ nav_collapsed: true }));
      const got = PreferencesResponse.parse(await getJson("/api/me/preferences"));
      expect(got.preferences.nav_collapsed).toBe(true);
    });

    test("a sent null is stored as null, not read as an omission", async () => {
      // "Never chosen" has to be writable and readable, or the route default it
      // exists for can never come back.
      PreferencesResponse.parse(await patchPrefs({ nav_collapsed: true }));
      PreferencesResponse.parse(await patchPrefs({ nav_collapsed: null }));
      const got = PreferencesResponse.parse(await getJson("/api/me/preferences"));
      expect(got.preferences.nav_collapsed).toBeNull();
    });

    test("theme round-trips, and an unsent field is left alone", async () => {
      PreferencesResponse.parse(await patchPrefs({ nav_collapsed: false }));
      PreferencesResponse.parse(await patchPrefs({ theme: "mocha" }));
      const got = PreferencesResponse.parse(await getJson("/api/me/preferences"));
      expect(got.preferences.theme).toBe("mocha");
      expect(got.preferences.nav_collapsed).toBe(false);
    });
  });
});
