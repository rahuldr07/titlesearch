import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
// The WORKSPACE ALIAS, not a relative path into `packages/contract/src`, and not a
// local re-declaration. These are the exact schemas `apps/web/src` parses live
// responses with; a re-typed copy here would be this file agreeing with itself.
//
// `authz.test.ts` reaches in relatively and says the alias "would need emitted
// declarations the source-only contract package does not produce". MEASURED
// 2026-08-06 with the import below: `tsc -b --force` exits 0 and vitest resolves it.
// Its comment is stale under TypeScript 6 / this tsconfig; left alone because it is
// not this task's file.
import { Rule, RuleOrigin, RuleStatus, RulesResponse } from "@titlepipe/contract";

/**
 * Gate two of two over `GET /api/rules`: **does the backend's wire shape survive
 * the browser's own parser?**
 *
 * `contract-fixtures/rules-response.json` is produced by the FastAPI service's
 * Pydantic models — `services/core-api/src/titlepipe_core/api/schemas/rules.py` —
 * and `services/core-api/tests/test_rules_contract_parity.py` asserts the committed
 * bytes are still what those models emit. That test is Python compared with Python
 * and proves nothing about the contract. This one takes the same committed bytes
 * and hands them to the ACTUAL Zod schemas the app parses responses with. Neither
 * gate is sufficient alone: without the Python one the fixture rots, without this
 * one the shape is only ever checked against itself.
 *
 * ADR-0001's third amendment makes Pydantic the wire AUTHORITY. It does not demote
 * Zod: `openapi-fetch` ships no validation, so this schema is still what every
 * response has to survive at the boundary in production.
 *
 * The fixture sits at the repository root rather than under either toolchain's test
 * tree, because it is the artifact both gates share and neither owns.
 *
 * ## Why `RulesResponse.parse` is not the whole test
 *
 * A Zod object STRIPS unknown keys instead of refusing them, so `parse` is blind to
 * a tenth field — and the `rules` table carries a `created_at` the contract has
 * never listed. The key-set assertions below are what actually catch it, and the
 * last test in the file pins Zod's stripping so nobody later "simplifies" them away.
 *
 * A parse over `{"rules": []}` also succeeds. The coverage test is the positive
 * control (`00-HOW-TO-EXECUTE.md` §1.1): every enum label spelled at least once,
 * and every nullable field seen both null and populated.
 */

const FIXTURE = new URL("../../contract-fixtures/rules-response.json", import.meta.url);

type JsonObject = Record<string, unknown>;

function readFixture(): unknown {
  return JSON.parse(readFileSync(FIXTURE, "utf8"));
}

/** The raw rule objects, unstripped — what `parse` is deliberately not shown. */
function rawRules(payload: unknown): JsonObject[] {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("fixture is not a JSON object");
  }
  const rules: unknown = (payload as JsonObject).rules;
  if (!Array.isArray(rules)) throw new Error("fixture has no `rules` array");
  return rules.map((rule: unknown) => {
    if (typeof rule !== "object" || rule === null)
      throw new Error("a rule is not an object");
    return rule as JsonObject;
  });
}

/** The contract's own field list, read off the schema rather than transcribed. */
const RULE_KEYS = Object.keys(Rule.shape).sort();

/** Which fields Zod says may be `null` — derived, so adding one cannot be missed. */
const NULLABLE_KEYS = Object.entries(Rule.shape)
  .filter(([, schema]) => schema.safeParse(null).success)
  .map(([name]) => name);

