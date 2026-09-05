"""The audit actor stops being a free string and becomes a resolved seat

Revision ID: 0100
Revises: 0080
Create Date: 2026-09-05

ASSUMED PARENT: `0080`, the head of the chain as this file is written. Per
CONVENTIONS §8 that is a stated assumption and not a claim about the final
order; this revision genuinely depends on `0001`/`0007` (the `audit_log` table
and its chain) and `0020` (the `users` table it resolves against), and on
nothing else.

## The defect this closes

`0007` writes `app.actor_subject` and `app.actor_seat` into `audit_log`
VERBATIM. It checks that both are PRESENT — an unattributed change is refused —
and it checks nothing else. `0007`'s own comment is honest that "a role can set
its own GUC", and the consequence was measured on this schema: a session set
`app.actor_subject` and `app.actor_seat` to a DIFFERENT user's identity,
inserted a `legal_holds` row, and the audit row attributed the mutation to the
forged user. **An actor could attribute their own mutation to somebody else, and
the record read as if that person had made it.**

Presence is not authenticity. This revision adds the missing half.

## 🔴 THE BINDING IS ON `audit_log`, NOT ON `audit_record_change`

The obvious place to resolve the actor is the writer, and it is the wrong one.
`audit_record_change` is ONE of the ways a row reaches `audit_log`; a direct
`INSERT INTO audit_log` is another, `titlepipe_app` is granted it by `0002`, and
the isolation seed uses it. A check in the writer leaves that door open and
would have read, in this docstring, as if it did not.

So the binding is a `BEFORE INSERT ... FOR EACH ROW` trigger on `audit_log`
itself, which every row passes through however it arrives. `audit_record_change`
is NOT modified by this revision — it goes on copying the GUCs into the two
columns, and those columns are now resolved underneath it.

## 🔴 `audit_log_bind_actor` MUST FIRE BEFORE `audit_log_chain_link`, AND THE NAME IS WHAT MAKES IT

PostgreSQL fires same-timing row triggers in ALPHABETICAL ORDER OF TRIGGER NAME.
`0007`'s chain trigger is `audit_log_chain_link` and it hashes `to_jsonb(NEW)` —
the whole row as it stands when the hash is taken. A binder that fired after it
would leave `actor_user_id` and `actor_principal` OUTSIDE the hash, which is
precisely the property that makes the rest of the row tamper-evident.

`audit_log_bind_actor` sorts before `audit_log_chain_link` on `b` < `c`. That is
load-bearing and it is one character wide, so
`tests/test_actor_identity.py::test_the_bound_actor_columns_are_inside_the_chain_hash`
drives it behaviourally — it recomputes the hash without the actor columns and
asserts the stored hash is not that.

## What the database can now check, and it is a lookup rather than a convention

`resolve_actor(tenant, subject, seat)` refuses unless ALL of the following
hold in THE TENANT OF THE ROW BEING WRITTEN — `NEW.tenant_id`, not the session
GUC, because the actor on an audit row must be a seat of the tenant that row
belongs to and those are only the same thing while RLS is in force:

* a `users` row exists with `identity_subject = subject`;
* that row is ACTIVE — `deactivated_at IS NULL`. A retired seat cannot sign;
* exactly ONE such row exists. Two identity providers can mint the same subject
  string and `uq_users_tenant_id_identity_provider_identity_subject` permits it;
  an ambiguous actor is refused rather than resolved to whichever row a scan
  reached first;
* that row's `role` IS the declared seat. `0020` makes the seat the thing every
  authorization decision reads, so "which seat was in force" is a claim the
  audit row makes and this is what makes it true.

So `'accuracy-backfill'`, `'TEST-ONLY'`, a service-account label, a name from
another tenant, and a real colleague's subject with a seat they do not hold are
all now `28000` on the WRITE rather than a plausible line in a legal record.

## 🔴 THE CEILING, STATED BECAUSE A DOCSTRING MUST NOT CLAIM MORE THAN THE MACHINE DELIVERS

**This does NOT make the actor authentic. It makes the actor REAL.**

Every browser session in this system arrives on ONE shared login role,
`titlepipe_app`. The database cannot tell one human on that role from another,
and a caller that wants to attribute its mutation to a real, active, correctly
seated colleague can still do so. What changed is the size of the set it can
forge into: from "any string at all" to "this tenant's own active seat-holders",
and every forgery must now name somebody who exists and claim the seat that
person actually holds.

`actor_principal` narrows it a second way without closing it. It is
`session_user`, supplied by the server and never by the caller, and it is the
one identity fact in the row a `SET ROLE` cannot move: an owner who escalated
from `titlepipe_migration` still records `titlepipe_migration`. A mutation made
from a migration session while claiming a reviewer's identity is now VISIBLE in
the record. Visible, not prevented.

And the standing ceiling this whole family of controls shares: everything here
is owned by `titlepipe_owner`, which is one `SET ROLE` from `titlepipe_migration`,
a LOGIN role. The owner can `DROP TRIGGER audit_log_bind_actor`. What notices
that is not in the database at all — it is
`tests/test_trigger_function_bodies.py`, whose expectations live in git, which
is the only trust domain in this system that the database owner is not inside.

**What would actually close it:** the identity provider signs a short-lived
assertion over (tenant, subject, seat, expiry) with a key the application role
does not hold, and this function verifies that signature — `pgcrypto` can do it
against a public key — instead of trusting the GUC. That moves the trust anchor
outside `titlepipe_app`, which is the only place it can go. It needs the
identity provider PLAN.md §8 step 3 schedules and that does not exist yet. Until
then the honest reading of `audit_log.actor_subject` is "an actor the
application asserted, which the database confirmed is a real active seat of this
tenant" — not "the actor".
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0100"
down_revision: str | None = "0080"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


AUDIT_TABLE = "audit_log"
USERS_TABLE = "users"

# Repeated from `0007`/`0020` rather than imported, for the frozen-snapshot
# reason every revision in this tree gives: a migration records what the schema
# was asked to become, and an import would let a later edit elsewhere rewrite
# history. `tests/test_actor_identity.py` keeps the spellings honest.
ACTOR_SUBJECT_GUC = "app.actor_subject"
ACTOR_SEAT_GUC = "app.actor_seat"

# `28000` is `invalid_authorization_specification` — PostgreSQL's own named
# condition for "the session has not said who it is", and `0007` already raises
# it for the absent actor. The same code for "and not who it says it is" is
# correct: both are the session failing to establish an identity.
NO_ACTOR_SQLSTATE = "28000"

RESOLVER_FUNCTION = "resolve_actor"

# 🔴 SORTS BEFORE `audit_log_chain_link`. See the module docstring; `b` < `c` is
# the whole mechanism and it is not an accident of naming.
BINDER_FUNCTION = "audit_log_bind_actor"
BINDER_TRIGGER = "audit_log_bind_actor"

TRIGGER_ALWAYS = "A"

# `(tenant_id, identity_subject)`. The existing unique constraint leads
# `(tenant_id, identity_provider, identity_subject)`, so a lookup that knows the
# tenant and the subject but not the provider cannot use it — the provider sits
# between the two columns the resolver has. This index is what keeps a per-row
# trigger lookup off a sequential scan of `users` on every audited write. NOT
# unique: two providers may legitimately mint the same subject, and the resolver
# REFUSES that case rather than the index doing it, so the refusal can say why.
ACTOR_SUBJECT_INDEX = "ix_users_tenant_id_identity_subject"


def resolver_body() -> str:
    """The `resolve_actor` body, as one string, so a test can compare it to `pg_proc`.

    🔴 EXPOSED AS A FUNCTION RATHER THAN INLINED, AND THAT IS THE POINT OF THE
    SHAPE. `tests/test_trigger_function_bodies.py` reads `prosrc` off the live
    database and compares it to what THIS module says the body is. Nothing else
    in this repository reads a function body, and a `CREATE OR REPLACE` that
    guts one leaves `tgenabled`, `tgtype` and `proname` identical — so a catalog
    assertion cannot see it and a source assertion can.
    """
    return f"""
        DECLARE
            resolved uuid;
            resolved_seat text;
            matches integer;
        BEGIN
            IF p_tenant IS NULL
               OR p_subject IS NULL OR btrim(p_subject) = ''
               OR p_seat IS NULL OR btrim(p_seat) = '' THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{NO_ACTOR_SQLSTATE}',
                    MESSAGE = 'no actor is established for this change; the '
                              || 'audit row cannot name who made it',
                    HINT = 'Set {ACTOR_SUBJECT_GUC} and {ACTOR_SEAT_GUC} for the '
                           'session before writing. An unattributed change is '
                           'refused rather than recorded anonymously.';
            END IF;

            -- The count and the row in ONE pass. Two providers may mint the same
            -- subject within one tenant and the schema permits it; resolving to
            -- whichever row the scan returned first would make the audit trail
            -- depend on a query plan. `min(...)` over a set of one is that one.
            SELECT count(*), min(u.id::text), min(u.role::text)
            INTO matches, resolved, resolved_seat
            FROM {USERS_TABLE} u
            WHERE u.tenant_id = p_tenant
              AND u.identity_subject = p_subject
              AND u.deactivated_at IS NULL;

            IF matches = 0 THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{NO_ACTOR_SQLSTATE}',
                    MESSAGE = 'actor ' || quote_literal(p_subject)
                              || ' is not an active seat of tenant '
                              || p_tenant,
                    HINT = 'An audit row names a person. The declared actor '
                           'resolves to no active {USERS_TABLE} row here, so the '
                           'change is refused rather than attributed to nobody or '
                           'to a seat that has been retired.';
            END IF;

            IF matches > 1 THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{NO_ACTOR_SQLSTATE}',
                    MESSAGE = 'actor ' || quote_literal(p_subject)
                              || ' resolves to ' || matches
                              || ' active seats of tenant ' || p_tenant,
                    HINT = 'Two identity providers have minted the same subject. '
                           'An ambiguous actor is refused; the audit row would '
                           'otherwise name whichever row the scan reached first.';
            END IF;

            IF resolved_seat IS DISTINCT FROM p_seat THEN
                RAISE EXCEPTION USING
                    ERRCODE = '{NO_ACTOR_SQLSTATE}',
                    MESSAGE = 'actor ' || quote_literal(p_subject)
                              || ' holds seat ' || quote_literal(resolved_seat)
                              || ', not ' || quote_literal(p_seat),
                    HINT = 'The seat on an audit row is the seat that was in '
                           'force. Declaring one the actor does not hold would '
                           'make that column a claim rather than a fact.';
            END IF;

            RETURN resolved;
        END;
    """


def binder_body() -> str:
    """`audit_log_bind_actor` — resolve, then OVERWRITE both columns.

    `:=` on `NEW` and not a comparison, for exactly `0007`'s reason about
    `row_hash`: *"the application can't choose either value."* A binder that
    CHECKED a caller-supplied `actor_user_id` would be satisfied by a caller
    that supplied the right one for the wrong actor. Assigning it means there is
    no supplied value to be right or wrong.

    `session_user`, NOT `current_user`. `SET ROLE` moves the second and cannot
    move the first, so this is the one identity column in the row that an
    escalation to the owner still reports honestly.
    """
    return f"""
        BEGIN
            NEW.actor_user_id := {RESOLVER_FUNCTION}(
                NEW.tenant_id, NEW.actor_subject, NEW.actor_seat
            );
            NEW.actor_principal := session_user;
            RETURN NEW;
        END;
    """


def upgrade() -> None:
    op.execute(f"CREATE INDEX {ACTOR_SUBJECT_INDEX} ON {USERS_TABLE} (tenant_id, identity_subject)")

    op.execute(
        f"""
        CREATE FUNCTION {RESOLVER_FUNCTION}(p_tenant uuid, p_subject text, p_seat text)
        RETURNS uuid
        LANGUAGE plpgsql STABLE AS $${resolver_body()}$$
        """
    )
    # PUBLIC has no business resolving seats. `titlepipe_app` is named because it
    # is the role the binder runs as on every application write; `0007` grants
    # its own writer nothing and relies on the trigger, but this function is also
    # directly useful to a caller that wants to fail early, so the grant is
    # explicit rather than incidental.
    op.execute(f"REVOKE EXECUTE ON FUNCTION {RESOLVER_FUNCTION}(uuid, text, text) FROM PUBLIC")
    op.execute(f"GRANT EXECUTE ON FUNCTION {RESOLVER_FUNCTION}(uuid, text, text) TO titlepipe_app")

    # 🔴 `NOT NULL` WITH NO DEFAULT, WHICH IS WHAT MAKES A ROW INSERTED WITH THE
    # BINDER DISABLED IMPOSSIBLE RATHER THAN MERELY UNBOUND. `0007` uses the same
    # construction for `row_hash` and `chain_position`: the trigger fills them,
    # constraints are checked after `BEFORE` triggers run, and the column is
    # left `NOT NULL` so that turning the trigger off breaks the INSERT instead
    # of quietly producing an unbound row.
    #
    # It also means this revision REFUSES to run against a populated `audit_log`,
    # and that refusal is correct rather than an oversight: there is no truthful
    # `actor_user_id` for a row written before the actor was resolvable, and
    # CONVENTIONS §4 forbids inventing one to satisfy a constraint. `0007` added
    # eight such columns to this table on exactly these terms.
    op.add_column(
        AUDIT_TABLE,
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
    )
    op.add_column(AUDIT_TABLE, sa.Column("actor_principal", sa.Text(), nullable=False))

    op.execute(
        f"""
        CREATE FUNCTION {BINDER_FUNCTION}() RETURNS trigger
        LANGUAGE plpgsql AS $${binder_body()}$$
        """
    )
    op.execute(f"REVOKE EXECUTE ON FUNCTION {BINDER_FUNCTION}() FROM PUBLIC")
    op.execute(
        f"""
        CREATE TRIGGER {BINDER_TRIGGER}
        BEFORE INSERT ON {AUDIT_TABLE}
        FOR EACH ROW EXECUTE FUNCTION {BINDER_FUNCTION}()
        """
    )
    # `ENABLE ALWAYS` for `0004`'s measured reason: a per-role
    # `session_replication_role = 'replica'` default is applied at CONNECT and
    # never checked again, so a plain `ENABLE` trigger can be silently off for a
    # whole session before any statement runs.
    op.execute(f"ALTER TABLE {AUDIT_TABLE} ENABLE ALWAYS TRIGGER {BINDER_TRIGGER}")

    _require_trigger_state(TRIGGER_ALWAYS)


def downgrade() -> None:
    op.execute(f"DROP TRIGGER {BINDER_TRIGGER} ON {AUDIT_TABLE}")
    op.execute(f"DROP FUNCTION {BINDER_FUNCTION}()")
    op.drop_column(AUDIT_TABLE, "actor_principal")
    op.drop_column(AUDIT_TABLE, "actor_user_id")
    op.execute(f"DROP FUNCTION {RESOLVER_FUNCTION}(uuid, text, text)")
    op.execute(f"DROP INDEX {ACTOR_SUBJECT_INDEX}")


def _require_trigger_state(expected: str) -> None:
    """Refuse unless the trigger is at `expected` — `0004::_require_trigger_state`.

    "The `ALTER` statement ran" and "`tgenabled` is `'A'`" are different claims
    and only the second is this revision's point.
    """
    rows = (
        op.get_bind()
        .exec_driver_sql(
            """
            SELECT t.tgenabled
            FROM pg_trigger t
            JOIN pg_class c ON c.oid = t.tgrelid
            WHERE c.relname = %(table)s
              AND NOT t.tgisinternal
              AND t.tgname = %(name)s
            """,
            {"table": AUDIT_TABLE, "name": BINDER_TRIGGER},
        )
        .fetchall()
    )

    state = str(rows[0][0]) if rows else None
    if state != expected:
        raise RuntimeError(
            f"{BINDER_TRIGGER} on {AUDIT_TABLE} is at tgenabled={state!r}, not "
            f"{expected!r}. ENABLE ALWAYS is what keeps it firing under "
            f"session_replication_role = 'replica'; without it the actor columns "
            f"are unbound and the INSERT fails on NOT NULL instead."
        )
