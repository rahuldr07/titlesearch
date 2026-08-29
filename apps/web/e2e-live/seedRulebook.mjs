/**
 * SEED THE RULEBOOK FROM `packages/mocks`, so the live harness renders the rows
 * the FROZEN specs already assert.
 *
 *     TITLEPIPE_DATABASE_URL=postgresql://titlepipe_migration:…@host:port/db \
 *       node e2e-live/seedRulebook.mjs
 *
 * ## Why `demoRules` and not `contract-fixtures/rules-response.json`
 *
 * `apps/web-v2/e2e` is frozen for this plan, and two of its specs name rule
 * CODES: `authz.spec.ts` and `hard.spec.ts` require `rule-row-R13`, and
 * `authz.spec.ts` requires `rule-row-DRAFT-HOA-AGE` behind the Pending filter.
 * Those codes come from `packages/mocks/src/data.ts::demoRules` and from nowhere
 * else. Seeding anything else — including Task 3's wire-parity fixture, whose
 * codes are `R-001`/`R-021` — would leave exactly one way to make those specs
 * pass, which is to edit them. That is the outcome this task exists to prevent,
 * so the seed is DERIVED from the mock rather than written beside it: the two
 * cannot drift, because there is only one copy.
 *
 * The fixture is not the seed and the seed is not the fixture. `rules-response.
 * json` answers "does core-api's Pydantic shape parse under the real Zod
 * schemas"; this answers "do the rows the browser suite names exist in
 * Postgres". Different questions, deliberately different data.
 *
 * ## `data.ts` is imported DIRECTLY, and by path
 *
 * Not `@titlepipe/mocks`. That entry point re-exports `./handlers.js`, and
 * Node's resolver — which does not do a bundler's extension rewriting — dies on
 * `Cannot find module …/handlers.js`. MEASURED, that is the error, and it is the
 * package entry's fault rather than the type stripping's: `data.ts` imports
 * `@titlepipe/contract` under `import type` alone, so once Node erases the
 * annotations there is no runtime import left in the module at all and it loads
 * as ordinary ESM. Node 22.18+ strips types with no flag; the repo runs 22.
 *
 * Reaching past a package entry is normally the wrong move. It is right here
 * because the alternative is a SECOND copy of four rules, and because this file
 * wants the DATA and explicitly not the MSW handlers that would come with it.
 *
 * ## The role, and why the connection is `titlepipe_migration`
 *
 * `migrations/versions/0003_rules.py` grants `titlepipe_app` `SELECT` and
 * nothing more — no `INSERT`, deliberately, because rule creation is Plan 05's
 * with its own refusal tests. So the app's DSN cannot seed. What can is the
 * table's owner, reached the same way `services/core-api/migrations/env.py`
 * reaches it: connect as `titlepipe_migration`, then `SET ROLE titlepipe_owner`,
 * because the membership is `INHERIT FALSE, SET TRUE` and the role holds none of
 * the owner's privileges until it asks. `TITLEPIPE_DATABASE_URL` is already that
 * role's DSN — it is what `alembic upgrade head` takes — so this adds no fifth
 * database variable to a system that has four.
 *
 * ## It verifies itself before it commits
 *
 * The `DO` block below reads the CODES back inside the same transaction and
 * raises if they are not the ones written, so a rulebook that is not what this
 * script intended fails HERE and rolls back rather than turning into confusing
 * browser assertions twenty seconds later.
 *
 * It checked the row COUNT until a reviewer pointed out that no input could make
 * that check fire. The reasoning, and what the code check catches instead, is at
 * the block itself.
 */
import { execFileSync } from "node:child_process";

import { demoRules } from "../../../packages/mocks/src/data.ts";

/**
 * The table's owner. Named once; `migrations/env.py::OWNER_ROLE` is the other
 * copy and the two are kept honest by this script failing outright when they
 * disagree — a wrong role cannot `INSERT` and cannot be mistaken for success.
 */
const OWNER_ROLE = "titlepipe_owner";

/**
 * `id` is NOT written, and it is the only field dropped. Its server default is
 * `gen_random_uuid()`, and letting the database mint it is what makes the row
 * distinguishable from the mock it was derived from: MSW answers `rule_r13`,
 * Postgres answers a UUID. `reaches-core-api.spec.ts` rests on exactly that
 * difference, so this is a property of the seed and not an oversight.
 *
 * (`created_at` is not dropped here because it is not a `Rule` FIELD — it is a
 * database column the wire never carries, so it is absent from `demoRules` to
 * begin with and defaults to `now()`.)
 */
