import { describe, expect, test } from "vitest";
// Relative .ts import (not "@titlepipe/contract"): this file typechecks under
// tsconfig.node.json (nodenext), where the workspace alias would need emitted
// declarations the source-only contract package doesn't produce.
import {
  PERMISSIONS,
  ROLES,
  canAccess,
  canDo,
  isRole,
  rulesFor,
  type Role,
} from "../../packages/contract/src/authz.ts";

/**
 * The authz table's derivations, pinned. The parity block is the no-drift
 * guarantee: it encodes the worlds the app shipped with (the old hand-rolled
 * nav.ts WORLDS map) and fails if a table edit silently moves a door.
 */

const DOORS = [
  "/",
  "/queue",
  "/orders",
  "/ingest",
  "/escalations",
  "/dashboard",
  "/delivery",
  "/complaints",
  "/golden",
  "/seed-correction",
  "/bench",
  "/leaderboard",
  "/blind",
  "/blind-status",
  "/reconciliation",
  "/account",
] as const;

const WORLDS: Record<Role, readonly string[]> = {
  reviewer: ["/", "/queue", "/orders", "/account"],
  senior: ["/", "/escalations", "/reconciliation", "/seed-correction", "/orders", "/account"],
  ops: ["/", "/dashboard", "/ingest", "/delivery", "/complaints", "/blind-status", "/orders", "/account"],
  engineer: ["/", "/bench", "/leaderboard", "/seed-correction", "/golden", "/orders", "/account"],
  typist: ["/blind", "/account"],
  admin: [...DOORS],
};

describe("canAccess — world parity", () => {
  for (const role of ROLES) {
    test(`${role} holds exactly its world's doors`, () => {
      const held = DOORS.filter((d) => canAccess(role, d));
      expect(held.sort()).toEqual([...WORLDS[role]].sort());
    });
  }

  test("door prefixes cover their subpaths; '/' matches only itself", () => {
    expect(canAccess("reviewer", "/orders/ord_1/review")).toBe(true);
    expect(canAccess("typist", "/blind/ord_demo_1")).toBe(true);
    expect(canAccess("reviewer", "/no-such-door")).toBe(false);
    // "/" being a door must never act as a wildcard prefix
    expect(canAccess("reviewer", "/dashboard")).toBe(false);
  });

  test("no wildcard roles: even admin holds only listed doors", () => {
    expect(canAccess("admin", "/no-such-door")).toBe(false);
  });
});

describe("canDo — role gates and state conditions", () => {
  test("escalation.resolve belongs to senior, gated on the cluster being open", () => {
    expect(canDo("senior", "escalation.resolve")).toBe(true);
    expect(canDo("reviewer", "escalation.resolve")).toBe(false);
    expect(canDo("senior", "escalation.resolve", { resolution: null })).toBe(true);
    expect(canDo("senior", "escalation.resolve", { resolution: "ruled: ours" })).toBe(false);
  });

  test("rule.confirm is the engineer gate, PENDING only", () => {
    expect(canDo("engineer", "rule.confirm", { status: "pending" })).toBe(true);
    expect(canDo("engineer", "rule.confirm", { status: "live" })).toBe(false);
    expect(canDo("ops", "rule.confirm")).toBe(false);
    expect(canDo("senior", "rule.confirm")).toBe(false);
  });

  test("field actions belong to review roles, never ops/engineer/typist", () => {
    expect(canDo("reviewer", "field.confirm", { state: "needs_review" })).toBe(true);
    expect(canDo("senior", "field.correct")).toBe(true);
    expect(canDo("reviewer", "field.confirm", { state: "corrected" })).toBe(false);
    expect(canDo("ops", "field.confirm")).toBe(false);
    expect(canDo("engineer", "field.escalate")).toBe(false);
    expect(canDo("typist", "field.confirm")).toBe(false);
  });

  test("blind.submit is the typist's only action", () => {
    expect(canDo("typist", "blind.submit")).toBe(true);
    expect(canDo("reviewer", "blind.submit")).toBe(false);
    const typistActions = rulesFor("typist")
      .map((g) => g.action)
      .filter((a) => !a.startsWith("screen."));
    expect(typistActions).toEqual(["blind.submit"]);
  });
});

describe("rulesFor — per-role projection", () => {
  test("a typist's rules never MENTION other worlds (leak test)", () => {
    const serialized = JSON.stringify(rulesFor("typist"));
    expect(rulesFor("typist").map((g) => g.action).sort()).toEqual([
      "blind.submit",
      "screen.account.enter",
      "screen.blind.enter",
    ]);
    for (const word of ["escalation", "dashboard", "golden", "routing", "queue", "reconciliation", "bench"]) {
      expect(serialized).not.toContain(word);
    }
  });

  test("the holder list is redacted — clients learn their grants, not who else holds them", () => {
    for (const role of ROLES) {
      for (const granted of rulesFor(role)) {
        expect(granted).not.toHaveProperty("roles");
      }
    }
  });
});

describe("fail-closed semantics", () => {
  test("a when-condition whose key is missing from the resource REFUSES", () => {
    // an empty or wrong-shaped resource must never pass a state gate
    expect(canDo("senior", "escalation.resolve", {})).toBe(false);
    expect(canDo("engineer", "rule.confirm", { unrelated: "x" })).toBe(false);
  });

  test("non-string, non-null resource values are refused, never coerced", () => {
    expect(canDo("engineer", "rule.confirm", { status: 1 })).toBe(false);
    expect(canDo("engineer", "rule.confirm", { status: undefined })).toBe(false);
    expect(canDo("engineer", "rule.confirm", { status: ["pending"] })).toBe(false);
  });

  test("role names are exact — case variants and blanks are not roles", () => {
    expect(isRole("Reviewer")).toBe(false);
    expect(isRole("ADMIN")).toBe(false);
    expect(isRole("")).toBe(false);
    expect(isRole(null)).toBe(false);
  });

  test("door prefixes don't fall for lookalike paths", () => {
    expect(canAccess("reviewer", "/queueX")).toBe(false);
    expect(canAccess("typist", "/blindfold")).toBe(false);
    expect(canAccess("reviewer", "/orders-fake")).toBe(false);
  });
});

describe("table invariants", () => {
  test("every permission names at least one holder, admin always explicit (mock phase)", () => {
    for (const p of PERMISSIONS) {
      expect(p.roles.length).toBeGreaterThan(0);
      expect(p.roles).toContain("admin");
    }
  });

  test("action names are unique (module would throw on load otherwise)", () => {
    const actions = PERMISSIONS.map((p) => p.action);
    expect(new Set(actions).size).toBe(actions.length);
  });

  test("action names stay log/URL-safe: lowercase dotted words only", () => {
    for (const p of PERMISSIONS) {
      expect(p.action).toMatch(/^[a-z][a-z-]*(\.[a-z][a-z-]*)+$/);
    }
  });
});
