"""The domain's PostgreSQL enum types, and the line between confirmed and invented.

**EVERY PostgreSQL ENUM TYPE IN THIS PACKAGE IS DECLARED HERE, INCLUDING THE
SKELETON'S THREE.** `na_reason`, `rule_status` and `rule_origin` were written in
`base.py` when `base.py` was the whole model; they are the same kind of object as
the rest and there is no property that distinguishes them, so keeping them
elsewhere would mean a reader looking for a type had two places to look and no
rule for choosing. They are first below, under their own heading, because their
migrations (`0001` and `0003`) already exist and repeat their labels verbatim —
which is a constraint on editing them that the domain's types do not carry.

This module imports nothing from `base.py`. `base.py` imports ONE name from here
— `AUDIT_ACTION`, for `audit_log.action` — and that direction is the only one
that may ever exist: enum types are DDL objects with no dependency on the
declarative base, so the edge points from the tables to the types and the import
graph stays a tree. The reverse edge would be the ordering problem, and there is
no reason to add it.

🔴 **TWO CLASSES OF ENUM LIVE HERE AND THE DIFFERENCE IS THE MOST IMPORTANT
THING IN THE FILE.** A CONFIRMED enum's labels are `packages/contract/src/*.ts`
verbatim — the browser parses those exact strings through Zod at its own
boundary, so a label that differs by a character makes every response a
translation instead of a read, and the divergence surfaces as a parse failure in
a screen rather than as an error here. An INVENTED enum has no contract behind
it: this file is where its vocabulary is decided, so it is marked, and a later
contract that disagrees corrects THIS file rather than being bent to match it.
Each constant below says which it is and cites its line where it is confirmed.

**ENUMS AND NOT `text` WITH A CHECK**, for the reason `base.py` gives twice: an
unknown value becomes a WRITE error the moment something invents one, rather
than a read-time surprise in a screen months later.

**NO CATCH-ALL MEMBER, ANYWHERE.** `page_kind` is the one that invites it and
refuses it: a page nobody has classified yet is NULL, not `unknown`, because
"not yet looked at" is a pipeline state and this column answers "what is it".
`judgment_status` DOES carry `unknown`, and that is not the same thing — there
`unknown` is a determination somebody made about a judgment whose enforceability
the record does not settle, and it routes to review. One is an absence of work,
the other is the result of work.

**`create_type=False` throughout**, for `base.py`'s reason: each migration
creates the type as its own statement so that `downgrade()` has something to
drop. `DROP TABLE` does not drop a type, and a type left behind kills the next
`upgrade` with `type "..." already exists` — a failure only a round trip finds.
"""

from __future__ import annotations

from typing import Final

from sqlalchemy.dialects.postgresql import ENUM

# ---------------------------------------------------------------------------
# THE SKELETON'S THREE — created by migrations `0001` and `0003`, which repeat
# every label below verbatim. Editing a tuple here does NOT edit the migration;
# `tests/test_schema_migration.py` reading the live `pg_enum` is what holds the
# two copies together.
# ---------------------------------------------------------------------------


# 🔴 EXACTLY FOUR LABELS, IN THIS ORDER. `migrations/versions/0001_skeleton.py`
# repeats this tuple verbatim and `tests/test_schema_migration.py` asserts the
# live `pg_enum` against it — on the count AND on `enumsortorder`, separately,
# because a reordering leaves the count untouched.
#
# The repetition is deliberate: a migration is a frozen snapshot of a schema at
# one revision, and importing this constant into `0001` would let a later edit
# here silently rewrite what `0001` claims to have created. The test is what
# keeps the two honest.
#
# WHY AN ENUM AND NOT A `text` COLUMN WITH A CHECK. An unknown value becomes a
# WRITE error at the moment some engine invents one, rather than a read-time
# surprise in a screen months later. `pending` and `unsettled` are deliberately
# absent — those are pipeline STATES, not reasons a value is absent, and
# collapsing the two is the confusion this column exists to prevent.
#
# `NOT_PRESENT` and `PRESENT_UNREADABLE` must never be collapsed (CLAUDE.md, and
# CONTEXT §11): "the field is not on the page" and "the field is on the page and
# the ink is gone" lead to different work.
NA_REASON_LABELS: Final = ("NOT_PRESENT", "NOT_FOUND", "NOT_STATED", "PRESENT_UNREADABLE")