describe("GET /api/rules — the Pydantic body against the browser's parser", () => {
  test("the fixture parses under the contract's RulesResponse, whole", () => {
    const payload = readFixture();
    const parsed = RulesResponse.parse(payload);

    // A FLOOR DERIVED FROM THE CONTRACT, not `rawRules(payload).length`.
    // `expect(parsed.rules).toHaveLength(rawRules(payload).length)` was here and was
    // TAUTOLOGICAL — `z.array().parse` cannot change a length, so it asserted
    // `n === n` while its comment claimed it would catch a fixture that shrank.
    // Every origin label has to appear at least once for the coverage test below to
    // pass, so a response carrying fewer rules than there are labels cannot be a
    // complete fixture whatever else is true of it.
    expect(parsed.rules.length).toBeGreaterThanOrEqual(RuleOrigin.options.length);
  });

  test("every rule carries exactly the contract's keys — no extras, none missing", () => {
    // The assertion `parse` cannot make. `created_at` exists on the `rules` table
    // and is deliberately absent from the contract's nine fields; Zod strips it and
    // reports success.
    for (const rule of rawRules(readFixture())) {
      expect(Object.keys(rule).sort()).toEqual(RULE_KEYS);
    }
  });

  test("the envelope is an object wrapping `rules`, not a bare array", () => {
    const payload = readFixture();
    if (typeof payload !== "object" || payload === null)
      throw new Error("not an object");
    expect(Object.keys(payload).sort()).toEqual(
      Object.keys(RulesResponse.shape).sort(),
    );
  });

  test("the fixture exercises every enum label and both sides of every nullable", () => {
    // The positive control. Every other assertion in this file is satisfied by
    // `{"rules": []}` — no label is ever spelled, no nullable key is ever emitted,
    // and a suite of shape checks over no rows cannot tell "the contract matches"
    // from "there was nothing to check".
    const rules = rawRules(readFixture());

    expect([...new Set(rules.map((rule) => rule.origin))].sort()).toEqual(
      [...RuleOrigin.options].sort(),
    );
    expect([...new Set(rules.map((rule) => rule.status))].sort()).toEqual(
      [...RuleStatus.options].sort(),
    );

    expect(NULLABLE_KEYS.length).toBeGreaterThan(0);
    for (const name of NULLABLE_KEYS) {
      const emitted = rules.map((rule) => rule[name]);
      expect(emitted, `${name} is never null`).toContain(null);
      expect(
        emitted.filter((value) => value !== null && value !== undefined),
        `${name} is never populated`,
      ).not.toHaveLength(0);
    }
  });
});

describe("the parser has teeth — what a drifted backend would look like", () => {
  /** The fixture re-read and its first rule mutated on a copy. */
  function withFirstRuleMutated(mutate: (rule: JsonObject) => void): unknown {
    const rules = rawRules(readFixture()).map((rule, index) => {
      const copy = { ...rule };
      if (index === 0) mutate(copy);
      return copy;
    });
    return { rules };
  }

  test("a renamed field is refused — `source_doc_ref` -> `source_ref`", () => {
    // Plan 02 Task 3's injection, run here as a control: the gate is known to be
    // able to fail rather than assumed to be.
    const drifted = withFirstRuleMutated((rule) => {
      rule.source_ref = rule.source_doc_ref;
      delete rule.source_doc_ref;
    });
    expect(RulesResponse.safeParse(drifted).success).toBe(false);
  });

  // `.nullable()` is not `.optional()`. This is the Pydantic/Zod mismatch most
  // likely to actually ship: `str | None = None` plus any `exclude_none` on the
  // serialisation path drops the key, and the browser rejects the response.
  //
  // LOOPED OVER `NULLABLE_KEYS` rather than over `source_doc_ref` alone. The three
  // are not interchangeable to Zod — a `.nullish()` on any ONE of them in
  // `entities.ts` would make that key optional and silently accept an omitted
  // field, and a control naming only the third of them would not notice.
  for (const name of NULLABLE_KEYS) {
    test(`a nullable field emitted as an ABSENT key is refused — ${name}`, () => {
      const drifted = withFirstRuleMutated((rule) => {
        delete rule[name];
      });
      expect(RulesResponse.safeParse(drifted).success).toBe(false);
    });
  }

  test("an enum label outside the contract's is refused", () => {
    const drifted = withFirstRuleMutated((rule) => {
      rule.origin = "underwriter";
    });
    expect(RulesResponse.safeParse(drifted).success).toBe(false);
  });

  test("an EXTRA key SURVIVES parsing and is SILENTLY DROPPED from the result", () => {
    // 🔴 THIS USED TO ASSERT ONLY `success === true`, which is a fact about Zod that
    //    holds with the fixture, the Pydantic models and the rest of this file
    //    deleted. It was documented as a deliberate pin and it was still weightless.
    //
    // What has weight is the SECOND half: the key is not merely tolerated, it is
    // gone from the parsed value. That is the actual hazard — a backend that starts
    // emitting `created_at` reaches the browser, is accepted, and the field
    // evaporates between the wire and the app with nothing anywhere reporting it.
    // It is the reason the key-set assertions above read the RAW object, and if this
    // behaviour ever changes they are the assertions to reconsider.
    const drifted = withFirstRuleMutated((rule) => {
      rule.created_at = "2026-08-06T12:00:00Z";
    });

    const result = RulesResponse.safeParse(drifted);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(Object.keys(result.data.rules[0] ?? {}).sort()).toEqual(RULE_KEYS);
    expect(result.data.rules[0]).not.toHaveProperty("created_at");
  });
});
