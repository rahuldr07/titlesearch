"""A golden field is established by somebody who exists, not by a job name

Revision ID: 0102
Revises: 0101
Create Date: 2026-09-05

ASSUMED PARENT: `0101`. Per CONVENTIONS §8 a stated assumption, not a claim
about the final order. It genuinely depends on `0070`/`0071` (the two columns)
and on `0100` (the `resolve_actor` lookup it reuses).

## The defect this closes

Measured on this schema, as `titlepipe_app`, in one statement:

    INSERT INTO golden_fields (tenant_id, order_id, path, value, tag,
                               source_citation, established_by, established_reason)
    SELECT ... FROM field_readings WHERE confidence = 0.20 ...

A 0.20-confidence engine reading moved out of `field_readings` and into the
golden set as `tag = 'agreed'`, with the engine's own OCR snippet as the
citation and `established_by = 'accuracy-backfill'`. **Every constraint was
satisfied and all 41 golden tests stayed green.** A correctly written
leaderboard then reports those same readers as 100.0% accurate against ground
truth they wrote themselves.

`0070` has two checks on `established_by` and both were passed: the string is
non-blank and not `'unknown'` (`established_by_is_signed`), and it does not
start with the engine namespace (`established_by_is_not_an_engine`). Neither
asks the only question that matters — **is there a person here at all?**

`0070`'s docstring reasons that there is "nowhere to put a model output", and
the review found that argument runs BACKWARDS: a missing `engine_id` column
prevents DISCLOSURE, not PROMOTION. Nothing stopped the promotion; the schema
merely had no column in which to admit it had happened.

This matters more now than when it was found. Blind evaluation is deferred, so
the golden set is the SOLE carrier of the accuracy programme, and a golden set
that can be back-filled from the engines it scores measures nothing.

## The fix is the same lookup `0100` already added, on two more columns

`established_by` on `golden_fields` and `signed_by` on `golden_corrections` are
SIGNATURES on a permanent record. `0100` established what a signature has to
resolve to — exactly one ACTIVE `users` row in the tenant of the row being
written — and this revision applies it to both, `AFTER INSERT OR UPDATE`, `FOR
EACH ROW`, `ENABLE ALWAYS`.

`AFTER` AND NOT `BEFORE`, WHICH WAS MEASURED RATHER THAN CHOSEN. A `BEFORE
ROW` trigger runs before every CHECK constraint and before the policy's `WITH
CHECK`, so a `BEFORE` version of this answered FIRST for rows that had nothing
to do with signatures: `value_xor_na_reason`, `citation_is_not_blank`,
`reason_is_not_blank`, `established_by_is_not_an_engine` and the cross-tenant
`order_id` all came back as `28000` from here instead of as the `23514` or the
foreign-key violation that names the actual defect — eleven tests in
`test_golden_set.py` went red saying exactly that. `0072` is `AFTER` for the
same family of reason and says so. This function assigns nothing, so it has no
need of `BEFORE`, and an `AFTER` trigger that raises still aborts the statement:
nothing is committed either way.

`'accuracy-backfill'` is now `28000` on the INSERT. So is any other service
account, job name, team name, initials nobody registered, or a colleague's
identity from another tenant.

`resolve_actor` is reused rather than reimplemented, and its `p_seat` argument
is passed the signer's OWN CURRENT SEAT read from `users`, which makes the seat
half of that function a no-op here. That is deliberate and it is the one
compromise in this file: see the ruling below.

## WHAT THIS DOES NOT DO, EACH ONE STATED SO IT IS NOT READ AS COVERED

**It does not restrict WHICH seat may establish ground truth.** All six of
`0020`'s labels can sign at this revision. Whether a `typist` or a `reviewer`
may establish a golden value is a product ruling in `docs/PRD.md` §5's
territory, not a migration's to invent, and a database that picked one would be
answering a question nobody asked. **WAS NAMED OPEN HERE; RULED 2026-09-08 AND
CLOSED BY `0121`**: the owner restricted establishment to senior, engineer and
admin, and the machine is the one predicate in `signer_body` this paragraph
predicted — `0121` replaces the function with it.

**It does not stop a real person from promoting an engine reading.** A named,
active, seat-holding human can still run the INSERT..SELECT above under their
own signature. What changed is that the record then names a person who can be
asked, instead of a job that cannot. That is a smaller property than "engine
output cannot become ground truth" and this docstring will not claim the larger
one.

**It cannot tell a typed value from a copied one.** `source_citation` is free
text and this revision does not touch it. A citation that quotes an engine's OCR
snippet is indistinguishable, to any check that can be written here, from a
citation quoting the document the snippet came from — because they are the same
words. **What would actually close it:** a citation anchored to a document —
page id plus bounding box, verified against `pages` — so that a golden value
cites a place in a record rather than a string. That work sits with the citation
constraint on `fields` and is deliberately NOT touched here.

## THE CEILING

`titlepipe_owner` can `DROP TRIGGER` and insert freely, as it can for every
other control in this schema. The trigger's presence, its function's body and
`tgenabled` are asserted from git by `tests/test_trigger_function_bodies.py`,
which is a trust domain the owner is not inside. That is what is available; it
is not the same thing as prevention.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0102"
down_revision: str | None = "0101"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


# `(table, column, trigger name)`. A tuple rather than two hand-written blocks:
# the two are identical except for names, and a hand-written second block is
# where the first block's column name gets pasted in.
SIGNED_COLUMNS = (
    ("golden_fields", "established_by", "golden_fields_signer_is_a_person"),
    ("golden_corrections", "signed_by", "golden_corrections_signer_is_a_person"),
)

SIGNER_FUNCTION = "golden_signer_is_a_person"

# `0100`'s resolver, by name. Repeated rather than imported, for the
# frozen-snapshot reason every revision in this tree gives.
RESOLVER_FUNCTION = "resolve_actor"

# `invalid_authorization_specification` — the same code `0100` raises for an
# actor that does not resolve, because this is the same failure: a record signed
# by an identity the database cannot find.
NO_ACTOR_SQLSTATE = "28000"

TRIGGER_ALWAYS = "A"


def signer_body() -> str:
    """The signer check, exposed so a test can compare it to `pg_proc`.

    GENERIC OVER THE SIGNED COLUMN via `to_jsonb(NEW) ->> TG_ARGV[0]`, so one
    function serves both tables and a third signed column is one `CREATE TRIGGER`
    rather than a third body to keep in step. The jsonb round trip is safe here
    for the reason it is NOT safe in `0072`'s immutability branches: this reads
    ONE `text` column and never has to tell SQL NULL from JSON null, because both
    answers lead to the same refusal.

    THE SEAT IS READ, NOT DECLARED. `resolve_actor` takes a seat and compares
    it to `users.role`; here the signer's own current role is looked up and
    handed straight back to it, which makes that comparison a tautology. The
    alternative was to require the writer to declare the signer's seat in a
    third column, and there is no such column and no request for one — a
    signature says WHO, and `0020` already says which seat that person holds.
    What the call still buys, and it is the whole point, is EXISTENCE, ACTIVITY
    and TENANCY: exactly one row, `deactivated_at IS NULL`, in `NEW.tenant_id`.

    The seat lookup and the resolver both run as the CALLER, under `users`'
    `FORCE ROW LEVEL SECURITY`, so a signer in another tenant is invisible here
    rather than merely refused.
    """
    return f"""
        DECLARE
            signer text;
            seat text;
        BEGIN
            signer := to_jsonb(NEW) ->> TG_ARGV[0];

            SELECT u.role::text INTO seat
            FROM users u
            WHERE u.tenant_id = NEW.tenant_id
              AND u.identity_subject = signer
              AND u.deactivated_at IS NULL;

            IF seat IS NULL THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{NO_ACTOR_SQLSTATE}',
                    MESSAGE = TG_TABLE_NAME || '.' || TG_ARGV[0] || ' is '
                              || coalesce(quote_literal(signer), 'null')
                              || ', which is not an active seat of this tenant',
                    HINT = 'Ground truth is signed by a person. A job name, a '
                           'service account or a team is not one, and an engine '
                           'reading promoted under such a name is a truth this '
                           'system would then score that engine against.';
            END IF;

            -- The signer resolves. Hand it to `0100`'s resolver anyway, with the
            -- seat just read, so that the ambiguous case — two identity
            -- providers minting one subject — is refused HERE by the same
            -- function and the same message that refuses it on `audit_log`,
            -- rather than by a second implementation that could drift.
            PERFORM {RESOLVER_FUNCTION}(NEW.tenant_id, signer, seat);

            RETURN NEW;
        END;
    """


def upgrade() -> None:
    op.execute(
        f"""
        CREATE FUNCTION {SIGNER_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $${signer_body()}$$
        """
    )
    op.execute(f"REVOKE EXECUTE ON FUNCTION {SIGNER_FUNCTION}() FROM PUBLIC")

    for table, column, trigger in SIGNED_COLUMNS:
        # `INSERT OR UPDATE` on both. `golden_corrections` refuses UPDATE outright
        # at `0071`, so naming it there is redundant TODAY and costs nothing;
        # naming only INSERT would be a trigger whose correctness depends on
        # another revision's trigger continuing to exist.
        op.execute(
            f"""
            CREATE TRIGGER {trigger}
            AFTER INSERT OR UPDATE ON {table}
            FOR EACH ROW EXECUTE FUNCTION {SIGNER_FUNCTION}('{column}')
            """
        )
        op.execute(f"ALTER TABLE {table} ENABLE ALWAYS TRIGGER {trigger}")

    _require_trigger_state()


def downgrade() -> None:
    for table, _column, trigger in SIGNED_COLUMNS:
        op.execute(f"DROP TRIGGER {trigger} ON {table}")
    op.execute(f"DROP FUNCTION {SIGNER_FUNCTION}()")


def _require_trigger_state() -> None:
    """Read `tgenabled` back, and refuse unless BOTH triggers are at `'A'`."""
    rows = (
        op.get_bind()
        .exec_driver_sql(
            """
            SELECT t.tgname, t.tgenabled
            FROM pg_trigger t
            WHERE NOT t.tgisinternal AND t.tgname = ANY(%(names)s)
            """,
            {"names": [trigger for _table, _column, trigger in SIGNED_COLUMNS]},
        )
        .fetchall()
    )

    states = {str(name): str(enabled) for name, enabled in rows}
    expected = {trigger: TRIGGER_ALWAYS for _table, _column, trigger in SIGNED_COLUMNS}
    if states != expected:
        raise RuntimeError(
            f"the golden signer triggers are {states}, not {expected}. ENABLE "
            f"ALWAYS is what keeps them firing under session_replication_role = "
            f"'replica', where a plain ENABLE trigger is off for the whole "
            f"session without any statement having turned it off."
        )
