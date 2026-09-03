/**
 * Seed the rulebook from `packages/mocks`, so the live harness renders the
 * rows the frozen specs already assert.
 *
 *     TITLEPIPE_DATABASE_URL=postgresql://titlepipe_migration:…@host:port/db \
 *       node e2e-live/seedRulebook.mjs
 *
 * Why `demoRules` and not a fixture file: the frozen specs name rule codes
 * (`rule-row-R13`, `rule-row-DRAFT-HOA-AGE`) that come from
 * `packages/mocks/src/data.ts::demoRules` and nowhere else, so the seed is
 * derived from the mock rather than written beside it — the two cannot
 * drift, because there is only one copy.
 *
 * `data.ts` is imported directly, by path, not via `@titlepipe/mocks`: that
 * entry re-exports `./handlers.js`, which Node's resolver cannot load,
 * while `data.ts` imports the contract under `import type` alone and loads
 * as ordinary ESM once Node strips the annotations. Reaching past a package
 * entry is normally wrong; here the alternative is a second copy of the
 * rules, and this file wants the data, not the MSW handlers.
 *
 * The role, and why the connection is `titlepipe_migration`:
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
 * It verifies itself before it commits: the `DO` block reads the codes
 * back inside the same transaction and raises if they are not the ones
 * written, so a rulebook that is not what this script intended fails here
 * and rolls back rather than turning into confusing browser assertions
 * twenty seconds later.
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
 * `id` is not written, and it is the only field dropped: letting the
 * database mint it (`gen_random_uuid()`) is what makes the row
 * distinguishable from the mock it was derived from — MSW answers
 * `rule_r13`, Postgres answers a UUID, and `reaches-core-api.spec.ts` rests
 * on that difference. (`created_at` is a database column the wire never
 * carries; it is absent from `demoRules` and defaults to `now()`.)
 */
const UNSEEDED_FIELD = "id";

/**
 * The column list is derived from the data, not written out: a new `Rule`
 * field then has two possible outcomes and both are correct — the column
 * exists and is seeded, or `INSERT` dies with `column "…" does not exist`,
 * which is the migration being demanded at the moment it is needed. The
 * key order comes from the first rule and the key set is required to match
 * on every other, because `INSERT … VALUES` is positional — two nullable
 * text fields transposed would go in silently swapped.
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
 * A SQL literal, refusing anything it was not written for. Every `Rule`
 * field is `string | number | null` today; a `boolean` or `string[]`
 * rendered as `'true'` or `'a,b'` would be a wrong value written
 * confidently, which is worse than a crash. The `throw` names the type and
 * the field, so whoever adds it is told what to add here.
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
 * What `pnpm --filter @titlepipe/web test:e2e:live` needs, stated where somebody
 * hits it: a `psql` on PATH and an already-migrated database. Neither is
 * discoverable — psql's absence surfaces as a bare `ENOENT`, an
 * un-migrated database as `relation "rules" does not exist` — so both are
 * named below with the command that fixes them.
 */
const PREREQUISITES =
  "`pnpm --filter @titlepipe/web test:e2e:live` needs, beyond a browser:\n" +
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
 * The ENOENT is caught and re-thrown named — Node's own `spawnSync psql
 * ENOENT` says nothing about why this script wanted psql. Every other
 * failure propagates untouched; psql's own diagnostics are better than
 * anything this file could say about them.
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