const UNSEEDED_FIELD = "id";

/**
 * 🔴 THE COLUMN LIST IS DERIVED FROM THE DATA, NOT WRITTEN OUT.
 *
 * It was a hand-written copy of the eight wire fields, which is a second copy of
 * something this file exists to have one copy of. The failure it opens is quiet
 * and specific: a tenth `Rule` field arrives in the contract, `packages/mocks`
 * gains it, a `0004` migration adds a NULLABLE column for it — and the seed goes
 * on writing nine columns. Every row lands with that column NULL, the seed
 * passes, the browser renders a field the mock has and Postgres does not, and
 * nothing in this repository notices.
 *
 * Derived, the same change has two possible outcomes and both are correct: the
 * column exists and is seeded, or it does not and `INSERT` dies with
 * `column "…" of relation "rules" does not exist` — which is the migration
 * being demanded, out loud, at the moment it is needed.
 *
 * The key ORDER comes from the first rule and the key SET is then required to
 * match on every other, because `INSERT … VALUES` is positional: one row whose
 * object literal was written with two fields transposed would otherwise be
 * seeded into the wrong columns, and `origin`/`status` are both enums narrow
 * enough that Postgres would reject it — but `confirmed_by`/`source_doc_ref` are
 * both nullable text and would go in silently swapped.
 */
const COLUMNS = Object.keys(demoRules[0]).filter((field) => field !== UNSEEDED_FIELD);

for (const rule of demoRules) {
  const fields = Object.keys(rule).filter((field) => field !== UNSEEDED_FIELD);
  const differs =
    fields.length !== COLUMNS.length ||
    fields.some((field, index) => field !== COLUMNS[index]);
  if (differs) {
    throw new Error(
      `demoRules is not uniform: rule ${rule.code} has fields [${fields.join(", ")}] ` +
        `but the first rule has [${COLUMNS.join(", ")}]. INSERT … VALUES is positional, ` +
        "so a differing key order would seed values into the wrong columns.",
    );
  }
}

/**
 * A SQL literal, REFUSING ANYTHING IT WAS NOT WRITTEN FOR.
 *
 * Every `Rule` field is `string | number | null` today. The previous version
 * ended in an unguarded `` `'${value}'` ``, so the first field typed `boolean`
 * or `string[]` would have been seeded as `'true'` or `'a,b'` — a wrong value
 * written confidently, which is worse than a crash and is the shape of defect
 * this repository's provenance rule exists to prevent. A `throw` names the type
 * and the field, so whoever adds it is told what to add here.
 */
function literal(field, value) {
  if (value === null) return "NULL";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  throw new Error(
    `rules.${field} is ${typeof value} (${JSON.stringify(value)}), which this seed ` +
      "cannot render. It handles string, number and null — the only types Rule has " +
      "carried. Add the case here rather than letting a wrong literal be written.",
  );
}

const values = demoRules
  .map(
    (rule) =>
      `  (${COLUMNS.map((column) => literal(column, rule[column])).join(", ")})`,
  )
  .join(",\n");

/**
 * The codes that must be in the table when the transaction is done, sorted, as a
 * SQL array literal. Built from the same `demoRules` as the INSERT — so this is
 * not an independent claim about the VALUES, and does not pretend to be. What it
 * is independent of is what the DATABASE did with them; see the `DO` block.
 */
const expectedCodes = `ARRAY[${demoRules
  .map((rule) => rule.code)
  .sort()
  .map((code) => literal("code", code))
  .join(", ")}]::text[]`;

/*
 * ONE TRANSACTION, `DELETE` and not `TRUNCATE`. The two are equivalent on this
 * table today and will not stay that way: `TRUNCATE` takes an ACCESS EXCLUSIVE
 * lock and cannot be filtered, so the day `rules` acquires a foreign key or this
 * script needs to leave a row alone, `DELETE` still expresses it.
 *
 * The whole rulebook is replaced rather than upserted because the seed IS the
 * rulebook for this harness — a leftover row from an earlier hand-run is a row
 * on screen that no spec accounts for.
 */