# `create_type=False` because migration `0001` creates the type EXPLICITLY, as
# its own statement with its own line in `downgrade()`. Leaving SQLAlchemy to
# emit `CREATE TYPE` as a side effect of `CREATE TABLE` is how the type ends up
# with no corresponding `DROP TYPE` — `DROP TABLE` does not drop a type, so the
# second `upgrade` after a `downgrade` then dies on `type "na_reason" already
# exists`.
# The type's name in the catalog, as its own constant. `ENUM.name` is typed
# `str | None`, so a test reading it back would have to narrow before it could
# compare anything; and `"na_reason"` was written out three times in
# `tests/test_schema_migration.py` for exactly that reason.
NA_REASON_TYPE_NAME: Final = "na_reason"

NA_REASON: Final = ENUM(*NA_REASON_LABELS, name=NA_REASON_TYPE_NAME, create_type=False)

# 🔴 THE RULEBOOK'S TWO ENUMS. LABELS AND ORDER ARE `packages/contract/src/enums
# .ts` VERBATIM — `RuleStatus` at :72, `RuleOrigin` at :75-81 — and the browser
# parses the same strings through Zod at its own boundary. Lower case there and
# lower case here on purpose: a database that folded them would make every
# response a translation rather than a read.
#
# ENUMS AND NOT `text` WITH A CHECK, for `na_reason`'s reason one block up: an
# unknown value becomes a WRITE error the moment something invents one, rather
# than a read-time surprise on a screen months later.
#
# `migrations/versions/0003_rules.py` repeats both tuples verbatim, exactly as
# `0001` repeats `NA_REASON_LABELS` and for the same reason. NOTHING COMPARES THE
# TWO SOURCES — this said "separately compares the two copies", and no test reads
# the migration's tuples at all. They are held together VIA THE LIVE CATALOG, and
# the two legs catch different things: `tests/test_schema_migration.py::test_the
# _rulebook_enums_have_exactly_these_labels_in_exactly_this_order` asserts these
# constants against LITERALS in the test, which is what catches an edit made to
# BOTH copies at once; and it compares the live `pg_enum` — built by PostgreSQL
# from the MIGRATION's copy — against these constants, which is what catches an
# edit to either one alone.
#
# `alembic check` DOES NOT COMPARE ENUM LABELS: a fifth label and a reordering
# both leave it green (Plan 01 Task 3, `01-WHAT-HAPPENED.md` §3.11 item 8). That
# catalog assertion is the only thing covering either.
RULE_STATUS_LABELS: Final = ("live", "pending", "retired")
RULE_ORIGIN_LABELS: Final = ("spec", "escalation", "reconciliation", "complaint", "senior")

RULE_STATUS_TYPE_NAME: Final = "rule_status"
RULE_ORIGIN_TYPE_NAME: Final = "rule_origin"

# `create_type=False` for `NA_REASON`'s reason, one comment block up: `0003`
# creates and drops both types as explicit statements, which is the only way they
# get a `DROP` at all.
RULE_STATUS: Final = ENUM(*RULE_STATUS_LABELS, name=RULE_STATUS_TYPE_NAME, create_type=False)
RULE_ORIGIN: Final = ENUM(*RULE_ORIGIN_LABELS, name=RULE_ORIGIN_TYPE_NAME, create_type=False)

# ---------------------------------------------------------------------------
# CONFIRMED — `packages/contract/src/enums.ts`, verbatim.
# ---------------------------------------------------------------------------

