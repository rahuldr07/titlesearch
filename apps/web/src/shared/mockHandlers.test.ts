import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { mockServer } from "@titlepipe/mocks/node";
import { SAMPLE_PACKAGE_BYTES, registerPackageForTest, sampleBundle } from "@titlepipe/mocks";

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
  required: { field_id: string; ruled_by: string; countersigned_by: string | null }[];
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
    // TWO deliveries, not one: the reissue files its draft row, and a
    // release now files the delivery it produced. Before that, signing a
    // release moved nothing and left the delivered record empty, so the
    // certified artifact had no screen to appear on.
    expect((await getJson<Deliveries>("/api/deliveries")).deliveries.length).toBe(seedDeliveries.length + 2);
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

/*
 * ── known packages ──────────────────────────────────────────────────────────
 * An upload whose real SHA-256 matches a registered bundle hydrates the order
 * it creates; every per-order read then answers from the stores. The
 * committed sample is synthetic and declares the digest of
 * `SAMPLE_PACKAGE_BYTES`, so a File of those bytes reaches it through the
 * real registry path; the rendered-report variant goes through the test seam.
 */

interface Quarantine {
  sha256: string;
  duplicate_of: string | null;
  steps: { id: string; state: string; detail: string | null }[];
  resolved: {
    jurisdiction: string;
    state: string;
    county: string;
    page_count_label: string;
    jurisdiction_label: string;
    note_title: string;
  } | null;
}
interface FieldRow {
  id: string;
  path: string;
  state: string;
  value: string | null;
  na_reason: string | null;
  approved_by: string | null;
  approved_at: string | null;
  readings?: { field_id: string }[];
}
interface Fields {
  fields: FieldRow[];
  census: Record<string, number | string>;
}
interface Composition {
  template_version: string;
  blocks: { id: string; values: { label: string; value: string; pending: boolean; field_id: string | null }[] }[];
  gates: { id: string; passed: boolean; detail: string | null }[];
  releasable: boolean;
  blocked_reason: string | null;
  blocked_door: string | null;
  seal_sha256: string | null;
}
interface Context {
  place: string | null;
  product: string | null;
  pages: number | null;
  outstanding: number | null;
  stamp: { label: string; tone: string };
  stage_tabs: { id: string; done: boolean; badge: string | null }[];
}
interface Pipeline {
  total_pages: number;
  pages_relevant: number;
  eta_label: string;
  package_name: string | null;
  run_log: { text: string }[];
  verified_checks: string[];
  stages: { id: string; phase: string; detail: string; count: string | null }[];
}
interface Artifacts {
  artifacts: { id: string; report_id: string; filename: string; media_type: string; bytes: number; sha256: string; href: string | null }[];
}

const RENDERED_VARIANT_BYTES = "%PDF-1.4 sample package bytes, rendered variant";

