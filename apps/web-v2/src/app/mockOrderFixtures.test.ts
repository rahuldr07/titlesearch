import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import {
  LifecycleResponse,
  OrderCompletenessResponse,
  OrderPipelineResponse,
  OrderFieldsResponse,
  OrderSignoffResponse,
} from "@titlepipe/contract";
import { mockServer } from "@titlepipe/mocks/node";

/**
 * The mock backend's ORDER-SHAPED ANSWERS, checked against each other over the
 * wire rather than against a copy of themselves.
 *
 * Every assertion here is about two responses AGREEING. The bug this file was
 * written for is the shape of every bug this fixture layer has had: the
 * pipeline said `stages[signoff].phase: "done"` while the sign-off said
 * `signed_by: null`, and the sign-off row rendered "✓ Questions … open" — two
 * server-cited facts saying opposite things, with nothing on screen to tell a
 * reader which one governed.
 *
 * Read over HTTP because that is what the app does. A test that imported the
 * projection functions directly would pass while the handler served something
 * else entirely.
 */

/**
 * The mock's handlers carry RELATIVE paths for the browser Service Worker,
 * which resolves them against the page's own `location`. Node has no such
 * global, so `msw/node` cannot rebase a relative pattern without one — this
 * shim supplies just the `.href` msw's resolver reads, scoped to this file.
 */
globalThis.location = { href: "http://localhost/" } as Location;

interface Parser<T> {
  parse: (value: unknown) => T;
}

async function read<T>(path: string, schema: Parser<T>, role?: string): Promise<T> {
  const response = await fetch(
    `http://localhost${path}`,
    role === undefined ? {} : { headers: { "x-mock-role": role } },
  );
  expect(response.ok).toBe(true);
  return schema.parse(await response.json());
}

const board = (role?: string) => read("/api/lifecycle", LifecycleResponse, role);
const signoff = (id: string) => read(`/api/orders/${id}/signoff`, OrderSignoffResponse);
const pipeline = (id: string) => read(`/api/orders/${id}/pipeline`, OrderPipelineResponse);
const completeness = (id: string) =>
  read(`/api/orders/${id}/completeness`, OrderCompletenessResponse);

/** Every order the board can name — the set every cross-response rule holds over. */
async function everyOrderId(): Promise<string[]> {
  const data = await board();
  return data.stages.flatMap((stage) => stage.orders.map((order) => order.id));
}

beforeAll(() => mockServer.listen({ onUnhandledRequest: "error" }));
afterEach(() => mockServer.resetHandlers());
afterAll(() => mockServer.close());

/**
 * THE RULE THIS FILE EXISTS FOR. `stageAugmentFor` in `orderLifecycle.ts` draws
 * the checkmark from the pipeline's `signoff` phase and the open/signed badge
 * from the sign-off's `signed_by`. Neither is wrong on its own; a fixture that
 * sets one without the other is what renders a contradiction.
 */
describe("a done stage never carries an open badge", () => {
  test("holds for every order the board lists", async () => {
    for (const id of await everyOrderId()) {
      const row = (await pipeline(id)).stages.find((stage) => stage.id === "signoff");
      const signed = (await signoff(id)).signed_by !== null;
      expect(row).toBeDefined();
      if (row?.phase === "done") expect(signed).toBe(true);
      if (!signed) expect(row?.phase).not.toBe("done");
    }
  });

  test("a signed sign-off carries its signer and its time together", async () => {
    for (const id of await everyOrderId()) {
      const data = await signoff(id);
      expect(data.signed_at === null).toBe(data.signed_by === null);
    }
  });
});