# `FieldState` at `enums.ts:8-15`. The six members and their order.
#
# 🔴 `corrected` AND `escalated` ARE TERMINAL, AND NOTHING IN THIS TUPLE SAYS SO.
# An enum orders labels; it cannot express that two of them accept no successor.
# The machine is in migration `0006`: a `titlepipe_field_transition` function
# holding ONE conditional `UPDATE ... WHERE state <> ALL(terminal)`, zero rows
# affected raising rather than returning, plus the column-level `UPDATE` grant on
# `fields` that deliberately OMITS `state` so a handler that writes the column
# directly gets `42501` from PostgreSQL instead of a green test. See
# `FIELD_TERMINAL_STATES` below and `0006`'s module docstring for the measurement
# of what happens without it.
FIELD_STATE_LABELS: Final = (
    "pending",
    "auto_confirmed",
    "needs_review",
    "confirmed",
    "corrected",
    "escalated",
)

# The two members of `FIELD_STATE_LABELS` that accept no successor. Its own
# constant because `0006` builds the transition function's predicate from a list
# that must be exactly these two: a third member added here silently widens the
# machine, and a member dropped silently opens a terminal state to overwrite.
FIELD_TERMINAL_STATES: Final = ("corrected", "escalated")

# `JudgmentStatus` at `enums.ts:82-89`. `unknown` is a real determination and
# routes to `needs_review` — old R13, and the plan's §1 confirms the live
# contract still carries it.
JUDGMENT_STATUS_LABELS: Final = (
    "active",
    "satisfied",
    "released",
    "canceled",
    "vacated",
    "unknown",
)

# `DeliveryStatus` at `enums.ts:104-111`. CLOSED.
#
# `failed_transit` IS A TRANSIT STATE AND NEVER A QUALITY SIGNAL — stated in the
# contract at `entities.ts:279` and in the plan's §1. Nothing in an enum can
# enforce that reading; what does is `0050`'s
# `ck_deliveries_delivered_at_needs_a_transmitting_status`, which makes
# `delivered_at` unsettable while the row sits in `failed_transit`, so a retry
# cannot inherit a delivery instant from the attempt that failed.
DELIVERY_STATUS_LABELS: Final = (
    "draft",
    "signed",
    "digest_recorded",
    "transmitted",
    "acknowledged",
    "failed_transit",
)

# `RuleProvenance` at `enums.ts:66`. **`OPEN` MEANS DO NOT BUILD PAST IT** — the
# contract's own comment, and CLAUDE.md's rule. It is on `chain_links` because
# the chain is DERIVED and Kaveri's measurement against the one real corpus
# package found nothing in the source that links one instrument to the next: a
# link this system draws without a rule to cite is `OPEN`, and says so in a
# column, rather than being emitted as though it were established.
RULE_PROVENANCE_LABELS: Final = ("RULED", "DERIVED", "OPEN", "CONFLICT")

# `SignoffAnswer` at `intake.ts:12`. **`N/A` CARRIES A SLASH AND THAT IS THE
# CONTRACT'S SPELLING, NOT A TYPO TO NORMALISE.** A PostgreSQL enum label is a
# string literal, not an identifier, so the slash needs no quoting beyond the
# literal itself; renaming it to `NA` here would make every sign-off response a
# translation and would put the mapping in a place no test compares.
SIGNOFF_ANSWER_LABELS: Final = ("YES", "NO", "N/A")

# `GapKind` at `intake.ts:122`. The three kinds of gap the completeness gate
# raises between what the sign-off CLAIMED and what the package SUPPORTS.
GAP_KIND_LABELS: Final = ("na_provisional", "disagreement", "period_short")

# `GapCloseKind` at `intake.ts:131`. The server decides which options it offers;
# this is the closed set it may offer FROM.
GAP_CLOSE_KIND_LABELS: Final = ("upload", "amend", "root_of_title", "change_product")

