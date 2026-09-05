"""Every trigger function's BODY is asserted, because nothing in this tree read one

---------------------------------------------------------------------------
🔴 WHY THIS FILE EXISTS: THE WIDEST-REACH FINDING OF THE REVIEW.
---------------------------------------------------------------------------
    CREATE OR REPLACE FUNCTION golden_fields_require_ledger() RETURNS trigger
    LANGUAGE plpgsql AS $$ BEGIN RETURN NULL; END; $$;

Run as `titlepipe_owner`, that removes `0072`'s entire guarantee — the seven
immutable columns, the revision arithmetic, the requirement that a
`golden_corrections` row sign the change — and afterwards:

* `pg_trigger.tgenabled` is still `'A'`;
* `pg_trigger.tgtype` is still `17`;
* `pg_proc.proname` is still `golden_fields_require_ledger`;
* the trigger is still attached to the same table, still `AFTER UPDATE`, still
  `FOR EACH ROW`.

**The catalog is pristine.** A grep of `tests/` and `migrations/` found that
EVERY reference to `pg_proc` in this repository is a name, a signature list or
an ACL entry, and no assertion anywhere reads `prosrc`.
`test_golden_set.py::test_the_three_golden_triggers_are_enabled_always`
enumerates the ways this goes wrong as `'D'`, `'R'` and `'O'` and misses the one
that leaves every character of the catalog identical.

That invalidates every catalog-based trigger assertion in the tree, not one of
them. So this file fixes the CLASS: it asserts, for every non-internal trigger
in `public`, that the function behind it has the body its migration wrote.

## Two mechanisms, and the split is deliberate

**SOURCE-DERIVED, for the functions whose migration exposes its body.** `0100`,
`0101` and `0102` each build their function bodies in a named module-level
function — `resolver_body()`, `binder_body()`, `refusal_body()`,
`signer_body()` — precisely so this file can import the revision and compare
`pg_proc.prosrc` to the string the migration itself produces. There is no
manifest to maintain: edit the migration and the expectation moves with it, and
a `CREATE OR REPLACE` from anywhere else is a diff.

**DIGEST-PINNED, for every other trigger function in the schema.** Those
revisions inline their bodies into `op.execute(...)` and refactoring twenty of
them is not this file's business. A `sha256` of `prosrc` against a checked-in
constant catches the same class: a body that changed without its digest changing
in the same commit fails, and a body that changed WITH it was a deliberate,
reviewable act. `EXPECTED_BODY_DIGESTS` is an exact set in both directions, so a
NEW trigger function also fails here until somebody adds it.

## 🔴 WHY A DIGEST IN GIT IS WORTH MORE THAN ANY CHECK INSIDE THE DATABASE

Every append-only control in this schema tops out at `titlepipe_owner`, which is
one `SET ROLE` from `titlepipe_migration`, a LOGIN role. The owner can drop a
trigger, replace a function, or disable a constraint, and no statement it issues
will fail. **There is no defence against the owner from inside the database.**

The expectations in this file are not inside the database. They are in git, and
the owner is not inside git. That does not PREVENT the replacement — it means
the replacement does not survive contact with CI, which is the only lever this
system currently has. Saying that plainly is the point; a control described as
prevention when it is detection is how `0072` came to scope its residual to "a
superuser remains a superuser" when the real residual was the owner.

## What this does NOT prove

* **that the body is CORRECT.** It proves the body is the one the migration
  wrote. A migration that writes a wrong body ships a wrong body, and the
  behavioural tests elsewhere are what catch that;
* **that a body cannot be replaced BETWEEN CI runs.** It cannot see a window; it
  sees a state. An external anchor — a signature over the schema, checked at
  boot — is what would close that, and it does not exist.

## Nothing here is skipped

If Docker is unavailable these FAIL rather than skip, like the rest of the
database suite. Every read is a read; this module writes nothing.
"""

from __future__ import annotations

import hashlib
import importlib.util
import sys
from collections.abc import Callable, Mapping
from pathlib import Path
from types import ModuleType

import pytest
from sqlalchemy import Engine, text

# Every non-internal trigger in `public`, with the function behind it and that
# function's source. DERIVED FROM THE CATALOG rather than from a list of names:
# a trigger added by a revision nobody told this file about is still in the
# answer, which is what makes the exact-set assertion below mean something.
TRIGGER_FUNCTIONS_SQL = """
SELECT DISTINCT p.proname AS name, p.prosrc AS body
  FROM pg_trigger t
  JOIN pg_proc p ON p.oid = t.tgfoid
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE NOT t.tgisinternal
   AND n.nspname = 'public'
 ORDER BY p.proname
"""

# One function that is NOT behind any trigger and is read anyway: `0100`'s
# resolver is called from `audit_log_bind_actor` and from
# `golden_signer_is_a_person`, so gutting IT guts both without touching a single
# trigger-backed body. A body that is reachable from a trigger is in scope for
# this file whether or not a trigger names it directly.
CALLED_FUNCTIONS_SQL = """
SELECT p.proname AS name, p.prosrc AS body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND p.proname = ANY(:names)
"""

