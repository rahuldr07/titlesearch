import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { mockServer } from "@titlepipe/mocks/node";

/**
 * Regression gates over the mock backend's own state machines — the handlers
 * ARE the server until FastAPI lands, so a mock that lets an act skip a gate
 * teaches the UI the wrong contract. DOM-free: real requests through
 * msw/node, in the `gates` Vitest project.
 */

const url = (path: string) => `http://localhost${path}`;

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(url(path));
  return (await res.json()) as T;
}

function post(path: string, body?: unknown, headers?: Record<string, string>): Promise<Response> {
  return fetch(url(path), {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body ?? {}),
  });
}

interface DeliveryRow {
  id: string;
  status: string;
  delivered_at: string | null;
  receipt: { id: string; at: string | null; who: string; done: boolean }[];
}
interface Deliveries {
  deliveries: DeliveryRow[];
}
interface Countersigns {
  required: { field_id: string; countersigned_by: string | null }[];
}

beforeAll(() => {
  // msw resolves the handlers' relative paths ("/api/…") against `location`,
  // which the node test environment does not define — pin one so the absolute
  // request URLs above match.
  Object.defineProperty(globalThis, "location", {
    value: new URL("http://localhost/"),
    configurable: true,
  });
  mockServer.listen({ onUnhandledRequest: "error" });
});
afterAll(() => {
  mockServer.close();
});
beforeEach(async () => {
  await post("/api/demo/reset");
});

describe("orders search scoped terms", () => {
  test("a prototype-chain key is not a scoped field — no crash, plain full-text miss", async () => {
    for (const q of ["constructor:x", "hasownproperty:x", "tostring:x"]) {
      const res = await fetch(url(`/api/orders?q=${q}`));
      expect(res.status).toBe(200);
      const body = (await res.json()) as { total: number; orders: unknown[] };
      expect(body.total).toBe(0);
      expect(body.orders).toEqual([]);
    }
  });

  test("a real scoped term still narrows", async () => {
    const body = await getJson<{ total: number }>("/api/orders?q=stage:delivered");
    expect(body.total).toBeGreaterThan(0);
  });
});

describe("delivery retry is the transit act on a bounced transmission only", () => {
  test("an unsigned reissue draft is refused — retry may not transmit around the signature", async () => {
    const reissued = await post("/api/deliveries/del_1/reissue", { reason: "A value in the delivered report requires correction or updating" });
    expect(reissued.status).toBe(200);
    const { deliveries } = await getJson<Deliveries>("/api/deliveries");
    const draft = deliveries.find((d) => d.status === "draft");
    expect(draft).toBeDefined();
    const retried = await post(`/api/deliveries/${draft?.id ?? ""}/retry`);
    expect(retried.status).toBe(409);
    // The draft is still a draft — nothing transmitted.
    const after = await getJson<Deliveries>("/api/deliveries");
    expect(after.deliveries.find((d) => d.id === draft?.id)?.status).toBe("draft");
  });

  test("an already-transmitted or acknowledged delivery is refused", async () => {
    for (const id of ["del_3", "del_1"]) {
      const res = await post(`/api/deliveries/${id}/retry`);
      expect(res.status).toBe(409);
    }
  });

  test("a failed_transit delivery retries, and the unacknowledged ack step keeps done:false and its null instant", async () => {
    const res = await post("/api/deliveries/del_2/retry");
    expect(res.status).toBe(200);
    const { deliveries } = await getJson<Deliveries>("/api/deliveries");
    const d = deliveries.find((x) => x.id === "del_2");
    expect(d?.status).toBe("transmitted");
    const transmit = d?.receipt.find((s) => s.id === "transmit");
    expect(transmit?.done).toBe(true);
    expect(transmit?.at).not.toBeNull();
    const ack = d?.receipt.find((s) => s.id === "ack");
    expect(ack).toMatchObject({ done: false, at: null, who: "not yet acknowledged" });
  });
});

describe("demo reset restores every mutable store to its seed", () => {
  test("deliveries, seals, countersigns, timelines, templates, audit all return to seed", async () => {
    // Seed figures, read before any mutation.
    const seedDeliveries = (await getJson<Deliveries>("/api/deliveries")).deliveries;
    const seedTimeline = await getJson<{ events: unknown[] }>("/api/orders/ord_demo_1/timeline");
    const seedAudit = await getJson<{ entries: unknown[] }>("/api/audit");
    const seedTemplate = await getJson<{ version: string }>("/api/templates/tpl_or_to_v2");
    expect(seedTemplate.version).toBe("v2.1");

    // Mutate one store of each module.
    await post("/api/deliveries/del_2/retry");
    await post("/api/deliveries/del_1/reissue", { reason: "reissue for the reset test" });
    for (const f of ["fld_jgmt_hit", "fld_mtg_amount", "fld_legal_desc"]) {
      const signed = await post(`/api/fields/${f}/countersign`, { signature: "R. Menon" }, { "x-mock-actor": "R. Menon (QC)" });
      expect(signed.status).toBe(200);
    }
    await post("/api/orders/ord_demo_14/release", { signature: "L. Vance" });
    await fetch(url("/api/templates/tpl_or_to_v2"), {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ wording: { header: "edited {{order_number}}" } }),
    });

    // The mutations took: draft row, drained ledger, appended timeline event,
    // saved draft label derived from the template's OWN version, audit rows.
    expect((await getJson<Deliveries>("/api/deliveries")).deliveries.length).toBe(seedDeliveries.length + 1);
    const drained = await getJson<Countersigns>("/api/orders/ord_demo_1/countersigns");
    expect(drained.required.every((r) => r.countersigned_by !== null)).toBe(true);
    expect((await getJson<{ events: unknown[] }>("/api/orders/ord_demo_1/timeline")).events.length).toBe(seedTimeline.events.length + 1);
    expect((await getJson<{ version: string }>("/api/templates/tpl_or_to_v2")).version).toBe("v2.1 → v2.2 draft");
    expect((await getJson<{ entries: unknown[] }>("/api/audit")).entries.length).toBeGreaterThan(seedAudit.entries.length);

    const reset = await post("/api/demo/reset");
    expect(reset.status).toBe(200);

    // Every store is back at seed.
    expect(await getJson<Deliveries>("/api/deliveries")).toEqual({ deliveries: seedDeliveries });
    const ledger = await getJson<Countersigns>("/api/orders/ord_demo_1/countersigns");
    expect(ledger.required.map((r) => r.countersigned_by)).toEqual([null, null, null]);
    expect((await getJson<{ events: unknown[] }>("/api/orders/ord_demo_1/timeline")).events.length).toBe(seedTimeline.events.length);
    expect((await getJson<{ entries: unknown[] }>("/api/audit")).entries.length).toBe(seedAudit.entries.length);
    expect((await getJson<{ version: string }>("/api/templates/tpl_or_to_v2")).version).toBe("v2.1");
    const composition = await getJson<{ releasable: boolean; seal_sha256: string | null }>("/api/orders/ord_demo_14/composition");
    expect(composition.releasable).toBe(true);
    expect(composition.seal_sha256).toBeNull();
  });
});