# ---------------------------------------------------------------------------
# INVENTED — decided here, no contract behind them. Marked as such on purpose.
# ---------------------------------------------------------------------------

# 🔴 INVENTED. `packages/contract` has no package-lifecycle vocabulary at all.
#
# Four states because the domain needs exactly four distinctions: a package that
# has arrived (`received`), one held back on an optical/quarantine check
# (`quarantined`), the ONE that drives extraction (`accepted`), and one displaced
# by a re-upload (`superseded`). The plan's §1 is explicit that an order may
# receive more than one package over time but that exactly one is "the" accepted
# one at any moment — `0005`'s partial unique index is the machine for that, and
# it is the only reason `accepted` is a state rather than a boolean.
PACKAGE_STATUS_LABELS: Final = ("received", "quarantined", "accepted", "superseded")

# 🔴 INVENTED, and NARROWER than it looks. This is what a PAGE is, not what an
# INSTRUMENT is. Kaveri's measurement against the one real corpus package is the
# whole reason it exists: 67 of 101 pages are name-search / index output rather
# than instruments — "the single most important fact for classification" — so a
# schema with no way to say "this page is index output" cannot express two-thirds
# of a real package.
#
# **INSTRUMENT TYPE IS DELIBERATELY NOT AN ENUM ANYWHERE IN THIS SCHEMA.** The
# same measurement found instrument vocabulary is JURISDICTION-SPECIFIC —
# Georgia's `FIFA` (fieri facias) appears in one sample package and Missouri's
# has none — so `documents.kind` and `instruments.kind` are `text`. Closing that
# vocabulary globally would make the first Georgia package a write error.
#
# A page nobody has classified is NULL. See the module docstring.
PAGE_KIND_LABELS: Final = ("instrument", "index_search", "exhibit")

# 🔴 INVENTED, but the four words are the plan's own, not this file's:
# §1 names client configuration as a delta over a product baseline where clients
# hold only overrides — "waive / narrow / replace / add". An enum rather than
# `text` because a fifth effect changes what an effective-config resolver has to
# do, and it should not be able to arrive as data.
CONFIG_LINE_EFFECT_LABELS: Final = ("waive", "narrow", "replace", "add")

# ---------------------------------------------------------------------------
# THE RETENTION AND AUDIT THREE — created by migrations `0005` and `0007`, which
# repeat every label below verbatim, exactly as `0001` and `0003` do for the
# skeleton's. They arrived on a branch that still had `db/models.py` as one file;
# the labels are Kaveri's and are moved here unchanged, because this module is
# where a PostgreSQL enum type lives.
# ---------------------------------------------------------------------------

# 🔴 INVENTED, AND THE TWO AXES ARE THE POINT — COLLAPSING THEM MAKES A REAL
# RECORD UNREPRESENTABLE. `record_class` answers HOW LONG a record must be kept;
# `data_class` answers WHAT KIND OF DATA is in it. An escrow ledger containing
# NPI is `escrow_accounting` + `npi` and needs BOTH columns to say so; one axis
# would force a choice between recording the statutory bucket and recording that
# the row holds NPI.
#
# `operational_telemetry` IS A LABEL OF THE TYPE AND IS REFUSED IN
# `record_classifications` — PLAN.md wants an explicit telemetry slot so telemetry
# cannot default into a statutory bucket, and also says telemetry lives in a
# separate store. Both are true at once only if the label exists and a row
# carrying it is impossible; `ck_record_classifications_telemetry_is_not_stored
# _here` on `RecordClassification` is the second half.
RECORD_CLASS_LABELS: Final = (
    "evidence_of_insurability",
    "escrow_accounting",
    "policy",
    "derived_artifact",
    "npi_payload",
    "operational_telemetry",
)

# 🔴 INVENTED. `discovery-data-domain.md` §"Classes used", lower-cased; `pub_id`
# is that document's `PUB-ID`. Measured against the one real corpus package
# rather than decided here.
DATA_CLASS_LABELS: Final = ("npi", "pub_id", "client", "ops", "ref", "safe")