describe("the lifecycle board", () => {
  test("draws the export's seven stages, in the export's order", async () => {
    expect((await board()).stages.map((stage) => stage.id)).toEqual([
      "unassigned",
      "intake",
      "machine",
      "gate",
      "review",
      "escalated",
      "delivered",
    ]);
  });

  test("has no failed column — a column that could never hold a card", async () => {
    // OverviewScreen lifts every failed order into its banner, so a `failed`
    // stage would render permanently empty however many orders had failed.
    const data = await board();
    expect(data.stages.map((stage) => stage.id)).not.toContain("failed");
    expect(data.failed).toBeGreaterThan(0);
    const flagged = data.stages.flatMap((stage) => stage.orders.filter((order) => order.failed));
    expect(flagged.length).toBeGreaterThan(0);
  });

  test("every stage says what it is and who it waits on; intake is a halt", async () => {
    const data = await board();
    for (const stage of data.stages) {
      expect(stage.sub.length).toBeGreaterThan(0);
      expect(stage.waiting_on.length).toBeGreaterThan(0);
    }
    const intake = data.stages.find((stage) => stage.id === "intake");
    expect(intake?.label).toBe("Intake & sign-off");
    expect(intake?.sub).toBe("answering the lines");
    expect(intake?.kind).toBe("halt");
  });

  test("the census is never smaller than the cards, and one stage exceeds them", async () => {
    for (const role of ["reviewer", "senior"]) {
      const data = await board(role);
      for (const stage of data.stages) {
        expect(stage.count).toBeGreaterThanOrEqual(stage.orders.length);
      }
      const gate = data.stages.find((stage) => stage.id === "gate");
      expect(gate?.count ?? 0).toBeGreaterThan(gate?.orders.length ?? 0);
    }
  });

  test("the column counts add up to the board's own total", async () => {
    // A board whose columns sum past its total is the next contradiction after
    // the one this file was written for.
    const data = await board();
    const summed = data.stages.reduce((total, stage) => total + stage.count, 0);
    expect(summed).toBe(data.total);
  });

  test("no card is a placeholder — every one names an address and a wait", async () => {
    const data = await board();
    for (const stage of data.stages) {
      for (const order of stage.orders) {
        expect(order.addr).not.toBe("—");
        expect(order.addr.length).toBeGreaterThan(0);
        expect(order.waited).not.toBe("—");
        expect(order.waiting_on).not.toBe("—");
      }
    }
  });

  test("a reviewer sees less than a senior, and is told so", async () => {
    const mine = await board("reviewer");
    const all = await board("senior");
    const count = (data: LifecycleResponse) =>
      data.stages.reduce((total, stage) => total + stage.orders.length, 0);
    expect(count(mine)).toBeLessThan(count(all));
    expect(all.scope_note).toBe("You are seeing every order in the shop.");
    expect(mine.scope_note).toBe(
      "Scoped to your orders plus anything unclaimed — the same gate as the queue. A senior sees all of them.",
    );
  });
});

describe("the processing pipeline", () => {
  const LIVE = "ord_demo_1";

  test("carries the export's eight stages, validation and delivery included", async () => {
    const stages = (await pipeline(LIVE)).stages;
    expect(stages.map((stage) => stage.id)).toEqual([
      "ingest",
      "classify",
      "signoff",
      "gate",
      "extract",
      "assemble",
      "validate",
      "qc",
      "finalize",
    ]);
    const byId = new Map(stages.map((stage) => [stage.id, stage]));
    expect(byId.get("validate")?.label).toBe("Validate & flag");
    expect(byId.get("validate")?.owner).toBe("LLM agent");
    expect(byId.get("finalize")?.label).toBe("Finalize & deliver");
    expect(byId.get("finalize")?.owner).toBe("Automated");
  });

  test("the gate rows name what they check", async () => {
    const byId = new Map((await pipeline(LIVE)).stages.map((stage) => [stage.id, stage]));
    expect(byId.get("gate")?.label).toBe(
      "Completeness gate — checks the package against your sign-off",
    );
    expect(byId.get("qc")?.label).toBe("Human QC gate — the run stops here for you");
  });

  test("the package runs to 64 pages, and nothing still says 38", async () => {
    const data = await pipeline(LIVE);
    expect(data.total_pages).toBe(64);
    expect(data.stages[0]?.detail).toContain(`${data.total_pages} pages`);
    expect(data.classifier_note).toContain(String(data.pages_relevant));
    expect(JSON.stringify(data)).not.toContain("38");
  });

  test("a waiting row says why it has not run", async () => {
    const byId = new Map((await pipeline(LIVE)).stages.map((stage) => [stage.id, stage]));
    expect(byId.get("extract")?.detail).toBe(
      "Held — an incomplete package never reaches extraction.",
    );
    expect(byId.get("qc")?.detail).toBe("Waits until the completeness gate passes.");
    for (const stage of (await pipeline(LIVE)).stages) {
      expect(stage.detail.length).toBeGreaterThan(0);
    }
  });

  test("an unreadable package is never given a page count it does not have", async () => {
    // `pages: null` on the row means the cover could not be read. The ingest
    // row says so in words rather than printing an invented count.
    const failed = await pipeline("ord_demo_7");
    expect(failed.total_pages).toBe(0);
    expect(failed.stages[0]?.phase).toBe("halted");
    expect(failed.stages[0]?.detail).toContain("could not be read");
  });
});

