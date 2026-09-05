import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { mockServer } from "@titlepipe/mocks/node";
import { guard, seatOf, MOCK_ROLE_HEADER } from "@titlepipe/mocks/guard";
import {
  AuditResponse,
  PERMISSIONS,
  ROLES,
  SEAT_IDENTITIES,
  rulesFor,
  type Action,
  type Role,
} from "@titlepipe/contract";
import { DEMO_ACCOUNTS } from "../app/session/demoAccounts";
import { mockAuthHeaders } from "./api";

/**
 * The mock backend's authentication posture, as gates rather than as prose.
 *
 * These handlers are what the running application talks to — core-api ships no
 * mutating product route — so what they do about a missing credential and a
 * typed signer IS the app's posture, not a fixture detail. Three findings live
 * here, and each one existed on a tree whose whole suite was green:
 *
 *   FX-27 — a MISSING `x-mock-role` was read as `admin`, so sending nothing
 *           was stronger than sending anything.
 *   FX-28 — `corrected_by` on the golden ledger came off `x-mock-actor`, a
 *           free-text header, so the signature was chosen by the signer.
 *   FX-13 — the browser sent two mock headers where core-api refuses one, so
 *           a request carrying only the second walked past its guard.
 *
 * DOM-free, `gates` project, real requests through msw/node.
 */

const url = (path: string) => `http://localhost${path}`;

const post = (path: string, body?: unknown, headers?: Record<string, string>) =>
  fetch(url(path), {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body ?? {}),
  });

interface GoldenField {
  id: string;
  corrected_by: string | null;
  corrected_at: string | null;
}
const goldenField = async (id: string): Promise<GoldenField | undefined> => {
  const res = await fetch(url("/api/golden"));
  const body = (await res.json()) as { golden_fields: GoldenField[] };
  return body.golden_fields.find((g) => g.id === id);
};

/** A well-formed correction body — the EVIDENCE, which is all the client sends. */
const CORRECTION = {
  golden_field_id: "gf_1",
  corrected_value: "30297",
  source_citation: "Deed Bk 4412 Pg 88, legal description line 3",
  reason: "the seed transcribed the ZIP from the mailing address, not the parcel",
};

