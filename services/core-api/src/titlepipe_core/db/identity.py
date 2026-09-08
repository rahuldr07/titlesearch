"""`users` and `clients` — the two tenant-scoped tables identity needs.

**A SEPARATE MODULE FROM `db/models`, AND THE SPLIT IS BOUNDARY-DRIVEN RATHER
THAN THEMATIC.** `db/models` is the domain schema. These two tables are what the
authentication seam reads: `users` is the row a provider subject resolves TO, and
`clients` is the customer an order belongs to. Keeping them here means the seam
imports one module rather than the whole domain, and it means a change to either
is reviewable next to the seam that depends on it.

`Base` is imported from `titlepipe_core.db.models` rather than redeclared,
because `Base.metadata` must stay ONE registry: a second `DeclarativeBase` here
would give `alembic check` a metadata that does not contain these tables, and it
would report a clean schema while they drifted.

**`_IdentityRow` BELOW RESTATES `_TenantRow` RATHER THAN INHERITING IT, AND THE
RESTATEMENT IS FORCED RATHER THAN CHOSEN.** `_TenantRow` is private to
`db/models`, `[tool.pyright] typeCheckingMode = "strict"` is on with no
relaxation outside `tests`, and `reportPrivateUsage` fires on the import —
MEASURED against pyright 1.1.411. The alternatives were a banned
`# pyright: ignore` (`scripts/check_backend_rules.py` refuses one without a
`rules-allow`) or renaming a symbol in a module this revision does not own.

A restated convention is a convention that can drift, so it is not left to
reading: `tests/test_identity_schema.py::test_the_identity_tables_carry_the_same
_identity_columns_as_a_domain_tenant_table` reads `users`, `clients` and `orders`
out of `information_schema` and compares the three shared columns and the primary
key IN KEY ORDER. If `_TenantRow` changes, that test goes red here.

---------------------------------------------------------------------------
🔴 THE ROLE COLUMN IS THE AUTHORIZATION INPUT, AND IT IS A COLUMN AND NOT A
   CLAIM. `docs/PRD.md` §9's correction note is explicit: "PostgreSQL owns
   authorization — WorkOS's own role/permission claims are deliberately
   ignored". That sentence is the whole reason this column exists here rather
   than being read off a token: a permission change takes effect on the NEXT
   REQUEST because the next request reads this row, not at token expiry.
---------------------------------------------------------------------------
`titlepipe_core.auth` states the same property from the other side, and states
what enforces it: `ProviderIdentity` has no role field, so no provider — real or
mock — has anywhere to put one.

**`clerk_id` FROM PRD §7 IS NOT SPELLED THAT WAY HERE, AND THE RENAME IS THE
POINT.** The identity provider is UNRESOLVED: `docs/PRD.md` §9 was corrected on
2026-08-07 to WorkOS AuthKit under ADR-0001, `packages/contract/src/authz.ts`
still names Clerk in two comments, and the sign-in screen implements neither. A
column named after one vendor is that vendor's name in every query, index and
migration the day the other one is chosen. `identity_provider` +
`identity_subject` carry the same information and name no vendor.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Final

from sqlalchemy import CheckConstraint, DateTime, Index, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from titlepipe_core.db.models import Base, bounded_jsonb_object

__all__ = [
    "USER_ROLE",
    "USER_ROLE_LABELS",
    "USER_ROLE_TYPE_NAME",
    "Client",
    "User",
]

# 🔴 EXACTLY THESE SIX LABELS, IN EXACTLY THIS ORDER. They are
# `packages/contract/src/authz.ts`'s `ROLES` verbatim, and that array is what the
# browser derives every door and affordance from. `docs/PRD.md` §5 names the same
# six seats in prose — Reviewer, Senior, Ops lead, Engineer, Typist (temp),
# Owner/Admin — so the two independent statements of the seat list agree, and
# this tuple is the third.
#
# Lower case here and lower case there deliberately: a database that folded the
# case would make every authorization decision a translation rather than a
# comparison, and `x-mock-role: Admin` is already a rejected value in
# `apps/web/e2e/invariants/hard.spec.ts` precisely because casing is not
# forgiven anywhere else.
#
# AN ENUM AND NOT `text` WITH A CHECK, for the reason `db/models` gives for
# `na_reason`: an unknown seat becomes a WRITE error at the moment something
# invents one, rather than a read-time surprise on a screen months later. There
# is deliberately NO catch-all member and no `unknown` — a user whose seat cannot
# be named is a user who must not be admitted, and that is a refusal at the seam
# rather than a row this table can hold.
#
# `migrations/versions/0020_users.py` repeats this tuple verbatim rather than
# importing it, exactly as `0001` repeats `NA_REASON_LABELS` and `0003` repeats
# the rulebook's: a migration is a frozen snapshot of one revision, and an import
# would let a later edit here silently rewrite what `0020` claims to have
# created. The two are held together via the LIVE CATALOG — see
# `tests/test_identity_schema.py`, which asserts this tuple against literals AND
# against `pg_enum`'s labels in `enumsortorder`, because those two legs catch
# different mutations.
USER_ROLE_LABELS: Final = ("reviewer", "senior", "ops", "engineer", "typist", "admin")

USER_ROLE_TYPE_NAME: Final = "user_role"

# `create_type=False` because `0020` creates the type EXPLICITLY, as its own
# statement with its own line in `downgrade()`. Left to SQLAlchemy the `CREATE
# TYPE` is a side effect of `CREATE TABLE` and there is no corresponding `DROP` —
# `DROP TABLE` does not drop a type, so only the SECOND upgrade fails.
USER_ROLE: Final = ENUM(*USER_ROLE_LABELS, name=USER_ROLE_TYPE_NAME, create_type=False)


class _IdentityRow(Base):
    """`tenant_id`, `id`, `created_at` — `db/models._TenantRow`'s three columns.

    `__abstract__` means SQLAlchemy maps no table for this class, so it produces
    no DDL and never appears in `Base.metadata.tables`.

    🔴 `tenant_id` IS DECLARED FIRST AND IS PART OF THE PRIMARY KEY. SQLAlchemy
    builds an implicit primary key in table-column order and, within one class,
    table-column order is declaration order — so the key comes out
    `(tenant_id, id)`. `_TenantRow` reaches the same place from a subclass, where
    declaration order alone cannot, via `sort_order=-1`.

    WHAT THE COMPOSITE KEY BUYS, in one line, with the measurement left where it
    was taken (`db/models._TenantRow`): unique enforcement runs BEFORE a policy's
    `WITH CHECK`, so a single-column `PRIMARY KEY (id)` under `FORCE ROW LEVEL
    SECURITY` answers "does this id exist in another tenant?" to a caller who can
    read neither row.

    `nullable=False` on `tenant_id` is redundant against the primary key and is
    written anyway, for `_TenantRow`'s reason: dropping `tenant_id` from the key
    must not silently make the column nullable, and a nullable `tenant_id` is
    worse than an error — `NULL = <anything>` is NULL, so the row satisfies no
    policy, is invisible to every tenant, and cannot be deleted by any of them.
    """

    __abstract__ = True

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, nullable=False
    )
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class User(_IdentityRow):
    """One person's seat in one tenant.

    ---------------------------------------------------------------------------
    🔴 `(tenant_id, identity_provider, identity_subject)` IS UNIQUE, AND THE
       `tenant_id` PREFIX IS LOAD-BEARING RATHER THAN TIDY.
    ---------------------------------------------------------------------------
    `db/models._TenantRow` measures the cross-tenant existence oracle a
    single-column key opens under `FORCE ROW LEVEL SECURITY`: unique enforcement
    runs BEFORE a policy's `WITH CHECK`, so an INSERT distinguishes a value held
    by another tenant from a value held by nobody, to a caller who can read
    neither row. That measurement was taken on a primary key; it applies
    identically to every unique constraint, and these two are the first natural
    keys in this schema — which is exactly the case `CONVENTIONS.md` §2 says must
    not be retrofitted after the fact.

    Unprefixed, `uq_users_email` would answer "is this person a user of some
    other customer of this shop?" to anyone who can attempt a signup. For an
    abstracting shop whose tenants are competitors, that is a real disclosure and
    not a theoretical one. Prefixed, the same INSERT succeeds and discloses
    nothing.

    THE SAME PERSON IS TWO ROWS IN TWO TENANTS, and that is the intended shape
    rather than a duplication to clean up later: the seat, the email of record
    and the deactivation are all per-tenant facts, and WorkOS models the same
    thing as one user in two organizations.

    **`role` IS NEVER READ FROM THE WIRE.** See the module docstring and
    `titlepipe_core.auth.identity.ProviderIdentity`, which has no field a role
    could travel in.

    **DEACTIVATION IS A TIMESTAMP AND NOT A BOOLEAN.** `CONVENTIONS.md` §3 gives
    a domain event its own verb-past name, and "when did this seat stop being
    admitted" is a question an audit answers and `is_active` cannot. Active means
    `deactivated_at IS NULL`; there is no second flag that could disagree with it.
    """

    __tablename__ = "users"

    __table_args__ = (
        # 🔴 NOT UNIQUE, AND `0100` IS WHY IT EXISTS AT ALL. That revision's
        # `resolve_actor` looks a seat up by `(tenant_id, identity_subject)` on
        # every insert into `audit_log`, and the unique constraint below leads
        # `(tenant_id, identity_provider, identity_subject)` — the provider sits
        # between the two columns the resolver has, so that index cannot serve
        # the lookup and a per-row trigger would fall back to a sequential scan.
        #
        # Uniqueness is deliberately NOT claimed here: two providers may mint the
        # same subject within one tenant and the schema permits it. `resolve_actor`
        # REFUSES that case with a message that says so, which a unique index
        # would pre-empt with `23505` at the wrong moment — on the `users` insert
        # rather than on the write whose actor is ambiguous.
        Index("ix_users_tenant_id_identity_subject", "tenant_id", "identity_subject"),
        UniqueConstraint("tenant_id", "email", name="uq_users_tenant_id_email"),
        UniqueConstraint(
            "tenant_id",
            "identity_provider",
            "identity_subject",
            name="uq_users_tenant_id_identity_provider_identity_subject",
        ),
        # 🔴 THE THREE CHECKS ARE THE SEAM'S PRECONDITIONS, WRITTEN WHERE THEY
        # CANNOT BE SKIPPED BY A CODE PATH.
        #
        # `email = lower(email)`: without it `Ada@x.test` and `ada@x.test` are two
        # rows satisfying the unique constraint, and "which one is the seat" has
        # no answer. Normalisation in application code would be one `.lower()`
        # away from a second writer that forgets.
        #
        # The two `btrim` checks close the empty-string hole this codebase has
        # already been bitten by once: `tenant_session` encodes an absent tenant
        # as `''` and the policy's `nullif(…, '')` is what turns that into "match
        # nothing". A provider that returns an empty subject on a failed parse
        # would otherwise get a row that matches — the failure mode is a session
        # resolving to SOMEBODY rather than to nobody, which is the worst
        # available outcome and the quietest.
        CheckConstraint("email = lower(email)", name="email_is_lowercase"),
        CheckConstraint("length(btrim(identity_subject)) > 0", name="identity_subject_is_present"),
        CheckConstraint(
            "length(btrim(identity_provider)) > 0", name="identity_provider_is_present"
        ),
    )

    email: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[str] = mapped_column(USER_ROLE, nullable=False)

    # `Text` and not an enum, and this is the one place in the file where the
    # LOOSER type is the decision. The provider set is genuinely open — ADR-0001
    # signed WorkOS AuthKit, `authz.ts` still says Clerk, and neither is
    # installed — so an enum here would be a closed world asserted over an open
    # question, and `CONVENTIONS.md` §4's "an unknown enum value is a WRITE-time
    # error" would fire on the day somebody adopts the provider the owner picked.
    # What keeps it honest instead is `titlepipe_core.auth.provider`: a provider
    # name that no registered adapter claims is refused at the seam, so the set
    # of values this column can ever hold is bounded by the set of installed
    # adapters rather than by a type nobody may extend without a migration.
    identity_provider: Mapped[str] = mapped_column(Text, nullable=False)

    # The provider's opaque subject. Never parsed, never split, never used as a
    # display value — `CONVENTIONS.md` §2's "no natural key without the tenant_id
    # prefix" is why it is unique only in company with `tenant_id` above.
    identity_subject: Mapped[str] = mapped_column(Text, nullable=False)

    deactivated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Client(_IdentityRow):
    """One customer of the shop — a lender, an attorney, a real-estate company.

    `docs/PRD.md` §7's row verbatim: `clients(id, tenant_id, name,
    delivery_method, delivery_config, report_shape, template_ref)`.

    **TWO `client_id` COLUMNS POINT HERE, AND `0110` IS WHAT MAKES THEM
    REFERENCES.** `db/models/orders.Order` and
    `db/models/intake.ClientConfigVersion` each carry a composite
    `(tenant_id, client_id) REFERENCES clients (tenant_id, id)` —
    `CONVENTIONS.md` §1: a single-column FK to a tenant-scoped table is a defect,
    because it would let a row in tenant A reference a row in tenant B and no
    policy would see it. Neither is declared from THIS side: the referencing
    tables belong to the domain schema, and `relations.tenant_fk` is where the
    reasoning lives.

    🔴 THE COLUMNS BELOW ARE WHY THAT CONSTRAINT IS NOT BOOKKEEPING.
    `delivery_method`, `delivery_config` and `template_ref` are the DESTINATION a
    rendered report is transmitted to, so an order naming another tenant's client
    is one shop's deliverable addressed to another shop's customer.

    **`delivery_method` AND `report_shape` ARE `text` AND NOT ENUMS, AND THAT IS
    CITED RATHER THAN LAZY.** `packages/contract/src/entities.ts:283` types
    `Delivery.method` as `z.string()` — the wire deliberately does not close the
    set — and no artefact in this repository enumerates the report shapes; PRD
    §11 names "Shapes A (built) and B" in prose and the shape list is owner-owned
    product surface. `CONVENTIONS.md` §4's enum rule bites where the label set is
    KNOWN and closed; asserting a closed set here would be inventing one, which
    is the failure the same section forbids for values.

    `delivery_config` is `jsonb` and nullable: a client with no per-method
    configuration has none, and `{}` would be a fabricated value standing in for
    an absence — the `field_readings.line_coords` precedent.
    """

    __tablename__ = "clients"

    # `0112`. The delivery DESTINATION is the one jsonb column in this schema
    # with a live consumer, and until that revision it accepted an array, a
    # string, a number and the JSON `null` as readily as an object, at any size.
    # See `db/models/jsonb.bounded_jsonb_object`.
    __table_args__ = (bounded_jsonb_object("delivery_config", nullable=True),)

    name: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_method: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_config: Mapped[dict[str, object] | None] = mapped_column(JSONB, nullable=True)
    report_shape: Mapped[str] = mapped_column(Text, nullable=False)
    template_ref: Mapped[str | None] = mapped_column(Text, nullable=True)