describe("the product's thirteen sign-off lines", () => {
  const LIVE = "ord_demo_1";

  test("there are thirteen, numbered 1..13, ids L01..L13", async () => {
    const lines = (await signoff(LIVE)).lines;
    expect(lines).toHaveLength(13);
    expect(lines.map((line) => line.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    expect(lines[0]?.line_id).toBe("L01");
    expect(lines[12]?.line_id).toBe("L13");
  });

  test("six lines admit N/A; the other seven are YES/NO only", async () => {
    const lines = (await signoff(LIVE)).lines;
    const admitNa = lines.filter((line) => line.answers.includes("N/A"));
    expect(admitNa.map((line) => line.line_id)).toEqual(["L01", "L04", "L06", "L08", "L10", "L11"]);
    expect(lines.length - admitNa.length).toBe(7);
    for (const line of lines) {
      expect(line.answers.slice(0, 2)).toEqual(["YES", "NO"]);
    }
  });

  test("a comment on NO is required on ten and optional on L08, L10, L11", async () => {
    const lines = (await signoff(LIVE)).lines;
    const optional = lines.filter((line) => !line.comment_required);
    expect(optional.map((line) => line.line_id)).toEqual(["L08", "L10", "L11"]);
    expect(lines.filter((line) => line.comment_required)).toHaveLength(10);
  });

  test("the labels are the product's own, not an invented paraphrase", async () => {
    const lines = (await signoff(LIVE)).lines;
    expect(lines[0]?.label).toBe("Taxes and assessors pulled for all parcels");
    expect(lines[5]?.label).toBe("Deed chain complete");
    expect(lines[12]?.label).toBe("Name search, judgment and UCC indexes provided");
  });

  test("the order's own product and period ride with it", async () => {
    const data = await signoff(LIVE);
    expect(data.product_name).toBe("40-Year Search");
    expect(data.period_label).toBe("40-year period · 07/18/1986 – 07/18/2026");
  });

  test("no line is ever given an answer it does not accept", async () => {
    for (const id of await everyOrderId()) {
      for (const line of (await signoff(id)).lines) {
        if (line.answer !== null) expect(line.answers).toContain(line.answer);
        if (line.policy_suggestion !== null) expect(line.answers).toContain(line.policy_suggestion);
      }
    }
  });

  test("a NO carries its comment wherever the line requires one", async () => {
    for (const id of await everyOrderId()) {
      for (const line of (await signoff(id)).lines) {
        if (line.answer === "NO" && line.comment_required) expect(line.comment).not.toBeNull();
      }
    }
  });

  test("a suggestion is never a signature", async () => {
    for (const id of await everyOrderId()) {
      for (const line of (await signoff(id)).lines) {
        if (line.policy_suggestion !== null) expect(line.answer).toBeNull();
        expect(line.prefilled_from_policy).toBe(line.policy_suggestion !== null);
      }
    }
  });
});

describe("the completeness gate", () => {
  const LIVE = "ord_demo_1";

  test("names the ordered product and its dated span", async () => {
    const gate = await completeness(LIVE);
    expect(gate.product_name).toBe("40-Year Search");
    expect(gate.period_label).toBe("40-year period · 07/18/1986 – 07/18/2026");
  });

  test("every gap cites a sign-off line that exists, and quotes its label", async () => {
    const gate = await completeness(LIVE);
    const lines = (await signoff(LIVE)).lines;
    expect(gate.gaps.map((gap) => gap.line_number)).toEqual([11, 7, 6]);
    for (const gap of gate.gaps) {
      const line = lines.find((candidate) => candidate.n === gap.line_number);
      expect(line).toBeDefined();
      expect(gap.line_label).toBe(line?.label);
    }
  });

  test("a gap never contradicts the answer it was raised against", async () => {
    // The gate reads the same thirteen lines the abstractor answered. An N/A
    // gap on a line answered YES would be the fixture arguing with itself.
    const gate = await completeness(LIVE);
    const lines = (await signoff(LIVE)).lines;
    for (const gap of gate.gaps) {
      const answer = lines.find((line) => line.n === gap.line_number)?.answer;
      if (gap.kind === "na_provisional") expect(answer).toBe("N/A");
      if (gap.kind === "disagreement") expect(answer).toBe("YES");
      if (gap.kind === "period_short") expect(answer).not.toBeNull();
    }
  });

  test("the evidence cites the package rather than asserting a disagreement", async () => {
    const gate = await completeness(LIVE);
    const period = gate.gaps.find((gap) => gap.kind === "period_short");
    expect(period?.evidence).toBe(
      "The earliest instrument segmented is dated 03/14/2011 — only a 15-year span.",
    );
    const disagreement = gate.gaps.find((gap) => gap.kind === "disagreement");
    expect(disagreement?.evidence).toContain("none found in the 64 pages");
    for (const gap of gate.gaps) {
      expect(gap.evidence.length).toBeGreaterThan(0);
      expect(gap.claim.length).toBeGreaterThan(0);
    }
  });

  test("close options are structured, and each states what it costs", async () => {
    for (const gap of (await completeness(LIVE)).gaps) {
      expect(gap.close_options.length).toBeGreaterThan(0);
      for (const option of gap.close_options) {
        expect(option.label.length).toBeGreaterThan(0);
        expect(option.consequence.length).toBeGreaterThan(0);
        expect(typeof option.requires_comment).toBe("boolean");
      }
      // Uploading adds evidence and asserts nothing; it leads every card.
      expect(gap.close_options[0]?.kind).toBe("upload");
      expect(gap.close_options[0]?.requires_comment).toBe(false);
    }
  });

  test("the period gap offers three ways out, so the three-across row is drawn", async () => {
    const period = (await completeness(LIVE)).gaps.find((gap) => gap.kind === "period_short");
    expect(period?.close_options.map((option) => option.kind)).toEqual([
      "upload",
      "root_of_title",
      "change_product",
    ]);
    const root = period?.close_options[1];
    expect(root?.requires_comment).toBe(true);
    expect(root?.min_role).toBeNull();
    const changed = period?.close_options[2];
    expect(changed?.requires_comment).toBe(true);
    expect(changed?.min_role).toBe("senior");
  });

  test("an amendable gap offers exactly the two ways out that fit it", async () => {
    const gate = await completeness(LIVE);
    for (const gap of gate.gaps.filter((candidate) => candidate.kind !== "period_short")) {
      expect(gap.close_options.map((option) => option.kind)).toEqual(["upload", "amend"]);
    }
  });

  test("the gate is open only where the pipeline says the run has stopped there", async () => {
    for (const id of await everyOrderId()) {
      const gate = await completeness(id);
      expect(gate.gate_open).toBe((await pipeline(id)).gate_halted);
      if (!gate.gate_open) {
        for (const gap of gate.gaps) expect(gap.closed_by).not.toBeNull();
      }
    }
  });
});

/**
 * FIELDS BELONG TO ONE ORDER, AND THE ENVELOPE MUST NOT LIE ABOUT WHICH.
 *
 * `/api/orders/:id/fields` used to echo the requested id into `order_id` and
 * then return the single module-level field store — ord_demo_1's 21 values —
 * for ANY order. The envelope said ord_demo_4; every row inside it said
 * ord_demo_1. Nothing caught it, because nothing had ever asked a second order
 * for its fields.
 *
 * The strong assertion is the PROVENANCE one: not "a different order gets
 * different data" (which a shuffled fixture would satisfy) but "every value
 * served for order X carries X as its own order_id". That is the invariant the
 * real backend has to hold too, and it fails loudly the moment one order's
 * values are handed out under another's name.
 */
describe("field values carry the order they belong to", () => {
  const LIVE = "ord_demo_1";
  const fields = (id: string) => read(`/api/orders/${id}/fields`, OrderFieldsResponse);

  test("every field served for an order names that order", async () => {
    for (const id of await everyOrderId()) {
      const body = await fields(id);
      expect(body.order_id).toBe(id);
      for (const field of body.fields) {
        expect(field.order_id, `${field.path} served under ${id}`).toBe(id);
      }
    }
  });

  test("the census counts the fields actually served, never another order's", async () => {
    for (const id of await everyOrderId()) {
      const body = await fields(id);
      // `census` is optional on the wire — a server that cannot count says so by
      // omitting it. This mock always counts, and asserting presence keeps the
      // three checks below from passing vacuously on an absent census.
      const census = body.census;
      expect(census, `${id} served no census`).toBeDefined();
      expect(census?.fields).toBe(body.fields.length);
      expect(census?.needs_review).toBe(
        body.fields.filter((f) => f.state === "needs_review").length,
      );
      expect(census?.auto_confirmed).toBe(
        body.fields.filter((f) => f.state === "auto_confirmed").length,
      );
    }
  });

  test("the live review order still carries its whole package", async () => {
    // The order-scoping must not have emptied the one order that has fixtures —
    // an all-empty server would satisfy every assertion above.
    const body = await fields(LIVE);
    expect(body.fields.length).toBeGreaterThan(0);
    expect(body.census?.needs_review).toBeGreaterThan(0);
  });
});