beforeAll(() => {
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

/* ── FX-27 — an absent credential is not a seat ─────────────────────────── */

describe("a request with no credential is refused, never promoted", () => {
  /*
   * Exhaustive over the policy table rather than over a sample of routes:
   * every action the product has, checked against a request holding no
   * header. A new action added to PERMISSIONS is covered the day it lands,
   * which a hand-listed set of URLs would not be.
   */
  const ACTIONS: readonly Action[] = PERMISSIONS.map((p) => p.action);

  test("every action in the table refuses a header-less caller with 401", () => {
    const anonymous = new Request(url("/api/anything"), { method: "POST" });
    for (const action of ACTIONS) {
      expect(guard(anonymous, action)?.status, action).toBe(401);
    }
  });

  test("no header-less caller resolves to a seat at all", () => {
    expect(seatOf(new Request(url("/api/anything")))).toBeNull();
  });

  test("a header-less caller is weaker than the weakest real seat", () => {
    /*
     * The literal statement of the rule this broke. `typist` holds the fewest
     * grants of any role; the anonymous caller must hold fewer still, and
     * "fewer" here is zero. Before the fix the anonymous caller held ADMIN's
     * grants — the most in the table — which is the inversion.
     */
    const weakest = [...ROLES].sort(
      (a, b) => rulesFor(a).length - rulesFor(b).length,
    )[0] as Role;
    expect(rulesFor(weakest).length).toBeGreaterThan(0);
    const anonymous = new Request(url("/api/anything"), { method: "POST" });
    for (const { action } of rulesFor(weakest)) {
      expect(guard(anonymous, action as Action)?.status, action).toBe(401);
    }
  });

  test("the header-less mutation the finding named is 401, not 201", async () => {
    const res = await post("/api/golden/corrections", CORRECTION);
    expect(res.status).toBe(401);
    expect((await goldenField("gf_1"))?.corrected_at).toBeNull();
  });

  test("a seat that genuinely lacks the grant still gets 403, not 401", async () => {
    // The two refusals must stay distinguishable: 401 says "you are nobody",
    // 403 says "you are somebody who may not". Collapsing them would hide the
    // regression this file exists to catch.
    const res = await post("/api/golden/corrections", CORRECTION, {
      [MOCK_ROLE_HEADER]: "typist",
    });
    expect(res.status).toBe(403);
  });

  test("a forged role stays 403 on mutation and 400 on the projection", async () => {
    const forged = { [MOCK_ROLE_HEADER]: "superadmin" };
    expect((await post("/api/golden/corrections", CORRECTION, forged)).status).toBe(403);
    expect((await fetch(url("/api/me/permissions"), { headers: forged })).status).toBe(400);
  });

  test("the permissions projection refuses a header-less caller instead of answering admin", async () => {
    const res = await fetch(url("/api/me/permissions"));
    expect(res.status).toBe(401);
    // The specific thing that used to come back: the admin role and all of its
    // grants, to a caller who identified themselves as nobody.
    expect(await res.text()).not.toContain("admin");
  });

  test("a real seat still gets exactly its own projection", async () => {
    const res = await fetch(url("/api/me/permissions"), {
      headers: { [MOCK_ROLE_HEADER]: "typist" },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { role: Role; rules: unknown[] };
    expect(body.role).toBe("typist");
    expect(body.rules.length).toBe(rulesFor("typist").length);
    expect(body.rules.length).toBeLessThan(rulesFor("admin").length);
  });
});

/* ── FX-28 — the signer is a product of the credential ──────────────────── */

describe("the golden ledger's signature cannot be chosen by the caller", () => {
  const FORGERY = "Someone Who Never Touched This";

  test("a correction is signed by the seat, whatever name the caller supplies", async () => {
    const res = await post("/api/golden/corrections", CORRECTION, {
      [MOCK_ROLE_HEADER]: "senior",
      // The exact header that used to be believed, plus the spellings a
      // reintroduction would most plausibly take.
      "x-mock-actor": FORGERY,
      "x-actor": FORGERY,
      "x-user": FORGERY,
    });
    expect(res.status).toBe(201);
    expect((await goldenField("gf_1"))?.corrected_by).toBe(SEAT_IDENTITIES.senior);
  });

  test("no body field names a signer either", async () => {
    const res = await post(
      "/api/golden/corrections",
      { ...CORRECTION, corrected_by: FORGERY, actor: FORGERY, signature: FORGERY },
      { [MOCK_ROLE_HEADER]: "engineer" },
    );
    expect(res.status).toBe(201);
    expect((await goldenField("gf_1"))?.corrected_by).toBe(SEAT_IDENTITIES.engineer);
  });

  test("two seats signing the same act produce two different names", async () => {
    // The property that makes it a signature rather than a label: the recorded
    // name tracks the CREDENTIAL. Same request body, same forged headers, two
    // roles, two answers.
    // gf_4 rather than gf_2: the seed already resolved gf_2, and a resolved
    // field 409s — the test would then be reading a seed name and calling it
    // a signature.
    await post("/api/golden/gf_4/confirm", { reason: "the seed reads correctly" }, {
      [MOCK_ROLE_HEADER]: "senior",
      "x-mock-actor": FORGERY,
    });
    const first = (await goldenField("gf_4"))?.corrected_by;
    await post("/api/demo/reset");
    await post("/api/golden/gf_4/confirm", { reason: "the seed reads correctly" }, {
      [MOCK_ROLE_HEADER]: "engineer",
      "x-mock-actor": FORGERY,
    });
    const second = (await goldenField("gf_4"))?.corrected_by;
    expect(first).toBe(SEAT_IDENTITIES.senior);
    expect(second).toBe(SEAT_IDENTITIES.engineer);
    expect(first).not.toBe(second);
  });

  test("a demotion is signed the same way", async () => {
    const res = await post("/api/golden/gf_3/demote", { reason: "the instrument is illegible at this line" }, {
      [MOCK_ROLE_HEADER]: "engineer",
      "x-mock-actor": FORGERY,
    });
    expect(res.status).toBe(201);
    expect((await goldenField("gf_3"))?.corrected_by).toBe(SEAT_IDENTITIES.engineer);
  });

  test("the audit ledger records the seat, not a supplied name", async () => {
    /*
     * Parsed through the contract rather than cast, and asserted on the row
     * COUNT before the row content: a 404 on a rule id that does not exist
     * appends nothing, and a test reading a name off an unchanged ledger
     * cannot fail. `rule_draft_hoa` is the seed's pending rule; entries are
     * unshifted, so the new row is at the head.
     */
    const audit = async () => AuditResponse.parse(await (await fetch(url("/api/audit"))).json());
    const before = await audit();
    const confirmed = await post("/api/rules/rule_draft_hoa/confirm", undefined, {
      [MOCK_ROLE_HEADER]: "engineer",
      "x-mock-actor": FORGERY,
    });
    expect(confirmed.status).toBe(200);
    const after = await audit();
    expect(after.entries.length).toBe(before.entries.length + 1);
    expect(after.entries[0]?.action).toBe("rule_confirmed");
    expect(after.entries[0]?.actor_id).toBe(SEAT_IDENTITIES.engineer);
  });

  test("one caller cannot satisfy the different-examiner rule alone", async () => {
    /*
     * The countersign exists to prove a SECOND pair of eyes. While the examiner
     * was whatever `x-mock-actor` said, the seat that ruled could countersign
     * its own ruling by typing a different name the second time. The seed rows
     * were ruled by `admin`, so admin is now refused there and senior is not —
     * and the typed signature, which is a client field, changes neither answer.
     */
    const asAdmin = await post("/api/fields/fld_jgmt_hit/countersign", { signature: "R. Menon" }, {
      [MOCK_ROLE_HEADER]: "admin",
      "x-mock-actor": "R. Menon",
    });
    expect(asAdmin.status).toBe(409);

    const asSenior = await post("/api/fields/fld_jgmt_hit/countersign", { signature: SEAT_IDENTITIES.senior }, {
      [MOCK_ROLE_HEADER]: "senior",
    });
    expect(asSenior.status).toBe(200);
    const ledger = (await (await fetch(url("/api/orders/ord_demo_1/countersigns"))).json()) as {
      required: { field_id: string; countersigned_by: string | null }[];
    };
    expect(
      ledger.required.find((r) => r.field_id === "fld_jgmt_hit")?.countersigned_by,
    ).toBe(SEAT_IDENTITIES.senior);
  });
});

/* ── FX-13 — one mock header on the wire, and the same one on both sides ── */

describe("the browser's mock-auth headers are exactly the set core-api refuses", () => {
  /**
   * Reads core-api's own refusal set out of the Python rather than restating
   * it. `MockAuthGuardMiddleware` refuses any request bearing a member of
   * `MOCK_AUTH_HEADERS` wherever mock auth is off; a header the browser sends
   * that is NOT in that set is a credential a production configuration lets
   * through. That was true of `x-mock-actor`, harmless only because nothing
   * read it, and due to open at the ADR-0001 cutover when `x-mock-role` is
   * dropped and its quiet companion is not.
   */
  const read = (relative: string) =>
    readFileSync(new URL(`../../../../services/core-api/src/titlepipe_core/${relative}`, import.meta.url), "utf8");

  function coreApiRefusedHeaders(): string[] {
    const guardSource = read("api/mock_auth_guard.py");
    const members = /MOCK_AUTH_HEADERS:\s*Final\s*=\s*frozenset\(\{([^}]*)\}\)/.exec(guardSource);
    expect(members, "MOCK_AUTH_HEADERS is no longer a frozenset literal in mock_auth_guard.py").not.toBeNull();
    const mockSource = read("auth/mock.py");
    return (members?.[1] ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0)
      .map((symbol) => {
        // Each member is a NAME imported from auth/mock.py — resolve it to the
        // literal there, because the guard deliberately does not spell the
        // header out twice.
        const literal = new RegExp(`^${symbol}:\\s*Final\\s*=\\s*"([^"]+)"`, "m").exec(mockSource);
        expect(literal, `${symbol} has no string literal in auth/mock.py`).not.toBeNull();
        return literal?.[1] ?? symbol;
      });
  }

  test("core-api's refusal set is readable and non-empty", () => {
    expect(coreApiRefusedHeaders()).toContain(MOCK_ROLE_HEADER);
  });

  test("every header the browser mints is one core-api refuses", () => {
    const sent = Object.keys(mockAuthHeaders());
    expect(sent.length).toBeGreaterThan(0);
    expect([...sent].sort()).toEqual([...coreApiRefusedHeaders()].sort());
  });

  test("no mock header reaches the wire from anywhere but that one function", async () => {
    /*
     * The header set is only a set if there is one place that mints it. A
     * second `x-mock-…` literal in application source is how the two lists
     * came apart the first time; tests and the mock server itself are the
     * legitimate readers, so the sweep covers `src/` outside this file.
     */
    const { globSync } = await import("node:fs");
    const offenders: string[] = [];
    for (const file of globSync("src/**/*.{ts,tsx}", { cwd: new URL("../../", import.meta.url).pathname })) {
      if (file.endsWith("mock-auth.test.ts") || file.endsWith("mockHandlers.test.ts")) continue;
      const source = readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
      for (const match of source.matchAll(/"(x-mock-[a-z-]+)"/g)) {
        if (!file.endsWith("shared/api.ts")) offenders.push(`${file}: ${match[1] ?? ""}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

/* ── the roster the screen shows is the roster the ledger records ───────── */

describe("seat identities do not exist in two places", () => {
  test("every demo account's name is the contract's name for its role", () => {
    for (const account of DEMO_ACCOUNTS) {
      expect(account.name, account.id).toBe(SEAT_IDENTITIES[account.role]);
    }
  });

  test("every role has an identity, and no two roles share one", () => {
    const names = ROLES.map((role) => SEAT_IDENTITIES[role]);
    expect(names.every((n) => n.length > 0)).toBe(true);
    // Shared names would silently defeat the different-examiner rule, which
    // compares identities and not roles.
    expect(new Set(names).size).toBe(ROLES.length);
  });
});