const sql = `
BEGIN;
SET ROLE ${OWNER_ROLE};

DELETE FROM rules;

INSERT INTO rules (${COLUMNS.join(", ")}) VALUES
${values};

-- 🔴 THE CODES, NOT THE COUNT.
--
-- This block used to compare count(*) against the number of rules, and it was a
-- check that COULD NOT FIRE. Under ON_ERROR_STOP=1 a partial insert raises at
-- the INSERT, and an empty demoRules produces a VALUES clause with no rows --
-- a syntax error. There is no input under which a count of four became anything
-- else. It was presented as the guard against "a seed that silently writes
-- nothing", a failure mode that was already impossible.
--
-- Comparing the CODES asks a different question, and it is one the statements
-- above genuinely cannot answer for themselves: not "did my INSERT run" but
-- "IS THIS WHAT THE TABLE NOW HOLDS". The case that makes it worth having is
-- the one migrations/versions/0003_rules.py spends a screen warning about --
-- the day somebody gives rules a tenant_id and an RLS policy. The DELETE then
-- silently removes nothing (a policy hides the rows from the deleter), the
-- INSERT adds four more, and the table ends with EIGHT rows and duplicate codes
-- while every statement reports success. The browser would render a doubled
-- rulebook and the frozen specs would still find rule-row-R13.
--
-- It also catches the wrong table being written, and any future trigger or rule
-- that rewrites or drops a row on the way in.
DO $$
DECLARE
  seeded text[];
  expected text[] := ${expectedCodes};
BEGIN
  SELECT coalesce(array_agg(code ORDER BY code), ARRAY[]::text[]) INTO seeded FROM rules;
  IF seeded IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'rules holds % after seeding, expected % — the rulebook is not what was written',
      seeded, expected;
  END IF;
END $$;

COMMIT;
`;

/**
 * WHAT `pnpm --filter web-v2 test:e2e:live` NOW NEEDS, stated where somebody
 * hits it rather than only in a config file.
 *
 * This script is chained into that script, so the one command a newcomer runs
 * acquired two prerequisites it did not have before Task 5 — a `psql` on PATH
 * and an ALREADY-MIGRATED database. Neither is discoverable: `psql`'s absence
 * surfaces as a bare `ENOENT` out of `execFileSync` with no mention of psql's
 * purpose, and an un-migrated database surfaces as `relation "rules" does not
 * exist` from a statement the reader did not write. Both are named below, with
 * the command that fixes them.
 */
const PREREQUISITES =
  "`pnpm --filter web-v2 test:e2e:live` needs, beyond a browser:\n" +
  "  * psql on PATH (this script pipes SQL to it; no Postgres driver is a dependency),\n" +
  "  * a database with the schema already applied —\n" +
  "      cd services/core-api && TITLEPIPE_DATABASE_URL=… uv run alembic upgrade head\n" +
  "    (and `migrations/sql/roles.sql` applied before that, once per cluster),\n" +
  "  * TITLEPIPE_DATABASE_URL naming titlepipe_migration.\n" +
  "`.github/workflows/migration-harness.yml` does all three and is the worked example.";

const dsn = process.env.TITLEPIPE_DATABASE_URL;
if (dsn === undefined || dsn === "") {
  throw new Error(
    "TITLEPIPE_DATABASE_URL is unset. It is titlepipe_migration's DSN — the same " +
      "one `alembic upgrade head` takes — and it is the only role that can " +
      `SET ROLE ${OWNER_ROLE}. The live harness cannot render rows from a ` +
      `database it was never pointed at.\n\n${PREREQUISITES}`,
  );
}

/*
 * `postgresql+psycopg://` is SQLAlchemy's spelling and psql rejects it. Stripped
 * rather than demanded in the plain form, so one exported variable serves
 * `alembic upgrade head` and this script without the operator keeping two.
 */
const psqlDsn = dsn.replace(/^postgresql\+\w+:/, "postgresql:");

console.log(
  `seeding ${demoRules.length} rules from packages/mocks: ${demoRules
    .map((rule) => rule.code)
    .join(", ")}`,
);

/*
 * The ENOENT is caught and re-thrown NAMED. Node's own message for a missing
 * binary is `spawnSync psql ENOENT`, which tells a reader that something called
 * psql is missing and nothing about why this script wanted one or what to
 * install. Every other failure propagates untouched — psql's own diagnostics are
 * better than anything this file could say about them.
 */
try {
  execFileSync("psql", ["-v", "ON_ERROR_STOP=1", "-q", "-d", psqlDsn], {
    input: sql,
    stdio: ["pipe", "inherit", "inherit"],
  });
} catch (error) {
  if (error instanceof Error && "code" in error && error.code === "ENOENT") {
    throw new Error(
      "psql is not on PATH. This script seeds the rulebook by piping SQL to it, " +
        "which is how the harness reaches Postgres without adding a driver to " +
        `web-v2's dependencies.\n\n${PREREQUISITES}`,
      { cause: error },
    );
  }
  throw error;
}