async function digestOfText(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function packageForm(bytes: string, fields: Record<string, string> = {}): FormData {
  const form = new FormData();
  form.append("package", new File([bytes], "upload.pdf", { type: "application/pdf" }));
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return form;
}

const postForm = (path: string, form: FormData): Promise<Response> =>
  fetch(url(path), { method: "POST", body: form });

const ORDER_FORM = { client_id: "cli_riverbend", external_ref: "SAMPLE-0001", product: "p_cos" };

/** Upload + sign for the package, as the one intake press does. Returns the new order id. */
async function ingest(bytes: string): Promise<string> {
  const created = await postForm("/api/orders", packageForm(bytes, ORDER_FORM));
  expect(created.status).toBe(201);
  const { order } = (await created.json()) as { order: { id: string } };
  expect((await post(`/api/orders/${order.id}/accept`)).status).toBe(200);
  return order.id;
}

const fieldId = (orderId: string, bundleId: string) => `${orderId}_${bundleId}`;

/** Answer every queued decision and file both second reads — the path to a releasable sheet. */
async function clearEveryGate(orderId: string): Promise<void> {
  const rulings: Record<string, string | null> = {
    fld_3: "HOLLIS T. MARCHBANK, A SINGLE PERSON",
    fld_5: "SAMPLETON SAVINGS BANK",
    fld_6: "$150,000.00",
    fld_7: null,
  };
  for (const [id, value] of Object.entries(rulings)) {
    expect((await post(`/api/fields/${fieldId(orderId, id)}/confirm`, { value })).status).toBe(200);
  }
  for (const id of ["fld_5", "fld_6"]) {
    const signed = await post(`/api/fields/${fieldId(orderId, id)}/countersign`, { signature: "R. Menon" }, { "x-mock-actor": "R. Menon (QC)" });
    expect(signed.status).toBe(200);
  }
}

describe("a known package hydrates the order its upload creates", () => {
  test("the gateway reports the real digest; a known digest resolves the package's own facts, an unknown one keeps today's stamp", async () => {
    const sha = await digestOfText(SAMPLE_PACKAGE_BYTES);
    expect(sha).toBe(sampleBundle().sha256);

    const known = await postForm("/api/intake/quarantine", packageForm(SAMPLE_PACKAGE_BYTES));
    expect(known.status).toBe(200);
    const body = (await known.json()) as Quarantine;
    expect(body.sha256).toBe(sha);
    expect(body.duplicate_of).toBeNull();
    expect(body.steps.find((s) => s.id === "pdf")).toMatchObject({ state: "passed", detail: "%PDF header present · 3 pages per the OCR job" });
    expect(body.steps.find((s) => s.id === "sha")?.state).toBe("passed");
    expect(body.resolved).toMatchObject({
      jurisdiction: "sample-mo",
      state: "MO",
      county: "Sample",
      page_count_label: "3 pages (raster verified)",
      jurisdiction_label: "Sample County, MO",
      note_title: "Missouri overlay bound from clerk stamp",
    });

    const other = "%PDF-1.4 bytes nobody registered";
    const unknown = (await (await postForm("/api/intake/quarantine", packageForm(other))).json()) as Quarantine;
    expect(unknown.sha256).toBe(await digestOfText(other));
    expect(unknown.resolved?.jurisdiction).toBe("clayton-ga");
  });

  test("create fills every per-order read from the bundle, states verbatim, census from the states", async () => {
    const seedRail = await getJson<{ orders_total: number }>("/api/rail");
    const seedLifecycle = await getJson<{ in_review: { value: number } }>("/api/lifecycle");

    const created = await postForm("/api/orders", packageForm(SAMPLE_PACKAGE_BYTES, ORDER_FORM));
    expect(created.status).toBe(201);
    const { order } = (await created.json()) as { order: { id: string; jurisdiction: string; county: string; pages: number; product: string } };
    expect(order).toMatchObject({ jurisdiction: "sample-mo", county: "Sample", pages: 3, product: "Current Owner Search" });
    const id = order.id;
    expect((await post(`/api/orders/${id}/accept`)).status).toBe(200);

    // Fields: every bundle field, its state untouched, ids and readings scoped to the order.
    const sample = sampleBundle();
    const { fields, census } = await getJson<Fields>(`/api/orders/${id}/fields`);
    expect(fields.length).toBe(sample.fields.length);
    for (const b of sample.fields) {
      const served = fields.find((f) => f.id === fieldId(id, b.id));
      expect(served).toMatchObject({ path: b.path, state: b.state, value: b.value, na_reason: b.na_reason });
      expect(served?.readings?.every((r) => r.field_id === fieldId(id, b.id))).toBe(true);
    }
    expect(census).toMatchObject({
      fields: 8, auto_confirmed: 4, needs_review: 4, no_source: 0,
      decisions: 4, settled: 0, queue_rest: 3, remaining: 4, verdict_action: "Verify 4 Fields",
    });

    // Pages and instruments are the bundle's; the T1 ledger holds the two T1-tagged fields.
    const pages = await getJson<{ total_pages: number; pages: { image_url?: string }[]; instruments: unknown[] }>(`/api/orders/${id}/pages`);
    expect(pages.total_pages).toBe(3);
    expect(pages.pages.length).toBe(3);
    expect(pages.instruments.length).toBe(2);
    expect(pages.pages[0]?.image_url).toBeDefined();
    // No second-read rows at hydration: nothing has been ruled yet.
    expect((await getJson<Countersigns>(`/api/orders/${id}/countersigns`)).required).toEqual([]);

    // The spine: the two acts at real instants, then the bundle's own events.
    const timeline = await getJson<{ events: { kind: string; detail: string | null }[] }>(`/api/orders/${id}/timeline`);
    expect(timeline.events.map((e) => e.kind)).toEqual(["arrived", "accepted", "extracted", "review"]);
    expect(timeline.events[1]?.detail).toBe("signed L. Vance");

    // Context: the package's place, the product's name, the live outstanding count, extraction done and examination live.
    const context = await getJson<Context>(`/api/orders/${id}/context`);
    expect(context).toMatchObject({ place: "12 SAMPLE LN, SAMPLETON, MO 65000 · Sample County, MO", product: "Current Owner Search", pages: 3, outstanding: 4 });
    expect(context.stamp).toEqual({ label: "Read by dots-mocr, mineru, unlimited-ocr", tone: "action" });
    expect(context.stage_tabs.find((t) => t.id === "processing")?.done).toBe(true);
    expect(context.stage_tabs.find((t) => t.id === "review")).toMatchObject({ done: false, badge: "4" });
    expect(context.stage_tabs.find((t) => t.id === "composer")?.badge).toBeNull();

    // Pipeline: the bundle's strings, counts composed from the live states, no sign-off claimed.
    const pipeline = await getJson<Pipeline>(`/api/orders/${id}/pipeline`);
    expect(pipeline).toMatchObject({ total_pages: 3, pages_relevant: 3, eta_label: "read in 3 passes", package_name: "sample_package.pdf" });
    expect(pipeline.verified_checks).toEqual(sample.pipeline.verified_checks);
    expect(pipeline.run_log.map((l) => l.text)).toContain("8 fields extracted with strict bounding-box provenance");
    expect(pipeline.run_log.map((l) => l.text)).toContain("4 conflicts routed to examiner · 4 auto-cleared by hard validators");
    expect(pipeline.stages.find((s) => s.id === "extract")?.phase).toBe("done");
    expect(pipeline.stages.find((s) => s.id === "qc")).toMatchObject({ phase: "halted", count: "4 flagged → you" });
    expect(pipeline.stages.find((s) => s.id === "signoff")?.phase).toBe("halted");
    expect(pipeline.stages.find((s) => s.id === "gate")?.detail).toMatch(/^NOT PERFORMED/);
    expect((await getJson<{ signed_by: string | null }>(`/api/orders/${id}/signoff`)).signed_by).toBeNull();
    expect(await getJson<{ gate_open: boolean; gaps: unknown[] }>(`/api/orders/${id}/completeness`)).toMatchObject({ gate_open: false, gaps: [] });

    const quarantine = await getJson<Quarantine>(`/api/orders/${id}/quarantine`);
    expect(quarantine.sha256).toBe(sample.sha256);
    expect(quarantine.resolved?.county).toBe("Sample");

    // It appears wherever the seed orders appear, off the one row store —
    // and the ref finds it typed plainly, not only under the `ref:` scope:
    // every ref in the shop carries a hyphen and the index strips it.
    expect((await getJson<{ total: number; orders: { id: string; stage: string }[] }>("/api/orders?q=ref:SAMPLE-0001")).orders).toMatchObject([{ id, stage: "review" }]);
    expect((await getJson<{ orders: { id: string }[] }>("/api/orders?q=SAMPLE-0001")).orders).toMatchObject([{ id }]);
    expect((await getJson<{ orders_total: number }>("/api/rail")).orders_total).toBe(seedRail.orders_total + 1);
    expect((await getJson<{ in_review: { value: number } }>("/api/lifecycle")).in_review.value).toBe(seedLifecycle.in_review.value + 1);
    expect((await getJson<{ order: { id: string } | null }>("/api/queue/next")).order?.id).toBe(id);
    const bands = await getJson<{ bands: { id: string; orders: { id: string }[] }[] }>("/api/queue/bands");
    expect(bands.bands.find((b) => b.id === "mine")?.orders.some((o) => o.id === id)).toBe(true);

    // Last, because it moves the census: the second-read row for a T1 field opens
    // with the first examiner's ruling, attributed to them and awaiting a countersignature.
    expect((await post(`/api/fields/${fieldId(id, "fld_5")}/confirm`, { value: "SAMPLETON SAVINGS BANK" })).status).toBe(200);
    const ledger = await getJson<{ required: { field_id: string; ruled_by: string; countersigned_by: string | null }[] }>(`/api/orders/${id}/countersigns`);
    expect(ledger.required).toEqual([{ field_id: fieldId(id, "fld_5"), path: expect.any(String), value: "SAMPLETON SAVINGS BANK", ruled_by: "L. Vance", countersigned_by: null }]);
    expect((await getJson<Context>(`/api/orders/${id}/context`)).outstanding).toBe(3);
  });

  test("a second upload of the same bytes fails de-duplication at the door and 409s on create", async () => {
    await ingest(SAMPLE_PACKAGE_BYTES);
    const scan = (await (await postForm("/api/intake/quarantine", packageForm(SAMPLE_PACKAGE_BYTES))).json()) as Quarantine;
    expect(scan.duplicate_of).toBe("SAMPLE-0001");
    expect(scan.resolved).toBeNull();
    expect(scan.steps.find((s) => s.id === "sha")).toMatchObject({ state: "failed", detail: "duplicate package (sha256 match) — byte-identical to SAMPLE-0001" });
    const again = await postForm("/api/orders", packageForm(SAMPLE_PACKAGE_BYTES, ORDER_FORM));
    expect(again.status).toBe(409);
    expect(((await again.json()) as { error: string }).error).toContain("duplicate package (sha256 match)");
  });

  test("the composition is live over the field states; rulings and second reads open the gates, then release seals", async () => {
    const id = await ingest(SAMPLE_PACKAGE_BYTES);
    const path = `/api/orders/${id}/composition`;
    const before = await getJson<Composition>(path);
    expect(before.template_version).toBe("v4.2");
    const rowsBefore = before.blocks.flatMap((b) => b.values);
    expect(rowsBefore.find((v) => v.label === "Grantor")).toEqual({
      label: "Grantor", value: "HOLLIS T. MARCHBANK, A SINGLE PERSON — pending examiner confirmation", pending: true, field_id: "vesting.grantor",
    });
    expect(rowsBefore.find((v) => v.label === "Order number")).toEqual({ label: "Order number", value: "SAMPLE-0001", pending: false, field_id: null });
    expect(rowsBefore.find((v) => v.label === "Consideration")).toEqual({ label: "Consideration", value: "Instrument silent", pending: false, field_id: null });
    expect(rowsBefore.find((v) => v.label === "Maturity date")).toMatchObject({ pending: true, field_id: "deed_of_trust.maturity_date" });
    const gate = (c: Composition, gid: string) => c.gates.find((g) => g.id === gid);
    expect(gate(before, "g1")).toMatchObject({ passed: false, detail: "4 still open" });
    expect(gate(before, "g2")).toMatchObject({ passed: true, detail: "4 of 4 carry a page and a region" });
    expect(gate(before, "g3")?.detail).toMatch(/^NOT PERFORMED/);
    expect(gate(before, "g4")).toMatchObject({ passed: false, detail: "2 T1 rulings not yet made" });
    expect(gate(before, "g5")?.detail).toMatch(/^NOT PERFORMED/);
    expect(before).toMatchObject({ releasable: false, blocked_door: `/orders/${id}/review`, blocked_reason: "2 gates are open. The report cannot compose until each is answered." });
    const refused = await post(`/api/orders/${id}/release`, { signature: "L. Vance" });
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as { error: string }).error).toBe("2 gates are open — the release gate refuses");

    await clearEveryGate(id);
    const after = await getJson<Composition>(path);
    expect(gate(after, "g1")).toMatchObject({ passed: true, detail: "4 of 4 answered" });
    expect(gate(after, "g4")).toMatchObject({ passed: true, detail: "countersigned by R. Menon (QC)" });
    expect(after).toMatchObject({ releasable: true, blocked_reason: null, blocked_door: null, seal_sha256: null });
    expect(after.blocks.flatMap((b) => b.values).find((v) => v.label === "Grantor")).toEqual({
      label: "Grantor", value: "HOLLIS T. MARCHBANK, A SINGLE PERSON", pending: false, field_id: null,
    });
    // The row's stamp followed the work: nothing open, so the composer reads ready.
    const cleared = await getJson<Context>(`/api/orders/${id}/context`);
    expect(cleared.stamp.tone).toBe("settled");
    expect(cleared.stage_tabs.find((t) => t.id === "composer")?.badge).toBe("ready");
    expect(cleared.outstanding).toBe(0);

    expect((await post(`/api/orders/${id}/release`, {})).status).toBe(422);
    const released = await post(`/api/orders/${id}/release`, { signature: "L. Vance" });
    expect(released.status).toBe(200);
    const sealed = await getJson<Composition>(path);
    expect(sealed.seal_sha256).not.toBeNull();
    expect(sealed).toMatchObject({ releasable: false, blocked_door: "/delivery" });
    expect((await getJson<Context>(`/api/orders/${id}/context`)).stamp.label).toBe("Released · sealed");
    const { deliveries } = await getJson<{ deliveries: { id: string; report: { order_ref: string | null } | null }[] }>("/api/deliveries");
    expect(deliveries.find((d) => d.id === `del_${id}`)?.report?.order_ref).toBe("SAMPLE-0001");
    // The sample's report is not rendered (empty digest), so the report row is
    // absent — but the package itself is enclosed the moment the seal files,
    // under the digest the gateway computed over its bytes.
    const { artifacts } = await getJson<Artifacts>(`/api/orders/${id}/artifacts`);
    expect(artifacts.map((a) => a.id)).toEqual([`art_pkg_${id}`]);
    expect(artifacts[0]).toMatchObject({ sha256: sampleBundle().sha256, href: `/scan/${sampleBundle().job}/package.pdf` });
    expect((await getJson<{ order: { id: string } | null }>("/api/queue/next")).order?.id).not.toBe(id);
  });

  test("a rendered report is the certified artifact — the bundle's report object, verbatim", async () => {
    const sha = await digestOfText(RENDERED_VARIANT_BYTES);
    const sample = sampleBundle();
    const report = { ...sample.report, bytes: 123_456, sha256: "ab".repeat(32) };
    registerPackageForTest(sha, { ...sample, report });
    const id = await ingest(RENDERED_VARIANT_BYTES);
    expect((await getJson<Quarantine>(`/api/orders/${id}/quarantine`)).sha256).toBe(sha);
    expect(await getJson<Artifacts>(`/api/orders/${id}/artifacts`)).toEqual({ artifacts: [] });
    await clearEveryGate(id);
    expect((await post(`/api/orders/${id}/release`, { signature: "L. Vance" })).status).toBe(200);
    // Two deliverables once sealed: the rendered report, and the package the
    // readings were taken from — the "enclosed search file" the typed report's
    // closing paragraph refers to — carrying the digest the gateway computed
    // over the uploaded bytes.
    expect(await getJson<Artifacts>(`/api/orders/${id}/artifacts`)).toEqual({
      artifacts: [
        {
          id: `art_rep_${id}`,
          report_id: `rep_${id}`,
          filename: report.filename,
          media_type: report.media_type,
          bytes: report.bytes,
          sha256: report.sha256,
          href: report.href,
        },
        {
          id: `art_pkg_${id}`,
          report_id: `rep_${id}`,
          filename: sample.source.filename,
          media_type: "application/pdf",
          bytes: sample.source.bytes,
          sha256: sha,
          href: `/scan/${sample.job}/package.pdf`,
        },
      ],
    });
  });

  test("a sealed order whose report is not yet rendered still encloses the package, and nothing else", async () => {
    const sha = await digestOfText(SAMPLE_PACKAGE_BYTES);
    const id = await ingest(SAMPLE_PACKAGE_BYTES);
    await clearEveryGate(id);
    expect((await post(`/api/orders/${id}/release`, { signature: "L. Vance" })).status).toBe(200);
    const { artifacts } = await getJson<Artifacts>(`/api/orders/${id}/artifacts`);
    expect(artifacts.map((a) => a.id)).toEqual([`art_pkg_${id}`]);
    expect(artifacts[0]).toMatchObject({ sha256: sha, media_type: "application/pdf" });
  });

  test("the shop holds one order whose examination is finished, and it survives a reset", async () => {
    const done = "ord_done_1";
    const check = async () => {
      // Every decision answered, by the two acts the routes offer.
      const { fields, census } = await getJson<Fields>(`/api/orders/${done}/fields`);
      expect(census).toMatchObject({ needs_review: 0, remaining: 0, no_source: 0 });
      expect(fields.every((f) => f.state !== "needs_review" && f.state !== "pending")).toBe(true);
      expect(fields.filter((f) => f.state === "confirmed" || f.state === "corrected").length).toBeGreaterThan(0);
      // Every ruling this order files is attributed, and its absences carry a reason.
      for (const field of fields) {
        if (field.state === "confirmed" || field.state === "corrected") {
          expect(field.approved_by).toBe("D. Okafor");
          expect(field.approved_at).not.toBeNull();
        }
        if (field.state === "corrected") expect(field.na_reason).not.toBeNull();
      }
      // The second read, by the OTHER examiner — never the one who ruled.
      const ledger = await getJson<Countersigns & { unruled: number }>(`/api/orders/${done}/countersigns`);
      expect(ledger.required.length).toBeGreaterThan(0);
      expect(ledger.unruled).toBe(0);
      for (const row of ledger.required) {
        expect(row.countersigned_by).toBe("R. Menon (QC)");
        expect(row.ruled_by).not.toBe(row.countersigned_by);
      }
      // Every gate green, the sheet releasable, and NOT yet released: the
      // signature is the one act left, and it is a person's.
      const sheet = await getJson<Composition>(`/api/orders/${done}/composition`);
      expect(sheet.gates.every((g) => g.passed)).toBe(true);
      expect(sheet).toMatchObject({ releasable: true, seal_sha256: null, blocked_reason: null });
      expect((await getJson<Artifacts>(`/api/orders/${done}/artifacts`)).artifacts).toEqual([]);
    };
    await check();
    // It is worked, not declared, so the reset has to work it again.
    expect((await post("/api/demo/reset")).status).toBe(200);
    await check();
  });

  test("an artifact links only where the server actually holds the file", async () => {
    /*
     * A fixture delivery has a digest and no bytes. Its href used to be
     * `/api/artifacts/{id}`, an endpoint implemented in no handler: following
     * it is a top-level navigation, no service worker answers those, and the
     * address fell through to the SPA — so "View" on a certified deliverable
     * rendered the application's own not-found screen.
     */
    const seeded = await getJson<Artifacts>("/api/orders/ord_demo_12/artifacts");
    expect(seeded.artifacts.length).toBeGreaterThan(0);
    for (const artifact of seeded.artifacts) {
      expect(artifact.sha256).not.toBe("");
      expect(artifact.href, `${artifact.id} must not link at a file this server has not got`).toBeNull();
    }
    // A hydrated order's report and package ARE files, and say where they are.
    const id = await ingest(SAMPLE_PACKAGE_BYTES);
    await clearEveryGate(id);
    expect((await post(`/api/orders/${id}/release`, { signature: "L. Vance" })).status).toBe(200);
    const live = await getJson<Artifacts>(`/api/orders/${id}/artifacts`);
    expect(live.artifacts.length).toBeGreaterThan(0);
    for (const artifact of live.artifacts) {
      expect(artifact.href).toMatch(/^\/scan\//);
    }
  });

  test("the completed order is not what the queue hands you — that is work with something open", async () => {
    const next = await getJson<{ order: { id: string } | null }>("/api/queue/next");
    expect(next.order?.id).not.toBe("ord_done_1");
    expect(next.order).not.toBeNull();
  });

  test("demo reset drops the hydrated order and frees its digest for another upload", async () => {
    const id = await ingest(SAMPLE_PACKAGE_BYTES);
    expect((await post("/api/demo/reset")).status).toBe(200);
    expect((await fetch(url(`/api/orders/${id}/context`))).status).toBe(404);
    expect((await getJson<Fields>(`/api/orders/${id}/fields`)).fields).toEqual([]);
    expect((await getJson<{ total_pages: number; pages: unknown[] }>(`/api/orders/${id}/pages`))).toMatchObject({ total_pages: 0, pages: [] });
    expect((await getJson<Countersigns>(`/api/orders/${id}/countersigns`)).required).toEqual([]);
    expect((await getJson<{ events: unknown[] }>(`/api/orders/${id}/timeline`)).events).toEqual([]);
    expect((await getJson<{ total: number }>("/api/orders?q=ref:SAMPLE-0001")).total).toBe(0);
    expect((await postForm("/api/orders", packageForm(SAMPLE_PACKAGE_BYTES, ORDER_FORM))).status).toBe(201);
  });
});