CALLED_FUNCTIONS = ("resolve_actor",)

MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations" / "versions"

# `(revision file, body builder, function name)` for every function whose
# migration exposes its body. These need NO digest: the expectation is the
# migration's own source, so editing the migration moves it automatically and a
# replacement from anywhere else is a diff.
#
# A revision that adds a trigger function SHOULD join this list rather than the
# digest manifest — it costs one module-level function in the migration and
# removes a constant somebody has to remember to update.
SOURCE_DERIVED: tuple[tuple[str, str, str], ...] = (
    ("0100_actor_identity.py", "resolver_body", "resolve_actor"),
    ("0100_actor_identity.py", "binder_body", "audit_log_bind_actor"),
    ("0101_golden_fields_are_not_deletable.py", "refusal_body", "golden_fields_reject_removal"),
    ("0102_golden_signers_are_people.py", "signer_body", "golden_signer_is_a_person"),
)

# `sha256(prosrc)` for every trigger function whose migration inlines its body.
#
# 🔴 WHEN THIS FAILS, DO NOT PASTE THE NEW DIGEST IN WITHOUT READING THE DIFF.
# The failure means a function body in the live schema is not the body that was
# here when somebody last looked. That is either (a) a migration you just wrote,
# in which case update the line in the SAME commit and the review sees both, or
# (b) the thing this file exists to catch. There is no third case, and the two
# are told apart by whether a migration changed — not by whether the test is
# annoying.
EXPECTED_BODY_DIGESTS: Mapping[str, str] = {
    "audit_chain_link": "cc35964d5fa930d9e05475cc5b25d57914ffaca9441acb42b15e7d274c52e834",
    "audit_log_reject_mutation": "68508aa27a2e9064fce7969b87e70c500a94f49ffe8167447415bc994659df05",
    "audit_record_change": "a3fe7cfb206d020fd2b8d5ad43d7c1236c60f2160ebdc07f2a14ec2b50d8c8df",
    "escalations_resolution_needs_a_live_rule": "eb8dbf12364c05539b256fb9939fdf075c31c867cd9d29cc43665a48d6450fc7",
    "golden_corrections_reject_mutation": "bcf356c859bbcd6392a4376c7daa91cd45bba44d41d2e36003193c21fc46e2fa",
    "golden_fields_require_ledger": "557623e44667d463e8d959b485d2bde524967a4e2a19f4f374d79ed69b4a469d",
    "intake_signoff_lines_refuse_an_edit_after_signature": "1b2207ef2b30603310cd32232d88909315d3932d4c78ffed6f972062d6ae42da",
    "orders_refuse_a_config_version_move": "3dc079579f5ee1fb4638110010000b31de9e4d4bee6c5bfd464722f28a2d91fd",
    "orders_refuse_an_extraction_release_with_an_open_gate": "aa42169d78adf6a8d8017e25dcb9e7e44c994bf18c92730808d8f0dbf8f22aaf",
    # 🔴 THE SIX `procrastinate_*` BODIES ARE THIRD-PARTY AND ARE PINNED ANYWAY.
    # `0060` installs the queue's own schema, so these digests move when the
    # dependency is upgraded and not when anybody here writes SQL. That is still
    # a change to a trigger body running inside this database, and a bump that
    # rewrites one is exactly the kind of thing a lockfile diff hides.
    "procrastinate_notify_queue_abort_job_v1": "ff4a5020a3b0f80f1476932c6bc3149094911dd52b8a62cc695c74b514449e22",
    "procrastinate_notify_queue_job_inserted_v1": "945ed201e1e4f405a8a46a64fbdf3e212a77677ef2eaa8c85d00ad812919c45e",
    "procrastinate_trigger_abort_requested_events_procedure_v1": "2e20aa6813846d26245e7031947ecf17187503846d8d6406fc387627d146e66b",
    "procrastinate_trigger_function_scheduled_events_v1": "713122df4b02397e27d15bd1a7854cbf002724789e35d9e16e0943b33c91e6e4",
    "procrastinate_trigger_function_status_events_insert_v1": "3973091d4a0b5b3996fb7880bff984db67a03acfbf98aea9b0759819690faccd",
    "procrastinate_trigger_function_status_events_update_v1": "ed03e3cc0a4716ee87a273c98113a575c03b8bf44bf0bdf9621235077cb31405",
    "procrastinate_unlink_periodic_defers_v1": "7c36fb69992f1160f75d3f83c426840ffddfefb9f1d791c57592dbf2dc0352d4",
    "reports_reject_mutation": "cd0e162a7413d0db92b0b65fa7c223a20ea4c7555c394c7e302e4276be907075",
    "titlepipe_packages_identity_is_immutable": "a0cf19546bc240c1c48dd1d116cd29d46c041e1ebd84ce375bdfbe3edecf42ea",
}


