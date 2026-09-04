"""The audit-log WRITER: assertion columns, the per-tenant hash chain, ENABLE ALWAYS triggers

Revision ID: 0007
Revises: 0006
Create Date: 2026-09-04

ASSUMED PARENT: `0006`. Per CONVENTIONS §8 this is a stated assumption, not a
guess at the final chain. `0007` genuinely depends on `0005`/`0006` only because
it ATTACHES its trigger to the two tables they create; the writer itself depends
on nothing but `0001`'s `audit_log`.

## The defect this closes

PLAN.md §5, reconfirmed by grep and carried as the highest-severity defect in the
tree: *"the table, triggers, and grants are fully hardened — `ENABLE ALWAYS`
append-only triggers, correct role grants — and NOTHING WRITES TO IT."* A
perfectly hardened empty table reads as assurance that a legal record is kept when
none is. `0001`-`0004` built the control. This builds the writer.

## Why the writer is a trigger and could not be application code

CONVENTIONS §5, and PLAN.md §5's reason in full: *"application code that must
remember... will forget on the one path nobody tested,"* and the board already has
a live instance of exactly that bug class — one correction path enforces a reason,
a second files an unreasoned ruling, and the invariant test only drives the first.
An `AFTER … FOR EACH ROW` trigger has no second path: every row that changes goes
through it, including one changed by a `psql` session, a data migration, or a
future endpoint nobody has written yet.

`ENABLE ALWAYS` rather than plain `ENABLE`, for `0004`'s measured reason: a
per-role `session_replication_role = 'replica'` default is applied at CONNECT and
never checked again, so an ordinary trigger can be silently off for a whole
session before any statement runs. `ENABLE ALWAYS` is unconditional at the table.

## The row is the ASSERTION half, and the PAYLOAD half is deliberately absent

PLAN.md §2 splits an audit row in two. The ASSERTION — tenant, actor, seat at the
time, verb, subject table and row id, rule id and provenance tag, request id,
`clock_timestamp()` — is **NPI-free by construction** and is what the hash chain
and any SOC 2 evidence actually need. The PAYLOAD — before/after values, source
snippets, any reason quoting record content — **is NPI** (a grantor name, a legal
description) and is specified to live encrypted under the same per-record DEK as
the field it describes, so destroying that key shreds it without breaking the
chain.

🔴 **THIS REVISION SHIPS THE ASSERTION HALF ONLY, AND CREATES NO PAYLOAD COLUMN
AT ALL.** Field encryption is out of scope this phase — it is gated on a
platform/KMS decision the owner has not made (PLAN.md §8 step 6, §9). The
alternatives were both worse than an honest gap: a plaintext before/after column
would put NPI in a permanent, append-only, deliberately-undeletable table, which
is the exact collision PLAN.md §2 spends a page reconciling; a nullable
`payload_ciphertext` that nothing ever writes would be this defect a second time —
a hardened column reading as assurance that before/after values are captured when
they are not. **So the honest statement is: an audit row written today records
THAT a change happened, by whom, under what seat and rule, and does NOT record
WHAT the value became.** That is a real limitation of the legal record and it is
recorded in `build-retention-audit.md` §7 as an unmet requirement of §5, not as a
completed one.

## The hash chain, and what each of its three parts actually defends against

PLAN.md §5 decides a per-tenant hash chain because *"append-only triggers stop an
edit; they do not PROVE one didn't happen"*. Three attackers, three controls:

* **the ordinary caller** — stopped by `0001`'s append-only triggers and by `0002`
  withholding UPDATE and DELETE from `titlepipe_app`;
* **whoever bypassed the triggers** (a superuser, a restore, a direct catalog
  write, `session_replication_role='replica'`) — DETECTED, not stopped, by
  `audit_chain_verify()`. A deleted row leaves a gap in `chain_position`; an
  edited row's stored `row_hash` no longer matches a recomputation; a re-hashed
  row breaks its successor's `prev_hash`;
* **whoever recomputes the whole chain** — NOT covered here. PLAN.md §5 answers
  that with the chain head published on a fixed cadence to immutability-locked
  object storage, countersigned outside the database's blast radius. **That
  external anchor does not exist and this revision does not create one.** Without
  it, `audit_chain_verify()` detects a partial edit and cannot detect a complete
  rewrite. Stated, not implied.

The cost PLAN.md §5 names is real and is paid here: `pg_advisory_xact_lock` on the
tenant serialises audit inserts within one tenant. Whether that is affordable
depends on the audit write rate, which is UNKNOWN (§9).

## Two timestamps on one row, and they answer different questions

`created_at` is `0001`'s and defaults to `now()` — transaction start, shared by
every row one transaction writes. `occurred_at` defaults to `clock_timestamp()`,
which PLAN.md §5 names SPECIFICALLY: *"never `now()`/`transaction_timestamp()`
(constant within one transaction — a batch of rows would share a timestamp and
lose ordering)"*. Ordering within a transaction is `chain_position`, and
`occurred_at` is the wall-clock reading that makes a row's place in it legible.
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


AUDIT_TABLE = "audit_log"

# TG_OP's three row-level verbs, lower-cased to the naming convention. TRUNCATE
# is deliberately absent: it is statement-level, it cannot name a row, and on
# every audited table it is refused before it could be recorded.
AUDIT_ACTION_LABELS = ("insert", "update", "delete")
AUDIT_ACTION_TYPE_NAME = "audit_action"
AUDIT_ACTION = postgresql.ENUM(*AUDIT_ACTION_LABELS, name=AUDIT_ACTION_TYPE_NAME, create_type=False)

# The four provenance tags a rule can carry AT DECISION TIME (CLAUDE.md; PLAN.md
# §5 requires the tag as it stood then, so a later-confirmed rule cannot
# retroactively make a past OPEN decision look ruled).
#
# A CHECK CONSTRAINT ON A `text` COLUMN AND NOT AN ENUM TYPE, WHICH IS A
# DELIBERATE DEPARTURE FROM CONVENTIONS §4. The provenance tag is an assembly
# concept that has no table of its own yet, and creating a `rule_provenance` enum
# here would plant a type in the same namespace another worker's revision may
# also create this phase — a `type already exists` at integration, on a chain god
# is already linearising. The CHECK is a real write-time machine with the same
# refusal behaviour; `build-retention-audit.md` §8 REQUESTS that it become an
# enum once one owner holds the concept.
RULE_PROVENANCE_TAGS = ("RULED", "DERIVED", "OPEN", "CONFLICT")

# The session context the writer reads. Custom GUCs, the same mechanism `0002`'s
# policies read `app.current_tenant` through.
#
# 🔴 A ROLE CAN SET ITS OWN GUC, SO THESE ARE NOT A PRIVILEGE AND ARE NOT
# CLAIMED AS ONE. `0002` measured it: `titlepipe_app` sets `app.current_tenant`
# freely. What they buy is that a change with NO actor declared is REFUSED rather
# than recorded anonymously — the caller can lie about who it is, and cannot
# decline to say. Binding the actor to an authenticated identity is the identity
# provider's job (PLAN.md §8 step 3) and does not exist yet.
ACTOR_SUBJECT_GUC = "app.actor_subject"
ACTOR_SEAT_GUC = "app.actor_seat"
REQUEST_ID_GUC = "app.request_id"
RULE_ID_GUC = "app.rule_id"
RULE_PROVENANCE_GUC = "app.rule_provenance"
ENGINE_ID_GUC = "app.engine_id"
ENGINE_MODEL_VERSION_GUC = "app.engine_model_version"

# `28000` is `invalid_authorization_specification` — PostgreSQL's own named
# condition for "the session has not said who it is". As with `0001`'s `0A000`
# and `0005`'s `55000`, no typo produces it: an unknown column is `42703`.
NO_ACTOR_SQLSTATE = "28000"

WRITER_FUNCTION = "audit_record_change"
CHAIN_FUNCTION = "audit_chain_link"
VERIFY_FUNCTION = "audit_chain_verify"
CHAIN_TRIGGER = "audit_log_chain_link"

# Every table this revision attaches the writer to. See `_attach` for what is NOT
# on this list and why that is a stated gap rather than an oversight.
AUDITED_TABLES = ("record_classifications", "legal_holds")

CHAIN_POSITION_CONSTRAINT = "uq_audit_log_tenant_id_chain_position"


def upgrade() -> None:
    _require_the_audit_log_is_empty()

    AUDIT_ACTION.create(op.get_bind(), checkfirst=False)

    _add_assertion_columns()
    _create_chain_trigger()
    _create_verify_function()
    _create_writer_function()

    for table in AUDITED_TABLES:
        _attach(table)


def _require_the_audit_log_is_empty() -> None:
    """Refuse rather than invent an actor for a row that predates the writer.

    Every column added below is `NOT NULL` with no server default except
    `occurred_at`, so `ALTER TABLE … ADD COLUMN` can only succeed on an empty
    table. That is the correct outcome — there is no honest value to backfill
    `actor_subject` with, and a sentinel like `'unknown'` would make the audit
    log's own history unreadable at exactly the point somebody needed it.

    THIS IS A CHECK THAT SHOULD NEVER FIRE, AND IT IS HERE BECAUSE OF WHY. PLAN.md
    §5's standing finding is that nothing has ever written to this table; on every
    database that finding is true, it is empty, and this passes. If it fires,
    something wrote audit rows by a path nobody has documented, and the operator
    needs to be told that in a sentence rather than shown
    `column "actor_subject" contains null values`.

    A `RuntimeError` rather than a SQL `RAISE`, matching `0002`'s
    `_require_schema_usage`: the reader is an operator who has to make a decision,
    not a caller catching a SQLSTATE.
    """
    existing = op.get_bind().execute(sa.text(f"SELECT count(*) FROM {AUDIT_TABLE}")).scalar_one()
    if int(existing):
        raise RuntimeError(
            f"revision 0007 adds NOT NULL assertion columns to {AUDIT_TABLE} and "
            f"found {existing} row(s) already there. Every one of those rows "
            f"predates the writer, so there is no honest value to backfill "
            f"actor_subject, actor_seat, action or subject_id with, and a "
            f"placeholder would corrupt the legal record this table exists to be. "
            f"PLAN.md section 5 records that nothing has ever written to this "
            f"table; if that is no longer true, find out what did before "
            f"migrating."
        )


def _add_assertion_columns() -> None:
    """The NPI-free half of PLAN.md §5's audit row. Nothing here can hold a value.

    Read the column list as the answer to "what must a legal-record audit row
    capture" (PLAN.md §5), minus the payload half this revision cannot honestly
    build:

    * `actor_subject` + `actor_seat` — **the seat in force AT THE TIME,
      DENORMALIZED onto the row.** PLAN.md §5 calls this *"the one place
      denormalization is required for correctness"*: a role assignment changing
      later must not retroactively change what an old audit row appears to say.
      A join to a `users` table would do exactly that;
    * `action` + `subject_table` + `subject_id` — the verb and its subject.
      `subject_table` is `text` and not `regclass`: a `regclass` follows a
      RENAME, so an old row would silently start naming the new table;
    * `rule_id` + `rule_provenance` — the rule and its tag AS IT STOOD AT DECISION
      TIME, so a later-confirmed rule cannot make a past OPEN decision look ruled;
    * `request_id` — correlation with the structured log;
    * `engine_id` + `engine_model_version` — machine identity where a machine
      produced the value.

    🔴 `engine_cost_usd` AND `engine_latency_ms` ARE IN §5'S LIST AND ARE NOT
    HERE. Both are properties of ONE ENGINE CALL, and the audit row is a property
    of one DATABASE CHANGE; a single change can follow several calls, so the two
    do not correspond one-to-one and a column would have to pick one arbitrarily.
    CLAUDE.md already requires cost and latency to be recorded per call, which is
    where they belong. `build-retention-audit.md` §8 REQUESTS that whoever models
    the engine-call record carries them and that its id becomes the audit row's
    link. This is a DEPARTURE from §5's list, stated so it can be overruled.

    All eight are `NOT NULL` or nullable exactly as the concept requires: an
    actor and a seat always exist (the writer refuses the change otherwise); a
    rule, a request id and an engine identity genuinely may not, and CONVENTIONS
    §4 is explicit that a column which cannot be honestly populated stays NULL
    rather than being given a fabricated value.
    """
    op.add_column(
        AUDIT_TABLE,
        sa.Column(
            "occurred_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
    )
    op.add_column(AUDIT_TABLE, sa.Column("actor_subject", sa.Text(), nullable=False))
    op.add_column(AUDIT_TABLE, sa.Column("actor_seat", sa.Text(), nullable=False))
    op.add_column(AUDIT_TABLE, sa.Column("action", AUDIT_ACTION, nullable=False))
    op.add_column(AUDIT_TABLE, sa.Column("subject_table", sa.Text(), nullable=False))
    op.add_column(
        AUDIT_TABLE, sa.Column("subject_id", postgresql.UUID(as_uuid=True), nullable=False)
    )
    op.add_column(AUDIT_TABLE, sa.Column("rule_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column(AUDIT_TABLE, sa.Column("rule_provenance", sa.Text(), nullable=True))
    op.add_column(AUDIT_TABLE, sa.Column("request_id", sa.Text(), nullable=True))
    op.add_column(AUDIT_TABLE, sa.Column("engine_id", sa.Text(), nullable=True))
    op.add_column(AUDIT_TABLE, sa.Column("engine_model_version", sa.Text(), nullable=True))

    # The chain. `prev_hash` is NULL for exactly one row per tenant — the first —
    # which is why it is the only nullable one of the three.
    op.add_column(AUDIT_TABLE, sa.Column("prev_hash", postgresql.BYTEA(), nullable=True))
    op.add_column(AUDIT_TABLE, sa.Column("row_hash", postgresql.BYTEA(), nullable=False))
    op.add_column(AUDIT_TABLE, sa.Column("chain_position", sa.BigInteger(), nullable=False))

    tags = ", ".join(f"'{tag}'" for tag in RULE_PROVENANCE_TAGS)
    op.create_check_constraint(
        "rule_provenance_is_one_of_the_four_tags",
        AUDIT_TABLE,
        f"rule_provenance IS NULL OR rule_provenance IN ({tags})",
    )

    # A rule id with no provenance tag is the failure PLAN.md §5 names: the tag is
    # what stops a later confirmation rewriting the past, so a cited rule without
    # one is a citation that will silently change meaning.
    op.create_check_constraint(
        "a_cited_rule_carries_its_provenance",
        AUDIT_TABLE,
        "(rule_id IS NULL) = (rule_provenance IS NULL)",
    )

    # 🔴 THE UNIQUE CONSTRAINT IS THE TAMPER DETECTOR, NOT A TIDINESS RULE.
    # `chain_position` is dense per tenant, assigned under an advisory lock, so a
    # row REMOVED by anyone who bypassed the append-only triggers leaves a hole
    # that `audit_chain_verify` reports. The uniqueness half separately refuses a
    # fork — two rows claiming the same position, which is what a concurrent
    # insert would produce if the advisory lock were ever removed.
    #
    # Tenant-prefixed, per CONVENTIONS §2.
    op.create_unique_constraint(
        CHAIN_POSITION_CONSTRAINT, AUDIT_TABLE, ["tenant_id", "chain_position"]
    )


def _create_chain_trigger() -> None:
    """`BEFORE INSERT` on `audit_log`: the caller does not get to choose either value.

    PLAN.md §5: *`row_hash = H(prev_hash || canonical row serialization)` computed
    in a `BEFORE INSERT` trigger (so the application can't choose either value)*.
    This function OVERWRITES `chain_position`, `prev_hash` and `row_hash`
    unconditionally — it does not check whether the caller supplied them and does
    not complain, because a `BEFORE` trigger's assignment is final and refusing
    would only tell an attacker which field to leave alone.
    `tests/test_audit_writer.py::test_an_application_supplied_hash_is_overwritten`
    is the assertion.

    THE SERIALISATION IS `to_jsonb(NEW)::text` AND NOT A HAND-CONCATENATED FIELD
    LIST, for two reasons that both bite later. `jsonb`'s text output is canonical
    — keys sorted, whitespace normalised, duplicate keys impossible — so two
    serialisations of equal rows are equal strings; and a column added by a later
    revision is included automatically, where a hand-written list would silently
    stop covering the new field and leave it editable without breaking the hash.
    `row_hash` is set to NULL before serialising so that the input is a function
    of the row's CONTENT and not of whatever the caller put in the hash column.

    `sha256` and `convert_to` are both core PostgreSQL (no `pgcrypto`, so no
    extension for a privileged role to create — the same constraint `0001` records
    for `gen_random_uuid()`).

    🔴 `pg_advisory_xact_lock` IS WHAT MAKES THE CHAIN A CHAIN, AND IT IS THE COST
    PLAN.md §5 NAMES. Without it two concurrent inserts for one tenant both read
    the same head and produce a fork; the unique constraint on
    `(tenant_id, chain_position)` would refuse the second, turning a silent fork
    into a loud serialisation failure — so the lock is what makes it a WAIT rather
    than an ERROR. Audit writes within one tenant are therefore serialised. The
    lock is `xact`-scoped: it is released at commit or rollback, never leaked.

    The lock key is derived with `md5`, not `hashtext`. `hashtext` is an internal
    function whose availability and stability are not part of PostgreSQL's
    documented surface; `('x' || substr(md5(...), 1, 16))::bit(64)::bigint` uses
    only documented casts. Collisions between two tenants cost concurrency and
    never correctness — two tenants sharing a lock key still get their own chains,
    because the head lookup is filtered by `tenant_id`.
    """
    op.execute(
        f"""
        CREATE FUNCTION {CHAIN_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE
            head audit_log;
        BEGIN
            PERFORM pg_advisory_xact_lock(
                ('x' || substr(md5(NEW.tenant_id::text), 1, 16))::bit(64)::bigint
            );

            SELECT * INTO head
              FROM audit_log
             WHERE tenant_id = NEW.tenant_id
             ORDER BY chain_position DESC
             LIMIT 1;

            IF FOUND THEN
                NEW.chain_position := head.chain_position + 1;
                NEW.prev_hash := head.row_hash;
            ELSE
                NEW.chain_position := 1;
                NEW.prev_hash := NULL;
            END IF;

            NEW.row_hash := NULL;
            NEW.row_hash := sha256(
                coalesce(NEW.prev_hash, ''::bytea)
                || convert_to(to_jsonb(NEW)::text, 'UTF8')
            );

            RETURN NEW;
        END;
        $$
        """
    )
    op.execute(f"REVOKE EXECUTE ON FUNCTION {CHAIN_FUNCTION}() FROM PUBLIC")
    op.execute(
        f"""
        CREATE TRIGGER {CHAIN_TRIGGER}
        BEFORE INSERT ON {AUDIT_TABLE}
        FOR EACH ROW EXECUTE FUNCTION {CHAIN_FUNCTION}()
        """
    )
    # `0004`'s reason, applied to a new trigger rather than retrofitted to an old
    # one: a per-role `session_replication_role = 'replica'` default is applied at
    # CONNECT and never re-checked, so a plain `ENABLE` trigger can be off for a
    # whole session before any statement runs.
    op.execute(f"ALTER TABLE {AUDIT_TABLE} ENABLE ALWAYS TRIGGER {CHAIN_TRIGGER}")


def _create_verify_function() -> None:
    """Recompute one tenant's chain and report every position that does not hold.

    This is the control PLAN.md §5 assigns to the second attacker — whoever
    bypassed the triggers. It DETECTS; it prevents nothing, and it is only
    meaningful to someone who runs it.

    Three findings, and each corresponds to a different tampering shape:

    * `gap` — `chain_position` is dense by construction, so a missing position is
      a row that was REMOVED after being written. `0001`'s append-only triggers
      make that impossible short of `session_replication_role='replica'` or a
      direct catalog write, which is exactly the attacker this exists for;
    * `row_hash mismatch` — the stored hash is not what the row's current content
      hashes to. An edited row;
    * `prev_hash mismatch` — the row's `prev_hash` is not its predecessor's
      `row_hash`. A re-hashed row, or a row spliced in.

    THE RECOMPUTATION HAS TO REPRODUCE THE TRIGGER'S INPUT EXACTLY, which is why
    it is `jsonb_set(to_jsonb(a), '{{row_hash}}', 'null'::jsonb)` and not
    `to_jsonb(a) - 'row_hash'`: the trigger serialised a row that HAD a
    `row_hash` key whose value was JSON null. Removing the key instead of nulling
    it produces a different string and every row would report a mismatch.

    🔴 IT CANNOT DETECT A COMPLETE REWRITE. An attacker who edits a row and
    recomputes every subsequent hash produces a chain this function calls intact.
    PLAN.md §5's answer is the external anchor — the chain head published to
    immutability-locked storage and countersigned outside the database — and
    **that does not exist.** This function is one of three controls, shipped
    alone.
    """
    op.execute(
        f"""
        CREATE FUNCTION {VERIFY_FUNCTION}(p_tenant uuid)
        RETURNS TABLE (chain_position bigint, problem text)
        LANGUAGE sql STABLE AS $$
            WITH chain AS (
                SELECT a.chain_position,
                       a.prev_hash,
                       a.row_hash,
                       sha256(
                           coalesce(a.prev_hash, ''::bytea)
                           || convert_to(
                                jsonb_set(to_jsonb(a), '{{row_hash}}', 'null'::jsonb)::text,
                                'UTF8')
                       ) AS recomputed,
                       lag(a.row_hash) OVER (ORDER BY a.chain_position) AS predecessor_hash,
                       lag(a.chain_position) OVER (ORDER BY a.chain_position) AS previous_position
                  FROM audit_log a
                 WHERE a.tenant_id = p_tenant
            )
            SELECT c.chain_position, problem.problem
              FROM chain c
              CROSS JOIN LATERAL (
                  VALUES
                      (CASE WHEN c.previous_position IS NOT NULL
                             AND c.chain_position <> c.previous_position + 1
                            THEN 'gap' END),
                      (CASE WHEN c.row_hash IS DISTINCT FROM c.recomputed
                            THEN 'row_hash mismatch' END),
                      (CASE WHEN c.prev_hash IS DISTINCT FROM c.predecessor_hash
                            THEN 'prev_hash mismatch' END)
              ) AS problem(problem)
             WHERE problem.problem IS NOT NULL
             ORDER BY c.chain_position;
        $$
        """
    )
    op.execute(f"REVOKE EXECUTE ON FUNCTION {VERIFY_FUNCTION}(uuid) FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {VERIFY_FUNCTION}(uuid) TO titlepipe_app")


def _create_writer_function() -> None:
    """`AFTER INSERT OR UPDATE OR DELETE FOR EACH ROW` on every audited table.

    🔴 `FOR EACH ROW`, WHERE `0001`'S APPEND-ONLY TRIGGER IS `FOR EACH STATEMENT`,
    AND BOTH ARE RIGHT. `0001` refuses a statement and must therefore fire even
    when the statement matches no rows — under RLS a cross-tenant UPDATE matches
    exactly zero, so a row trigger would be silent for the one case it exists for.
    This one RECORDS rows, so it must fire once per row and has nothing to say
    about a statement that changed none.

    `AFTER` rather than `BEFORE`: the change is recorded only if it actually
    happened. A `BEFORE` writer would file an audit row for a change a later
    constraint refused.

    **SAME TRANSACTION, WHICH IS THE REQUIREMENT AND NOT A SIDE EFFECT.**
    CONVENTIONS §5 and PLAN.md §5: *not a queue, not a log shipper, not a
    background job.* A trigger insert is in the caller's transaction by
    construction, so the change and its record commit together or neither does —
    `tests/test_audit_writer.py::test_a_rolled_back_change_leaves_no_audit_row`
    drives the rollback half.

    GENERIC OVER THE AUDITED TABLE, via `to_jsonb(NEW)`/`to_jsonb(OLD)`, so one
    function serves every table and a new audited table is one `CREATE TRIGGER`
    rather than a new function to keep in step. It requires only that the table
    carries `tenant_id` and `id`, which CONVENTIONS §1 and §2 require of every
    tenant table anyway; a table missing either raises here rather than recording
    a row with a NULL subject.

    🔴 NOT `SECURITY DEFINER`. It inserts as the CALLER, so `audit_log`'s
    `tenant_isolation` policy is applied to the insert and a caller cannot write
    an audit row into another tenant's chain — the same `WITH CHECK` that `0002`
    measured refusing a cross-tenant INSERT. `SECURITY DEFINER` would make this
    function the one place in the schema where that policy does not apply.

    **NO ACTOR MEANS THE CHANGE IS REFUSED, NOT THAT IT IS RECORDED
    ANONYMOUSLY.** `28000` propagates out of the trigger and aborts the caller's
    statement, so there is no path that mutates an audited table without saying
    who did it. That is the only reason this is a control rather than a
    convention: an application that forgets to set the actor GUC does not get an
    unattributed audit row, it gets a failure on the write it was trying to make.
    """
    tags = ", ".join(f"'{tag}'" for tag in RULE_PROVENANCE_TAGS)
    op.execute(
        f"""
        CREATE FUNCTION {WRITER_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $$
        DECLARE
            subject jsonb;
            actor text;
            seat text;
            provenance text;
        BEGIN
            subject := to_jsonb(COALESCE(NEW, OLD));

            actor := nullif(current_setting('{ACTOR_SUBJECT_GUC}', true), '');
            seat := nullif(current_setting('{ACTOR_SEAT_GUC}', true), '');

            IF actor IS NULL OR seat IS NULL THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{NO_ACTOR_SQLSTATE}',
                    MESSAGE = 'no actor is established for a change to '
                              || TG_TABLE_NAME
                              || '; the audit row cannot name who made it',
                    HINT = 'Set {ACTOR_SUBJECT_GUC} and {ACTOR_SEAT_GUC} for the '
                           'session before writing. An unattributed change is '
                           'refused rather than recorded anonymously.';
            END IF;

            provenance := nullif(current_setting('{RULE_PROVENANCE_GUC}', true), '');
            IF provenance IS NOT NULL AND provenance NOT IN ({tags}) THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{NO_ACTOR_SQLSTATE}',
                    MESSAGE = 'unknown rule provenance tag ' || quote_literal(provenance),
                    HINT = 'The four tags are {"/".join(RULE_PROVENANCE_TAGS)}.';
            END IF;

            INSERT INTO audit_log (
                tenant_id, actor_subject, actor_seat, action,
                subject_table, subject_id,
                rule_id, rule_provenance, request_id,
                engine_id, engine_model_version,
                row_hash, chain_position
            ) VALUES (
                (subject ->> 'tenant_id')::uuid,
                actor,
                seat,
                lower(TG_OP)::{AUDIT_ACTION_TYPE_NAME},
                TG_TABLE_NAME,
                (subject ->> 'id')::uuid,
                nullif(current_setting('{RULE_ID_GUC}', true), '')::uuid,
                provenance,
                nullif(current_setting('{REQUEST_ID_GUC}', true), ''),
                nullif(current_setting('{ENGINE_ID_GUC}', true), ''),
                nullif(current_setting('{ENGINE_MODEL_VERSION_GUC}', true), ''),
                -- Both are NOT NULL and both are overwritten by
                -- `audit_chain_link` before the row lands. The placeholders are
                -- what let the columns stay NOT NULL, which is what makes a row
                -- inserted with the chain trigger disabled impossible rather
                -- than merely unhashed.
                ''::bytea,
                0
            );

            RETURN NULL;
        END;
        $$
        """
    )
    op.execute(f"REVOKE EXECUTE ON FUNCTION {WRITER_FUNCTION}() FROM PUBLIC")


def _attach(table: str) -> None:
    """One audited table: the trigger, then `ENABLE ALWAYS`, then the read-back.

    🔴 WHAT IS *NOT* IN `AUDITED_TABLES`, STATED SO IT IS A GAP RATHER THAN AN
    ASSUMPTION. `orders`, `packages`, `pages`, `fields` and `field_readings` are
    `0001`'s skeleton and are NOT audited by this revision. They are being
    remodelled by another worker this phase and attaching a trigger to a table
    about to be rewritten creates a merge conflict for no coverage — the skeleton
    holds no domain data. **A change to a field's value is therefore still
    unaudited today.** `tests/test_audit_writer.py::test_exactly_these_tables_are
    _audited` pins the list so the gap cannot quietly persist unnoticed, and
    `build-retention-audit.md` §8 REQUESTS one `_attach` call per retainable
    table from whoever lands them.

    The catalog read-back is `0004`'s discipline: `ALTER TABLE … ENABLE ALWAYS
    TRIGGER` succeeds whatever `tgenabled` ends up as, and the point of the
    statement is a catalog VALUE. `'A'` is `ENABLE ALWAYS`; `'O'` is the plain
    `ENABLE` default, which is the value a silently-ineffective statement leaves
    behind.
    """
    trigger = f"audit_{table}"
    op.execute(
        f"""
        CREATE TRIGGER {trigger}
        AFTER INSERT OR UPDATE OR DELETE ON {table}
        FOR EACH ROW EXECUTE FUNCTION {WRITER_FUNCTION}()
        """
    )
    op.execute(f"ALTER TABLE {table} ENABLE ALWAYS TRIGGER {trigger}")

    enabled = (
        op.get_bind()
        .execute(
            sa.text(
                "SELECT t.tgenabled FROM pg_trigger t "
                "JOIN pg_class c ON c.oid = t.tgrelid "
                "WHERE c.relname = :table AND t.tgname = :trigger"
            ),
            {"table": table, "trigger": trigger},
        )
        .scalar_one_or_none()
    )
    if enabled != "A":
        raise RuntimeError(
            f"revision 0007 attached {trigger} to {table} and asked for "
            f"ENABLE ALWAYS, and pg_trigger.tgenabled reads {enabled!r} rather "
            f"than 'A'. A trigger left at 'O' is disabled for any session whose "
            f"session_replication_role is 'replica' — which a per-role default "
            f"can set at CONNECT, where no in-session privilege check applies "
            f"(see revision 0004)."
        )


def downgrade() -> None:
    for table in AUDITED_TABLES:
        op.execute(f"DROP TRIGGER audit_{table} ON {table}")

    op.execute(f"DROP TRIGGER {CHAIN_TRIGGER} ON {AUDIT_TABLE}")
    op.execute(f"DROP FUNCTION {WRITER_FUNCTION}()")
    op.execute(f"DROP FUNCTION {VERIFY_FUNCTION}(uuid)")
    op.execute(f"DROP FUNCTION {CHAIN_FUNCTION}()")

    op.drop_constraint(CHAIN_POSITION_CONSTRAINT, AUDIT_TABLE, type_="unique")
    op.drop_constraint(
        f"ck_{AUDIT_TABLE}_a_cited_rule_carries_its_provenance", AUDIT_TABLE, type_="check"
    )
    op.drop_constraint(
        f"ck_{AUDIT_TABLE}_rule_provenance_is_one_of_the_four_tags",
        AUDIT_TABLE,
        type_="check",
    )

    for column in (
        "chain_position",
        "row_hash",
        "prev_hash",
        "engine_model_version",
        "engine_id",
        "request_id",
        "rule_provenance",
        "rule_id",
        "subject_id",
        "subject_table",
        "action",
        "actor_seat",
        "actor_subject",
        "occurred_at",
    ):
        op.drop_column(AUDIT_TABLE, column)

    # 🔴 `DROP COLUMN` DOES NOT DROP A TYPE — the same shape as `0001`'s enum
    # note. Without this a fresh upgrade works and only the SECOND one fails,
    # with `type "audit_action" already exists`.
    AUDIT_ACTION.drop(op.get_bind(), checkfirst=False)