# 🔴 INVENTED, and NOT the four verbs it looks like. These are `TG_OP`'s three
# ROW-level verbs and nothing else. `TRUNCATE` is deliberately absent: it is
# statement-level, it cannot name a row, and on every audited table it is refused
# before it could be recorded.
AUDIT_ACTION_LABELS: Final = ("insert", "update", "delete")

# ---------------------------------------------------------------------------
# The type names and the bound `ENUM` objects.
# ---------------------------------------------------------------------------
# `<domain>_<concept>`, per the shared conventions §3.

FIELD_STATE_TYPE_NAME: Final = "field_state"
JUDGMENT_STATUS_TYPE_NAME: Final = "judgment_status"
DELIVERY_STATUS_TYPE_NAME: Final = "delivery_status"
RULE_PROVENANCE_TYPE_NAME: Final = "rule_provenance"
SIGNOFF_ANSWER_TYPE_NAME: Final = "signoff_answer"
GAP_KIND_TYPE_NAME: Final = "gap_kind"
GAP_CLOSE_KIND_TYPE_NAME: Final = "gap_close_kind"
PACKAGE_STATUS_TYPE_NAME: Final = "package_status"
PAGE_KIND_TYPE_NAME: Final = "page_kind"
CONFIG_LINE_EFFECT_TYPE_NAME: Final = "config_line_effect"
RECORD_CLASS_TYPE_NAME: Final = "record_class"
DATA_CLASS_TYPE_NAME: Final = "data_class"
AUDIT_ACTION_TYPE_NAME: Final = "audit_action"

FIELD_STATE: Final = ENUM(*FIELD_STATE_LABELS, name=FIELD_STATE_TYPE_NAME, create_type=False)
JUDGMENT_STATUS: Final = ENUM(
    *JUDGMENT_STATUS_LABELS, name=JUDGMENT_STATUS_TYPE_NAME, create_type=False
)
DELIVERY_STATUS: Final = ENUM(
    *DELIVERY_STATUS_LABELS, name=DELIVERY_STATUS_TYPE_NAME, create_type=False
)
RULE_PROVENANCE: Final = ENUM(
    *RULE_PROVENANCE_LABELS, name=RULE_PROVENANCE_TYPE_NAME, create_type=False
)
SIGNOFF_ANSWER: Final = ENUM(
    *SIGNOFF_ANSWER_LABELS, name=SIGNOFF_ANSWER_TYPE_NAME, create_type=False
)
GAP_KIND: Final = ENUM(*GAP_KIND_LABELS, name=GAP_KIND_TYPE_NAME, create_type=False)
GAP_CLOSE_KIND: Final = ENUM(
    *GAP_CLOSE_KIND_LABELS, name=GAP_CLOSE_KIND_TYPE_NAME, create_type=False
)
PACKAGE_STATUS: Final = ENUM(
    *PACKAGE_STATUS_LABELS, name=PACKAGE_STATUS_TYPE_NAME, create_type=False
)
PAGE_KIND: Final = ENUM(*PAGE_KIND_LABELS, name=PAGE_KIND_TYPE_NAME, create_type=False)
CONFIG_LINE_EFFECT: Final = ENUM(
    *CONFIG_LINE_EFFECT_LABELS, name=CONFIG_LINE_EFFECT_TYPE_NAME, create_type=False
)
RECORD_CLASS: Final = ENUM(*RECORD_CLASS_LABELS, name=RECORD_CLASS_TYPE_NAME, create_type=False)
DATA_CLASS: Final = ENUM(*DATA_CLASS_LABELS, name=DATA_CLASS_TYPE_NAME, create_type=False)
AUDIT_ACTION: Final = ENUM(*AUDIT_ACTION_LABELS, name=AUDIT_ACTION_TYPE_NAME, create_type=False)