def _load_revision(filename: str) -> ModuleType:
    """Import one revision by PATH, because its module name starts with a digit.

    `0100_actor_identity` is not a legal identifier, so no `import` statement
    reaches it and `importlib.util.spec_from_file_location` is the only way in.
    The module is cached in `sys.modules` under a prefixed name so that four
    lookups into two files do not execute either file four times — and NOT under
    its bare name, which would collide with anything alembic has already loaded.
    """
    key = f"_revision_under_test_{filename.removesuffix('.py')}"
    cached = sys.modules.get(key)
    if cached is not None:
        return cached

    spec = importlib.util.spec_from_file_location(key, MIGRATIONS / filename)
    unimportable = (
        f"{filename} is not importable from {MIGRATIONS}; this file compares the "
        f"live schema against the revision's own source and cannot fall back to "
        f"a copy of it"
    )
    assert spec is not None, unimportable
    assert spec.loader is not None, unimportable
    module = importlib.util.module_from_spec(spec)
    sys.modules[key] = module
    spec.loader.exec_module(module)
    return module


def _live_bodies(engine: Engine) -> dict[str, str]:
    """Every trigger-reachable function body in `public`, by name."""
    with engine.connect() as connection:
        bodies = {
            str(row.name): str(row.body) for row in connection.execute(text(TRIGGER_FUNCTIONS_SQL))
        }
        bodies.update(
            {
                str(row.name): str(row.body)
                for row in connection.execute(
                    text(CALLED_FUNCTIONS_SQL), {"names": list(CALLED_FUNCTIONS)}
                )
            }
        )
    return bodies


@pytest.mark.parametrize(("filename", "builder", "function"), SOURCE_DERIVED)
def test_a_function_body_is_the_one_its_migration_wrote(
    filename: str,
    builder: str,
    function: str,
    migrated_database: str,
    seam_engine: Callable[[str], Engine],
) -> None:
    """`pg_proc.prosrc` against the revision's own body builder, character for character.

    This is the assertion the review found nowhere in the tree. A `CREATE OR
    REPLACE` that guts the function leaves `tgenabled`, `tgtype`, `proname` and
    the attachment identical, and is a one-line diff here.

    The comparison is EXACT rather than normalised. Whitespace in a plpgsql body
    is not semantically meaningful and normalising it would be defensible — and
    it would also let `RETURN NULL;\\n` be swapped for `RETURN NULL ;` and every
    other rewrite that happens to preserve a token stream. An exact compare has
    no such gap and costs nothing, because both sides come from the same string
    in the same file.
    """
    engine = seam_engine(migrated_database)
    try:
        bodies = _live_bodies(engine)
    finally:
        engine.dispose()

    assert function in bodies, (
        f"{function} is not behind any trigger in public and is not in "
        f"CALLED_FUNCTIONS, so its body is unasserted. If {filename} still "
        f"creates it, the trigger that used it has been dropped."
    )

    expected = str(getattr(_load_revision(filename), builder)())
    assert bodies[function] == expected, (
        f"{function}'s body in the live schema is NOT the body {filename}::"
        f"{builder}() writes. Something ran CREATE OR REPLACE on it outside the "
        f"migration chain — which leaves tgenabled, tgtype and proname untouched, "
        f"so no other assertion in this tree would notice.\n\n"
        f"--- live ---\n{bodies[function]}\n"
        f"--- {filename} ---\n{expected}"
    )


def test_every_other_trigger_function_body_matches_its_pinned_digest(
    migrated_database: str, seam_engine: Callable[[str], Engine]
) -> None:
    """The rest of the schema, by `sha256` of `prosrc`, as an EXACT set.

    Exact in both directions on purpose. A body that CHANGED is the headline
    case; a function that APPEARED is the one a "check the ones we know about"
    loop would miss, and a new trigger function nobody reviewed the body of is
    the same defect arriving a different way. A function that VANISHED means a
    trigger was dropped, which is `0004`'s failure mode wearing a different hat.

    The failure message carries the whole manifest as a paste-ready block, so
    that updating it after a real migration is mechanical and reading the diff
    is the only judgement required.
    """
    engine = seam_engine(migrated_database)
    try:
        bodies = _live_bodies(engine)
    finally:
        engine.dispose()

    source_derived = {function for _file, _builder, function in SOURCE_DERIVED}
    live = {
        name: hashlib.sha256(body.encode("utf-8")).hexdigest()
        for name, body in bodies.items()
        if name not in source_derived
    }

    rendered = "\n".join(f'    "{name}": "{digest}",' for name, digest in sorted(live.items()))
    assert live == dict(EXPECTED_BODY_DIGESTS), (
        f"the trigger-function body digests have moved.\n"
        f"  changed: {sorted(n for n in live.keys() & EXPECTED_BODY_DIGESTS.keys() if live[n] != EXPECTED_BODY_DIGESTS[n])}\n"
        f"  appeared: {sorted(live.keys() - EXPECTED_BODY_DIGESTS.keys())}\n"
        f"  vanished: {sorted(EXPECTED_BODY_DIGESTS.keys() - live.keys())}\n\n"
        f"READ THE MIGRATION DIFF BEFORE PASTING THIS IN. A digest that moved "
        f"without a migration changing is the CREATE OR REPLACE this file exists "
        f"to catch.\n\n"
        f"EXPECTED_BODY_DIGESTS: Mapping[str, str] = {{\n{rendered}\n}}"
    )
